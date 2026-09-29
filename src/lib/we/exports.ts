import "server-only";
import { decimalHours, formatIsoWithOffset, isDateKey, TIME_ZONE, todayKey, weekStartOf, addDays } from "@/lib/field/dates";
import { activityLabel } from "./work";
import { AppError, mutate, nextId, readStore, type Actor } from "./store";
import { timesheetStatusLabel } from "./timesheets";
import type { ExportRecord, TimesheetStatus, WeStore } from "./types";
import { collectHours, type HoursFilter } from "./views";

export function parseHoursFilter(params: URLSearchParams | Record<string, string | undefined>): HoursFilter {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : params[k]) ?? undefined;
  const today = todayKey();
  const from = get("from");
  const to = get("to");
  const week = get("week");
  let range: { from: string; to: string };
  if (isDateKey(from) && isDateKey(to) && from <= to) range = { from, to };
  else {
    const start = isDateKey(week) ? weekStartOf(week) : weekStartOf(addDays(today, -7));
    range = { from: start, to: addDays(start, 6) };
  }
  return {
    ...range,
    employeeId: get("employee") || undefined,
    customerId: get("customer") || undefined,
    siteId: get("site") || undefined,
    jobId: get("job") || undefined,
    approval: get("mode") === "draft" ? "all" : "approved",
  };
}

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) || /^[=+\-@]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const line = (values: (string | number)[]) => values.map(cell).join(",");

function describeFilters(store: WeStore, f: HoursFilter) {
  const parts: string[] = [];
  if (f.employeeId) parts.push(`Employee: ${store.employees.find((e) => e.id === f.employeeId)?.name ?? f.employeeId}`);
  if (f.customerId) parts.push(`Customer: ${store.customers.find((c) => c.id === f.customerId)?.name ?? f.customerId}`);
  if (f.siteId) parts.push(`Site: ${store.sites.find((s) => s.id === f.siteId)?.name ?? f.siteId}`);
  if (f.jobId) parts.push(`Job: ${store.jobs.find((j) => j.id === f.jobId)?.ref ?? f.jobId}`);
  return parts.length ? parts.join("; ") : "None";
}

function header(title: string, ref: string, store: WeStore, f: HoursFilter, generatedAt: string) {
  return [
    line([title]),
    line(["Export reference", ref]),
    line(["Date range", `${f.from} to ${f.to}`]),
    line(["Generated", formatIsoWithOffset(generatedAt)]),
    line(["Filters", describeFilters(store, f)]),
    line([
      "Records",
      f.approval === "approved"
        ? "FINAL: approved timesheets, completed records only"
        : "DRAFT PREVIEW: includes records not yet approved. Not for payroll or invoicing.",
    ]),
    line(["Demo data", "Fictional prototype data"]),
    "",
  ];
}

async function record(actor: Actor, kind: ExportRecord["kind"], f: HoursFilter, revisions: string[], totalMinutes: number) {
  return mutate((store) => {
    const exp: ExportRecord = {
      id: nextId(store, "X").replace("X-", "EXP-"),
      kind,
      mode: f.approval === "approved" ? "final" : "draft",
      from: f.from,
      to: f.to,
      filters: Object.fromEntries(
        Object.entries({ employee: f.employeeId, customer: f.customerId, site: f.siteId, job: f.jobId }).filter(([, v]) => v),
      ) as Record<string, string>,
      generatedAt: new Date().toISOString(),
      generatedBy: actor.id,
      timesheetRevisions: revisions,
      totalMinutes,
      supersededAt: null,
      supersededReason: "",
    };
    store.exports.push(exp);
    return exp;
  });
}

export async function employeeCsv(actor: Actor, f: HoursFilter) {
  const store = await readStore();
  const hours = collectHours(store, f);
  const exp = await record(actor, "employee_csv", f, hours.revisions, hours.totalMinutes);
  const out = header("Williams Electrical – employee timesheet hours", exp.id, store, f, exp.generatedAt);
  out.push(
    line([
      "Employee ref", "Employee name", "Work date", "Customer", "Site", "Job ref", "Start", "Finish", "Timezone",
      "Break minutes", "Activity", "Net minutes", "Decimal hours", "Approval state", "Timesheet revision",
    ]),
  );
  for (const r of hours.rows) {
    out.push(
      line([
        r.employee.ref, r.employee.name, r.date, r.customerName, r.siteName, r.job?.ref ?? "",
        formatIsoWithOffset(r.segmentStart), formatIsoWithOffset(r.segmentEnd), TIME_ZONE, r.breakMinutes,
        activityLabel[r.activity], r.netMinutes, decimalHours(r.netMinutes),
        timesheetStatusLabel[r.timesheetStatus as TimesheetStatus], r.revision,
      ]),
    );
  }
  out.push("", line(["Total", "", "", "", "", "", "", "", "", "", "", hours.totalMinutes, decimalHours(hours.totalMinutes)]));
  if (hours.open.length) {
    out.push(line([`Incomplete: ${hours.open.length} open record(s) excluded until a finish time is added.`]));
  }
  return { csv: "\uFEFF" + out.join("\r\n") + "\r\n", filename: `williams-employee-hours_${f.from}_${f.to}_${exp.id}${f.approval === "all" ? "_DRAFT" : ""}.csv` };
}

/** Customer hours by job and date. No employee names, leave, balances or internal reasons. */
export function customerSummary(store: WeStore, f: HoursFilter) {
  const hours = collectHours(store, f);
  const jobRows = hours.rows.filter((r) => r.activity === "job" && r.job);
  const groups = new Map<string, { customer: string; site: string; jobRef: string; jobTitle: string; date: string; activity: string; minutes: number }>();
  for (const r of jobRows) {
    const key = `${r.job!.id}|${r.date}`;
    const g = groups.get(key) ?? { customer: r.customerName, site: r.siteName, jobRef: r.job!.ref, jobTitle: r.job!.title, date: r.date, activity: r.job!.type, minutes: 0 };
    g.minutes += r.netMinutes;
    groups.set(key, g);
  }
  const lines = [...groups.values()].sort((a, b) => a.customer.localeCompare(b.customer) || a.jobRef.localeCompare(b.jobRef) || a.date.localeCompare(b.date));
  return {
    lines,
    totalMinutes: lines.reduce((n, g) => n + g.minutes, 0),
    revisions: [...new Set(jobRows.map((r) => `${r.employee.id}:${weekStartOf(r.date)}:${r.revision}`))],
    openCount: hours.open.filter((s) => s.activity === "job").length,
  };
}

export async function customerCsv(actor: Actor, f: HoursFilter) {
  const store = await readStore();
  const summary = customerSummary(store, f);
  const exp = await record(actor, "customer_csv", f, summary.revisions, summary.totalMinutes);
  const out = header("Williams Electrical – customer job hours", exp.id, store, f, exp.generatedAt);
  const minutesLabel = f.approval === "approved" ? "Approved net minutes" : "Net minutes (draft, not approved)";
  out.push(line(["Customer", "Site", "Job ref", "Job", "Work date", "Activity", minutesLabel, "Decimal hours"]));
  for (const g of summary.lines) {
    out.push(line([g.customer, g.site, g.jobRef, g.jobTitle, g.date, g.activity, g.minutes, decimalHours(g.minutes)]));
  }
  out.push("", line(["Total", "", "", "", "", "", summary.totalMinutes, decimalHours(summary.totalMinutes)]));
  return { csv: "\uFEFF" + out.join("\r\n") + "\r\n", filename: `williams-customer-hours_${f.from}_${f.to}_${exp.id}${f.approval === "all" ? "_DRAFT" : ""}.csv` };
}

export async function recordPrintedSummary(actor: Actor, f: HoursFilter) {
  const store = await readStore();
  const summary = customerSummary(store, f);
  return record(actor, "customer_summary", f, summary.revisions, summary.totalMinutes);
}

export function assertRange(f: HoursFilter) {
  if (f.to < f.from) throw new AppError(400, "The end date must be on or after the start date.");
}
