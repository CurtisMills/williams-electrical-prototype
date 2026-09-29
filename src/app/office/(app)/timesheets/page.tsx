import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader, btn, inputCls, labelCls, td, th } from "@/components/office/kit";
import { Pill, TimesheetPill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDateRange, formatDuration, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { weekSummary } from "@/lib/we/timesheets";
import { collectHours } from "@/lib/we/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Timesheets" };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export default async function TimesheetsPage(props: PageProps<"/office/timesheets">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const today = todayKey();
  const week = weekStartOf(isDateKey(sp.week) ? sp.week : addDays(today, -7));
  const by = sp.by === "customer" ? "customer" : "employee";
  const store = await readStore();
  const filters = { customerId: str(sp.customer), siteId: str(sp.site), jobId: str(sp.job) };
  const qs = (over: Record<string, string>) => `/office/timesheets?${new URLSearchParams({ week, by, ...Object.fromEntries(Object.entries({ customer: filters.customerId, site: filters.siteId, job: filters.jobId }).filter(([, v]) => v) as [string, string][]), ...over })}`;

  const summaries = store.employees.filter((e) => e.active).map((e) => ({ employee: e, s: weekSummary(store, e.id, week) }));
  const all = collectHours(store, { from: week, to: addDays(week, 6), ...filters, approval: "all" });
  const approvedOnly = collectHours(store, { from: week, to: addDays(week, 6), ...filters, approval: "approved" });
  const prev = collectHours(store, { from: addDays(week, -7), to: addDays(week, -1), ...filters, approval: "all" });
  const waiting = summaries.filter((x) => x.s.sheet.status === "submitted").length;

  const byJob = [...all.byJob.entries()].map(([jobId, v]) => {
    const job = store.jobs.find((j) => j.id === jobId);
    const customer = store.customers.find((c) => c.id === job?.customerId);
    return {
      key: jobId,
      job,
      customer,
      site: store.sites.find((s) => s.id === job?.siteId),
      minutes: v.minutes,
      approved: approvedOnly.byJob.get(jobId)?.minutes ?? 0,
      previous: prev.byJob.get(jobId)?.minutes ?? 0,
    };
  });

  return (
    <>
      <PageHeader overline="Office" title="Timesheets">
        Built from recorded sessions, Monday to Sunday. Approve each person’s week before exporting final figures. A later correction reopens an approved week automatically.
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-control border border-line bg-surface">
          <Link href={qs({ week: addDays(week, -7) })} className="grid size-12 place-items-center" aria-label="Previous week">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <span className="px-2 text-sm font-bold">{formatDateRange(week, addDays(week, 6))}</span>
          <Link href={qs({ week: addDays(week, 7) })} className="grid size-12 place-items-center" aria-label="Next week">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <div className="flex rounded-control border border-line bg-surface p-0.5">
          <Link href={qs({ by: "employee" })} aria-current={by === "employee" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 text-label font-bold ${by === "employee" ? "bg-ink text-white" : ""}`}>
            By employee
          </Link>
          <Link href={qs({ by: "customer" })} aria-current={by === "customer" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 text-label font-bold ${by === "customer" ? "bg-ink text-white" : ""}`}>
            By customer and job
          </Link>
        </div>
        {waiting > 0 && <Pill tone="blue">{waiting} waiting for approval</Pill>}
        <Link href={`/office/exports?week=${week}`} className={`${btn.outline} ml-auto`}>
          Export this week
        </Link>
      </div>

      <form method="get" className="mb-5 grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-4">
        <input type="hidden" name="week" value={week} />
        <input type="hidden" name="by" value={by} />
        <label className={labelCls}>
          Customer
          <select name="customer" defaultValue={filters.customerId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">All</option>
            {store.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Site
          <select name="site" defaultValue={filters.siteId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">All</option>
            {store.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Job
          <select name="job" defaultValue={filters.jobId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">All</option>
            {store.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.ref} · {j.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={btn.dark}>
            Filter
          </button>
          <Link href={`/office/timesheets?week=${week}&by=${by}`} className={btn.ghost}>
            Clear
          </Link>
        </div>
      </form>

      {by === "employee" ? (
        <Card title="Weekly timesheets" aside={`${formatDuration(all.totalMinutes)} recorded · ${formatDuration(approvedOnly.totalMinutes)} approved`}>
          <div className="-mx-5 -my-5 relative overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line bg-subtle">
                <tr>
                  <th className={th}>Employee</th>
                  <th className={th}>Status</th>
                  <th className={th}>Recorded{filters.customerId || filters.jobId || filters.siteId ? " (filtered)" : ""}</th>
                  <th className={th}>Jobs / other</th>
                  <th className={th}>Holiday</th>
                  <th className={th}>Previous week</th>
                  <th className={th}>Issues</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summaries.map(({ employee, s }) => {
                  const filtered = all.byEmployee.get(employee.id)?.minutes ?? 0;
                  const diff = s.totalMinutes - s.previousWeekMinutes;
                  return (
                    <tr key={employee.id} className={s.sheet.status === "submitted" ? "bg-info-surface" : undefined}>
                      <td className={td}>
                        <span className="font-bold">{employee.name}</span>
                        <span className="block text-xs text-muted">{roleLabel[employee.role]}</span>
                      </td>
                      <td className={td}>
                        <TimesheetPill status={s.sheet.status} />
                        {s.sheet.revision > 1 && <span className="block text-xs text-muted">Revision {s.sheet.revision}</span>}
                      </td>
                      <td className={`${td} tabular-nums font-bold`}>{formatDuration(filters.customerId || filters.jobId || filters.siteId ? filtered : s.totalMinutes)}</td>
                      <td className={`${td} tabular-nums`}>
                        {formatDuration(s.jobMinutes)} / {formatDuration(s.otherMinutes)}
                      </td>
                      <td className={td}>{s.leaveDays ? `${s.leaveDays} day${s.leaveDays === 1 ? "" : "s"}` : "–"}</td>
                      <td className={`${td} tabular-nums`}>
                        {formatDuration(s.previousWeekMinutes)}
                        {s.previousWeekMinutes > 0 && Math.abs(diff) >= 240 && (
                          <span className={`block text-xs font-bold ${diff > 0 ? "text-warning" : "text-info"}`}>
                            {diff > 0 ? "+" : "−"}
                            {formatDuration(Math.abs(diff))}
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        {s.openSessions.length > 0 && <Pill tone="amber">No finish recorded</Pill>}
                        {s.sheet.returnReason && s.sheet.status === "changes_requested" && <span className="block text-xs text-warning">{s.sheet.returnReason}</span>}
                      </td>
                      <td className={td}>
                        <Link href={`/office/timesheets/${employee.id}?week=${week}`} className="-my-3 inline-flex min-h-12 items-center font-bold text-primary hover:underline">
                          {s.sheet.status === "submitted" ? "Review timesheet" : "View"}
                          <span className="sr-only"> for {employee.name}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card title="Hours by customer and job" aside={`${formatDuration(all.totalMinutes)} recorded · ${formatDuration(approvedOnly.totalMinutes)} approved`}>
          <div className="-mx-5 -my-5 relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-subtle">
                <tr>
                  <th className={th}>Customer</th>
                  <th className={th}>Site</th>
                  <th className={th}>Job</th>
                  <th className={th}>Recorded</th>
                  <th className={th}>Approved</th>
                  <th className={th}>Previous week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byJob
                  .sort((a, b) => (a.customer?.name ?? "~").localeCompare(b.customer?.name ?? "~"))
                  .map((r) => (
                    <tr key={r.key}>
                      <td className={td}>{r.customer?.name ?? <span className="text-muted">Internal</span>}</td>
                      <td className={td}>{r.site?.name ?? "–"}</td>
                      <td className={td}>{r.job ? `${r.job.ref} · ${r.job.title}` : r.key.replace(/[()]/g, "").replace(/^./, (c) => c.toUpperCase())}</td>
                      <td className={`${td} tabular-nums font-bold`}>{formatDuration(r.minutes)}</td>
                      <td className={`${td} tabular-nums`}>
                        {formatDuration(r.approved)}
                        {r.approved < r.minutes && <span className="block text-xs text-warning">{formatDuration(r.minutes - r.approved)} not yet approved</span>}
                      </td>
                      <td className={`${td} tabular-nums`}>{formatDuration(r.previous)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {all.open.length > 0 && (
        <p className="mt-3 text-sm text-warning">
          {all.open.length} record(s) in this week have no finish time and are left out of every total until corrected.{" "}
          <Link href="/office/exceptions?kind=missing_finish" className="font-bold underline">
            Fix them
          </Link>
        </p>
      )}
    </>
  );
}
