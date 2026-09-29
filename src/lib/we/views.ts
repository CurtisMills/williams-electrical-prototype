import "server-only";
import {
  addDays,
  dateKeyOf,
  daysBetween,
  formatDayKey,
  formatDuration,
  londonIso,
  todayKey,
  toMinutes,
  weekStartOf,
} from "@/lib/field/dates";
import {
  absencesOn,
  breakMinutes,
  dailySplit,
  isOnBreak,
  netMinutes,
  requirementCoverage,
  requirementsOn,
  worksOn,
} from "./calc";
import { sheetFor } from "./timesheets";
import type { Assignment, Employee, Job, Site, WeStore, WorkSession } from "./types";

export function lookup(store: WeStore) {
  const job = (id: string | null) => (id ? store.jobs.find((j) => j.id === id) ?? null : null);
  const site = (id: string | null | undefined) => (id ? store.sites.find((s) => s.id === id) ?? null : null);
  const customer = (id: string | null | undefined) => (id ? store.customers.find((c) => c.id === id) ?? null : null);
  const employee = (id: string) => store.employees.find((e) => e.id === id) ?? null;
  return { job, site, customer, employee };
}

export interface PlannedItem {
  assignment: Assignment;
  job: Job;
  site: Site;
  customerName: string;
  sessions: WorkSession[];
}

function plannedFor(store: WeStore, employeeId: string, date: string): PlannedItem[] {
  const l = lookup(store);
  return store.assignments
    .filter((a) => a.employeeId === employeeId && a.date === date && a.status === "confirmed")
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((assignment) => {
      const job = l.job(assignment.jobId)!;
      return {
        assignment,
        job,
        site: l.site(job.siteId)!,
        customerName: l.customer(job.customerId)?.name ?? "",
        sessions: store.sessions.filter(
          (s) => s.employeeId === employeeId && !s.voided && s.jobId === job.id && dateKeyOf(s.startedAt) === date,
        ),
      };
    });
}

// ---------------------------------------------------------------- employee

export function employeeDay(store: WeStore, employeeId: string, today = todayKey()) {
  const employee = lookup(store).employee(employeeId)!;
  const open = store.sessions.find((s) => s.employeeId === employeeId && !s.finishedAt && !s.voided) ?? null;
  const todaysSessions = store.sessions
    .filter((s) => s.employeeId === employeeId && !s.voided && dateKeyOf(s.startedAt) === today)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const upcoming = daysBetween(addDays(today, 1), addDays(today, 7)).map((date) => ({
    date,
    working: worksOn(employee, date, store.settings),
    holiday: store.settings.bankHolidays.find((b) => b.date === date)?.name ?? null,
    items: plannedFor(store, employeeId, date),
    absences: absencesOn(employee, date, store, true),
  }));
  const pendingCorrections = store.corrections.filter((c) => c.employeeId === employeeId && c.status === "pending");
  return {
    employee,
    today,
    planned: plannedFor(store, employeeId, today),
    absencesToday: absencesOn(employee, today, store, true),
    open,
    openIsOld: !!open && dateKeyOf(open.startedAt) < today,
    todaysSessions,
    upcoming,
    pendingCorrections,
  };
}

/** Jobs an employee can pick when they're somewhere other than planned. */
export function selectableJobs(store: WeStore) {
  const l = lookup(store);
  return store.jobs
    .filter((j) => j.status === "confirmed" || j.status === "tentative")
    .map((j) => ({
      id: j.id,
      ref: j.ref,
      title: j.title,
      site: l.site(j.siteId)?.name ?? "",
      address: l.site(j.siteId)?.address ?? "",
      customer: l.customer(j.customerId)?.name ?? "",
    }));
}

// ---------------------------------------------------------------- office today

export type TeamStatus = "working" | "on_break" | "finished" | "on_leave" | "no_start" | "due_later" | "not_scheduled";

export const teamStatusMeta: Record<TeamStatus, { label: string; order: number }> = {
  working: { label: "Working", order: 1 },
  on_break: { label: "On a break", order: 2 },
  no_start: { label: "No start recorded", order: 0 },
  due_later: { label: "Due to start", order: 3 },
  finished: { label: "Finished", order: 4 },
  on_leave: { label: "On holiday", order: 5 },
  not_scheduled: { label: "Not scheduled", order: 6 },
};

export function teamToday(store: WeStore, now = new Date()) {
  const today = todayKey(now);
  const l = lookup(store);
  const grace = store.settings.noStartGraceMinutes;
  return store.employees
    .filter((e) => e.active)
    .map((employee) => {
      const planned = plannedFor(store, employee.id, today);
      const replaced = store.assignments.filter((a) => a.employeeId === employee.id && a.date === today && a.status === "needs_replacement");
      const sessions = store.sessions
        .filter((s) => s.employeeId === employee.id && !s.voided && (dateKeyOf(s.startedAt) === today || !s.finishedAt))
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const open = sessions.find((s) => !s.finishedAt) ?? null;
      const absences = absencesOn(employee, today, store).filter((a) => a.kind !== "pending_leave");
      const fullLeave = absences.some((a) => a.kind === "leave" && a.label === "Approved leave");
      const firstStart = planned[0]?.assignment.start;
      const lastUpdate = [
        ...store.sessions.filter((s) => s.employeeId === employee.id).map((s) => s.lastEventAt),
        ...store.events.filter((e) => e.employeeId === employee.id).map((e) => e.receivedAt),
      ]
        .sort()
        .at(-1) ?? null;
      let status: TeamStatus;
      if (open) status = isOnBreak(open) ? "on_break" : "working";
      else if (sessions.some((s) => s.finishedAt && dateKeyOf(s.startedAt) === today)) status = "finished";
      else if (fullLeave) status = "on_leave";
      else if (!firstStart) status = "not_scheduled";
      else if (now.getTime() > Date.parse(londonIso(today, firstStart)) + grace * 60000) status = "no_start";
      else status = "due_later";
      const workedToday = sessions
        .flatMap((s) => (s.finishedAt ? dailySplit(s) : [{ date: dateKeyOf(s.startedAt), netMinutes: netMinutes(s) }]))
        .filter((x) => x.date === today)
        .reduce((n, x) => n + x.netMinutes, 0);
      const openJob = open ? l.job(open.jobId) : null;
      return {
        employee,
        status,
        planned,
        replaced,
        absences,
        open,
        openJob,
        openSite: openJob ? l.site(openJob.siteId) : null,
        openIsOld: !!open && dateKeyOf(open.startedAt) < today,
        firstRecordedStart: sessions.find((s) => dateKeyOf(s.startedAt) === today)?.startedAt ?? null,
        workedToday,
        lastUpdate,
      };
    })
    .sort((a, b) => teamStatusMeta[a.status].order - teamStatusMeta[b.status].order || a.employee.name.localeCompare(b.employee.name));
}

// ---------------------------------------------------------------- exceptions

export type ExceptionKind =
  | "missing_finish"
  | "no_start"
  | "unassigned_work"
  | "overlap"
  | "long_session"
  | "timesheet_review"
  | "correction"
  | "phone_conflict"
  | "needs_replacement"
  | "unfilled";

export interface ExceptionItem {
  id: string;
  kind: ExceptionKind;
  title: string;
  detail: string;
  who: string;
  date: string;
  href: string;
  action: string;
}

export const exceptionKindLabel: Record<ExceptionKind, string> = {
  missing_finish: "Missing finish",
  no_start: "No start recorded",
  unassigned_work: "Job not found",
  overlap: "Overlapping records",
  long_session: "Unusually long",
  timesheet_review: "Timesheet to review",
  correction: "Correction requested",
  phone_conflict: "Phone event clash",
  needs_replacement: "Needs replacement",
  unfilled: "Unfilled staffing",
};

export function exceptions(store: WeStore, now = new Date()): ExceptionItem[] {
  const today = todayKey(now);
  const l = lookup(store);
  const name = (id: string) => l.employee(id)?.name ?? "Unknown";
  const items: ExceptionItem[] = [];
  const live = store.sessions.filter((s) => !s.voided);
  const longMs = store.settings.longSessionHours * 3600000;
  const where = (s: WorkSession) => {
    const job = l.job(s.jobId);
    return job ? `${job.ref} ${job.title}` : s.activity === "unassigned" ? "job not found" : s.activity;
  };

  for (const s of live) {
    const date = dateKeyOf(s.startedAt);
    if (!s.finishedAt && (date < today || now.getTime() - Date.parse(s.startedAt) > longMs)) {
      items.push({
        id: `mf-${s.id}`, kind: "missing_finish", who: name(s.employeeId), date, href: `/office/records/${s.id}`, action: "Add finish time",
        title: `${name(s.employeeId)} has no finish recorded`,
        detail: `Started ${formatDayKey(date)} at ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(s.startedAt))} on ${where(s)}. Excluded from hours until corrected.`,
      });
    }
    if (s.activity === "unassigned") {
      items.push({
        id: `ua-${s.id}`, kind: "unassigned_work", who: name(s.employeeId), date, href: `/office/records/${s.id}`, action: "Choose the job",
        title: `${name(s.employeeId)} recorded work without a job`, detail: `“${s.note}” on ${formatDayKey(date)}.`,
      });
    }
    if (s.finishedAt && Date.parse(s.finishedAt) - Date.parse(s.startedAt) > longMs) {
      items.push({
        id: `ls-${s.id}`, kind: "long_session", who: name(s.employeeId), date, href: `/office/records/${s.id}`, action: "Check times",
        title: `${formatDuration(netMinutes(s))} recorded in one session`,
        detail: `${name(s.employeeId)} on ${formatDayKey(date)} (${where(s)}). Warning set at ${store.settings.longSessionHours} hours.`,
      });
    }
    if (s.finishedAt && Date.parse(s.finishedAt) < Date.parse(s.startedAt)) {
      items.push({
        id: `iv-${s.id}`, kind: "overlap", who: name(s.employeeId), date, href: `/office/records/${s.id}`, action: "Fix times",
        title: "Finish is before start", detail: `${name(s.employeeId)} on ${formatDayKey(date)}.`,
      });
    }
  }

  const byEmployee = new Map<string, WorkSession[]>();
  for (const s of live) byEmployee.set(s.employeeId, [...(byEmployee.get(s.employeeId) ?? []), s]);
  for (const [employeeId, list] of byEmployee) {
    const sorted = [...list].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevEnd = prev.finishedAt ?? now.toISOString();
      if (Date.parse(cur.startedAt) < Date.parse(prevEnd)) {
        items.push({
          id: `ov-${prev.id}-${cur.id}`, kind: "overlap", who: name(employeeId), date: dateKeyOf(cur.startedAt),
          href: `/office/records/${cur.id}`, action: "Resolve overlap",
          title: `${name(employeeId)} has overlapping records`, detail: `${prev.id} and ${cur.id} on ${formatDayKey(dateKeyOf(cur.startedAt))}.`,
        });
      }
    }
  }

  for (const member of teamToday(store, now)) {
    if (member.status !== "no_start") continue;
    const first = member.planned[0];
    items.push({
      id: `ns-${member.employee.id}`, kind: "no_start", who: member.employee.name, date: today,
      href: `/office/history?employee=${member.employee.id}&from=${today}&to=${today}`, action: "Check in with them",
      title: `No start recorded for ${member.employee.name}`,
      detail: `Planned ${first.assignment.start} at ${first.job.ref}, ${first.site.name}. This is missing information, not an absence.`,
    });
  }

  for (const c of store.corrections.filter((x) => x.status === "pending")) {
    items.push({
      id: `co-${c.id}`, kind: "correction", who: name(c.employeeId), date: c.proposed.date,
      href: c.sessionId ? `/office/records/${c.sessionId}` : `/office/exceptions#${c.id}`, action: "Review change",
      title: `${name(c.employeeId)} asked to ${c.sessionId ? "correct a record" : "add a forgotten entry"}`,
      detail: `${formatDayKey(c.proposed.date)} ${c.proposed.start}–${c.proposed.finish}, ${c.proposed.breakMinutes} min break. “${c.reason}”`,
    });
  }

  for (const e of store.events.filter((x) => x.outcome === "conflict")) {
    items.push({
      id: `pc-${e.id}`, kind: "phone_conflict", who: name(e.employeeId), date: dateKeyOf(e.occurredAt),
      href: `/office/exceptions#${e.id}`, action: "Review",
      title: `Saved phone event clashed with a newer record`,
      detail: `${name(e.employeeId)}: ${e.type} at ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(e.occurredAt))} on ${formatDayKey(dateKeyOf(e.occurredAt))}, received later. ${e.detail}`,
    });
  }

  for (const t of store.timesheets.filter((x) => x.status === "submitted")) {
    items.push({
      id: `ts-${t.id}`, kind: "timesheet_review", who: name(t.employeeId), date: t.weekStart,
      href: `/office/timesheets/${t.employeeId}?week=${t.weekStart}`, action: "Review week",
      title: `${name(t.employeeId)}’s timesheet is waiting`,
      detail: `Week of ${formatDayKey(t.weekStart, "long")}${t.reopenedReason ? `, reopened: ${t.reopenedReason}` : ""}.`,
    });
  }

  const horizon = addDays(today, 42);
  for (const a of store.assignments.filter((x) => x.status === "needs_replacement" && x.date >= today && x.date <= horizon)) {
    const job = l.job(a.jobId)!;
    items.push({
      id: `nr-${a.id}`, kind: "needs_replacement", who: name(a.employeeId), date: a.date,
      href: `/office/planning/jobs/${job.id}?date=${a.date}`, action: "Assign replacement",
      title: `${job.ref} needs a replacement on ${formatDayKey(a.date)}`,
      detail: `${name(a.employeeId)} is unavailable (${a.statusReason ?? "leave"}) for ${a.start}–${a.end}.`,
    });
  }

  const gapHorizon = addDays(today, 14);
  for (const date of daysBetween(today, gapHorizon)) {
    for (const r of requirementsOn(store, date, false)) {
      const cov = requirementCoverage(r, store);
      if (cov.unfilled === 0 || cov.needsReplacement.length >= cov.unfilled) continue;
      items.push({
        id: `uf-${r.id}`, kind: "unfilled", who: "", date,
        href: `/office/planning/jobs/${r.jobId}?date=${date}`, action: "Staff it",
        title: `${cov.job.ref} is short ${cov.unfilled - cov.needsReplacement.length} ${r.role}${cov.unfilled > 1 ? "s" : ""} on ${formatDayKey(date)}`,
        detail: `${cov.job.title}, ${r.start}–${r.end}.`,
      });
    }
  }

  const order: ExceptionKind[] = ["missing_finish", "no_start", "phone_conflict", "overlap", "correction", "unassigned_work", "long_session", "needs_replacement", "unfilled", "timesheet_review"];
  return items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------- history and hours

export interface HistoryFilter {
  employeeId?: string;
  customerId?: string;
  siteId?: string;
  jobId?: string;
  from: string;
  to: string;
  q?: string;
}

export function history(store: WeStore, f: HistoryFilter) {
  const l = lookup(store);
  const q = f.q?.trim().toLowerCase();
  return store.sessions
    .filter((s) => {
      const date = dateKeyOf(s.startedAt);
      if (date < f.from || date > f.to) return false;
      if (f.employeeId && s.employeeId !== f.employeeId) return false;
      const job = l.job(s.jobId);
      if (f.jobId && s.jobId !== f.jobId) return false;
      if (f.siteId && job?.siteId !== f.siteId) return false;
      if (f.customerId && job?.customerId !== f.customerId) return false;
      if (q) {
        const site = l.site(job?.siteId);
        const hay = [l.employee(s.employeeId)?.name, job?.ref, job?.title, site?.name, site?.address, l.customer(job?.customerId)?.name, s.note, s.id]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((s) => {
      const job = l.job(s.jobId);
      return {
        session: s,
        employee: l.employee(s.employeeId)!,
        job,
        site: l.site(job?.siteId),
        customer: l.customer(job?.customerId),
        breakMinutes: breakMinutes(s),
        netMinutes: s.finishedAt ? netMinutes(s) : null,
        timesheet: sheetFor(store, s.employeeId, weekStartOf(dateKeyOf(s.startedAt))).status,
      };
    });
}

export interface HoursFilter {
  from: string;
  to: string;
  employeeId?: string;
  customerId?: string;
  siteId?: string;
  jobId?: string;
  /** "approved" = final figures only; "all" = include unapproved (draft preview). */
  approval: "approved" | "all";
}

export interface HoursRow {
  sessionId: string;
  employee: Employee;
  date: string;
  segmentStart: string;
  segmentEnd: string;
  activity: WorkSession["activity"];
  job: Job | null;
  siteName: string;
  customerId: string | null;
  customerName: string;
  breakMinutes: number;
  netMinutes: number;
  approved: boolean;
  timesheetStatus: string;
  revision: number;
  edited: boolean;
}

/**
 * The single source for every hours view and export, so the employee view, customer view and
 * CSV files always reconcile. Each session is split at midnight and counted once per date.
 */
export function collectHours(store: WeStore, f: HoursFilter) {
  const l = lookup(store);
  const rows: HoursRow[] = [];
  const open: WorkSession[] = [];
  const midnight = (date: string) => londonIso(date, "00:00");
  for (const s of store.sessions) {
    if (s.voided) continue;
    if (f.employeeId && s.employeeId !== f.employeeId) continue;
    const job = l.job(s.jobId);
    if (f.jobId && s.jobId !== f.jobId) continue;
    if (f.siteId && job?.siteId !== f.siteId) continue;
    if (f.customerId && job?.customerId !== f.customerId) continue;
    if (!s.finishedAt) {
      const d = dateKeyOf(s.startedAt);
      if (d >= f.from && d <= f.to) open.push(s);
      continue;
    }
    for (const part of dailySplit(s)) {
      if (part.date < f.from || part.date > f.to) continue;
      const sheet = sheetFor(store, s.employeeId, weekStartOf(part.date));
      const approved = sheet.status === "approved";
      if (f.approval === "approved" && !approved) continue;
      const dayStart = midnight(part.date);
      const dayEnd = midnight(addDays(part.date, 1));
      rows.push({
        sessionId: s.id,
        employee: l.employee(s.employeeId)!,
        date: part.date,
        segmentStart: s.startedAt > dayStart ? s.startedAt : dayStart,
        segmentEnd: s.finishedAt < dayEnd ? s.finishedAt : dayEnd,
        activity: s.activity,
        job,
        siteName: l.site(job?.siteId)?.name ?? "",
        customerId: job?.customerId ?? null,
        customerName: l.customer(job?.customerId)?.name ?? "",
        breakMinutes: part.breakMinutes,
        netMinutes: part.netMinutes,
        approved,
        timesheetStatus: sheet.status,
        revision: sheet.revision,
        edited: s.edited,
      });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.employee.name.localeCompare(b.employee.name) || a.segmentStart.localeCompare(b.segmentStart));
  const totalMinutes = rows.reduce((n, r) => n + r.netMinutes, 0);
  const group = <K extends string>(key: (r: HoursRow) => K) => {
    const map = new Map<K, { minutes: number; rows: number }>();
    for (const r of rows) {
      const k = key(r);
      const e = map.get(k) ?? { minutes: 0, rows: 0 };
      e.minutes += r.netMinutes;
      e.rows++;
      map.set(k, e);
    }
    return map;
  };
  const revisions = [...new Set(rows.map((r) => `${r.employee.id}:${weekStartOf(r.date)}:${r.revision}`))];
  return {
    rows,
    open,
    totalMinutes,
    byEmployee: group((r) => r.employee.id),
    byJob: group((r) => r.job?.id ?? `(${r.activity})`),
    byCustomer: group((r) => r.customerId ?? "(no customer)"),
    revisions,
  };
}

export function lastWeeks(today: string, n: number) {
  const current = weekStartOf(today);
  return Array.from({ length: n }, (_, i) => addDays(current, -7 * i));
}

export const plannedMinutes = (a: Pick<Assignment, "start" | "end">) => toMinutes(a.end) - toMinutes(a.start);
