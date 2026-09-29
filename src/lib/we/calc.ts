// Pure calculations shared by server and browser. No I/O here, so previews on the phone
// and the rules enforced by the server use exactly the same arithmetic.

import { addDays, daysBetween, dateKeyOf, isoWeekday, londonIso, toMinutes } from "@/lib/field/dates";
import type {
  Assignment,
  Employee,
  Job,
  LeaveDay,
  LeavePortion,
  LeaveRequest,
  Requirement,
  SessionValues,
  Settings,
  WeStore,
  WorkSession,
} from "./types";

// ---------------------------------------------------------------- intervals

export type Interval = [number, number];

export function union(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function subtract(from: Interval[], remove: Interval[]): Interval[] {
  let result = union(from);
  for (const [ra, rb] of union(remove)) {
    result = result.flatMap(([a, b]): Interval[] => {
      if (rb <= a || ra >= b) return [[a, b]];
      const parts: Interval[] = [];
      if (ra > a) parts.push([a, ra]);
      if (rb < b) parts.push([rb, b]);
      return parts;
    });
  }
  return result;
}

export const total = (intervals: Interval[]) => union(intervals).reduce((n, [a, b]) => n + (b - a), 0);
export const intersects = (a: Interval, b: Interval) => a[0] < b[1] && b[0] < a[1];

// ---------------------------------------------------------------- work sessions

const ms = (iso: string) => Date.parse(iso);

/** Break minutes, counting an open break up to `now`. */
export function breakMinutes(session: Pick<WorkSession, "breaks" | "finishedAt">, now = new Date().toISOString()): number {
  return Math.round(
    total(session.breaks.map((b) => [ms(b.start), ms(b.end ?? session.finishedAt ?? now)] as Interval)) / 60000,
  );
}

/** Worked time as instants: start to finish (or now) with breaks removed. */
export function workIntervals(session: Pick<WorkSession, "startedAt" | "finishedAt" | "breaks">, now = new Date().toISOString()) {
  const end = session.finishedAt ?? now;
  const breaks = session.breaks.map((b) => [ms(b.start), ms(b.end ?? end)] as Interval);
  return subtract([[ms(session.startedAt), ms(end)]], breaks);
}

export function netMinutes(session: Pick<WorkSession, "startedAt" | "finishedAt" | "breaks">, now?: string): number {
  return Math.round(total(workIntervals(session, now)) / 60000);
}

export const isOnBreak = (session: WorkSession) => !session.finishedAt && session.breaks.some((b) => !b.end);

/**
 * Splits a closed session at London midnight so a night shift counts towards the right
 * dates. Breaks are attributed to the date on which they happened.
 */
export function dailySplit(session: WorkSession): { date: string; netMinutes: number; breakMinutes: number }[] {
  if (!session.finishedAt) return [];
  const byDate = new Map<string, { net: number; brk: number }>();
  const add = (intervals: Interval[], key: "net" | "brk") => {
    for (const [a, b] of intervals) {
      let cursor = a;
      while (cursor < b) {
        const date = dateKeyOf(new Date(cursor).toISOString());
        const nextMidnight = ms(londonIso(addDays(date, 1), "00:00"));
        const segEnd = Math.min(b, nextMidnight);
        const entry = byDate.get(date) ?? { net: 0, brk: 0 };
        entry[key] += segEnd - cursor;
        byDate.set(date, entry);
        cursor = segEnd;
      }
    }
  };
  add(workIntervals(session), "net");
  add(
    union(session.breaks.map((b) => [ms(b.start), ms(b.end ?? session.finishedAt!)] as Interval)),
    "brk",
  );
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, netMinutes: Math.round(v.net / 60000), breakMinutes: Math.round(v.brk / 60000) }));
}

export function sessionValues(session: WorkSession): SessionValues {
  return {
    jobId: session.jobId,
    activity: session.activity,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    breakMinutes: breakMinutes(session),
  };
}

/** Other live sessions of the same employee that overlap [start, end). Open sessions run to "now". */
export function overlappingSessions(
  sessions: WorkSession[],
  employeeId: string,
  start: string,
  end: string | null,
  excludeId?: string,
  now = new Date().toISOString(),
) {
  const candidate: Interval = [ms(start), ms(end ?? now)];
  return sessions.filter(
    (s) =>
      s.employeeId === employeeId &&
      !s.voided &&
      s.id !== excludeId &&
      intersects(candidate, [ms(s.startedAt), ms(s.finishedAt ?? now)]),
  );
}

/** A single break placed centrally, for times entered by hand rather than recorded live. */
export function manualBreak(startIso: string, finishIso: string, minutes: number) {
  if (minutes <= 0) return [];
  const mid = (ms(startIso) + ms(finishIso)) / 2;
  const start = Math.round((mid - (minutes * 60000) / 2) / 60000) * 60000;
  return [{ start: new Date(start).toISOString(), end: new Date(start + minutes * 60000).toISOString() }];
}

// ---------------------------------------------------------------- calendar and pattern

export const bankHolidayName = (date: string, settings: Settings) =>
  settings.bankHolidays.find((b) => b.date === date)?.name ?? null;

export function worksOn(employee: Employee, date: string, settings: Settings): boolean {
  return employee.pattern.days.includes(isoWeekday(date)) && !bankHolidayName(date, settings);
}

export const patternWindow = (employee: Employee): Interval => [
  toMinutes(employee.pattern.start),
  toMinutes(employee.pattern.end),
];

export const patternMinutes = (employee: Employee, date: string, settings: Settings) =>
  worksOn(employee, date, settings) ? patternWindow(employee)[1] - patternWindow(employee)[0] : 0;

// ---------------------------------------------------------------- leave

export const MIDDAY = "12:00";
export const portionValue = (portion: LeavePortion) => (portion === "full" ? 1 : 0.5);
export const portionLabel: Record<LeavePortion, string> = { full: "Full day", am: "Morning", pm: "Afternoon" };

export function leaveInterval(portion: LeavePortion, employee: Employee): Interval {
  const [start, end] = patternWindow(employee);
  const mid = toMinutes(MIDDAY);
  return portion === "am" ? [start, mid] : portion === "pm" ? [mid, end] : [start, end];
}

/** Working days in a range for this employee; non-working and bank holiday dates are skipped. */
export function buildLeaveDays(
  employee: Employee,
  first: string,
  last: string,
  portions: Record<string, LeavePortion>,
  settings: Settings,
): LeaveDay[] {
  if (!first || !last || last < first) return [];
  return daysBetween(first, last)
    .filter((date) => worksOn(employee, date, settings))
    .map((date) => ({ date, portion: portions[date] ?? "full" }));
}

export const sumDays = (days: LeaveDay[]) => days.reduce((n, d) => n + portionValue(d.portion), 0);

export function leaveYearOf(date: string, settings: Settings): number {
  const [y, m] = date.split("-").map(Number);
  return m >= settings.leaveYearStartMonth ? y : y - 1;
}

export function leaveYearRange(year: number, settings: Settings) {
  const month = String(settings.leaveYearStartMonth).padStart(2, "0");
  return { first: `${year}-${month}-01`, last: addDays(`${year + 1}-${month}-01`, -1) };
}

/** Leave that currently reduces availability: approved, including approved leave awaiting cancellation. */
export const isBookedLeave = (r: LeaveRequest) => r.status === "approved";

export interface LeaveBalance {
  year: number;
  allowance: number;
  approved: number;
  pending: number;
  remaining: number;
  remainingIfPendingApproved: number;
}

export function leaveBalance(
  employee: Employee,
  requests: LeaveRequest[],
  year: number,
  settings: Settings,
  excludeRequestId?: string,
): LeaveBalance {
  const inYear = (days: LeaveDay[]) => sumDays(days.filter((d) => leaveYearOf(d.date, settings) === year));
  const mine = requests.filter((r) => r.employeeId === employee.id && r.id !== excludeRequestId);
  const approved = mine.filter(isBookedLeave).reduce((n, r) => n + inYear(r.days), 0);
  const pending = mine.filter((r) => r.status === "pending").reduce((n, r) => n + inYear(r.days), 0);
  const remaining = employee.allowanceDays - approved;
  return {
    year,
    allowance: employee.allowanceDays,
    approved,
    pending,
    remaining,
    remainingIfPendingApproved: remaining - pending,
  };
}

// ---------------------------------------------------------------- capacity and coverage

export type PlanContext = Pick<
  WeStore,
  "settings" | "employees" | "jobs" | "requirements" | "assignments" | "leave" | "unavailability"
>;

export interface Absence {
  kind: "leave" | "pending_leave" | "unavailable";
  label: string;
  interval: Interval;
  sourceId: string;
}

export function absencesOn(employee: Employee, date: string, ctx: PlanContext, includePending = false): Absence[] {
  const out: Absence[] = [];
  for (const r of ctx.leave) {
    if (r.employeeId !== employee.id) continue;
    const booked = isBookedLeave(r);
    if (!booked && !(includePending && r.status === "pending")) continue;
    for (const d of r.days) {
      if (d.date !== date) continue;
      out.push({
        kind: booked ? "leave" : "pending_leave",
        label: `${booked ? "Approved leave" : "Pending leave"}${d.portion === "full" ? "" : ` (${portionLabel[d.portion].toLowerCase()})`}`,
        interval: leaveInterval(d.portion, employee),
        sourceId: r.id,
      });
    }
  }
  for (const u of ctx.unavailability) {
    if (u.employeeId === employee.id && u.date === date) {
      out.push({ kind: "unavailable", label: u.reason, interval: [toMinutes(u.start), toMinutes(u.end)], sourceId: u.id });
    }
  }
  return out;
}

const assignmentInterval = (a: Pick<Assignment, "start" | "end">): Interval => [toMinutes(a.start), toMinutes(a.end)];

export interface DayCapacity {
  date: string;
  patternMinutes: number;
  leaveMinutes: number;
  otherMinutes: number;
  pendingLeaveMinutes: number;
  usableMinutes: number;
  assignedMinutes: number;
  remainingMinutes: number;
  absences: Absence[];
  assignments: Assignment[];
}

/**
 * Usable = pattern hours less approved leave and other unavailability (overlaps counted once).
 * Assigned = confirmed assignment time within usable hours. Remaining = usable − assigned.
 */
export function dayCapacity(employee: Employee, date: string, ctx: PlanContext, includePending = false): DayCapacity {
  const works = worksOn(employee, date, ctx.settings);
  const window: Interval[] = works ? [patternWindow(employee)] : [];
  const absences = absencesOn(employee, date, ctx, true);
  const booked = absences.filter((a) => a.kind !== "pending_leave" || includePending);
  const leaveOnly = absences.filter((a) => a.kind === "leave").map((a) => a.interval);
  const otherOnly = absences.filter((a) => a.kind === "unavailable").map((a) => a.interval);
  const pendingOnly = absences.filter((a) => a.kind === "pending_leave").map((a) => a.interval);

  const usable = subtract(window, booked.map((a) => a.interval));
  const assignments = ctx.assignments.filter((a) => a.employeeId === employee.id && a.date === date);
  const assigned = total(
    union(assignments.filter((a) => a.status === "confirmed").map(assignmentInterval)).flatMap((iv) =>
      subtract([iv], booked.map((a) => a.interval)).filter((x) => usable.some((u) => intersects(u, x))),
    ),
  );
  const patternMins = total(window);
  const leaveMins = total(subtract(window, subtract(window, leaveOnly)));
  const otherMins = total(subtract(subtract(window, leaveOnly), subtract(subtract(window, leaveOnly), otherOnly)));
  const usableMins = total(usable);
  return {
    date,
    patternMinutes: patternMins,
    leaveMinutes: leaveMins,
    otherMinutes: otherMins,
    pendingLeaveMinutes: total(subtract(subtract(window, [...leaveOnly, ...otherOnly]), subtract(window, pendingOnly))),
    usableMinutes: usableMins,
    assignedMinutes: Math.min(assigned, usableMins),
    remainingMinutes: Math.max(0, usableMins - assigned),
    absences,
    assignments,
  };
}

export interface RequirementCoverage {
  requirement: Requirement;
  job: Job;
  /** Confirmed assignments whose person is actually available. */
  filled: Assignment[];
  needsReplacement: Assignment[];
  /** Filled, but the person has pending leave that would affect it (preview only). */
  atRisk: Assignment[];
  unfilled: number;
  /** Unfilled if every pending leave request were approved. */
  unfilledIfPendingApproved: number;
}

export function requirementCoverage(requirement: Requirement, ctx: PlanContext): RequirementCoverage {
  const job = ctx.jobs.find((j) => j.id === requirement.jobId)!;
  const mine = ctx.assignments.filter((a) => a.requirementId === requirement.id);
  const filled: Assignment[] = [];
  const atRisk: Assignment[] = [];
  const needsReplacement: Assignment[] = [];
  for (const a of mine) {
    if (a.status === "needs_replacement") {
      needsReplacement.push(a);
      continue;
    }
    const employee = ctx.employees.find((e) => e.id === a.employeeId);
    if (!employee) continue;
    const absences = absencesOn(employee, a.date, ctx, true);
    const interval = assignmentInterval(a);
    const blocked = absences.some((x) => x.kind !== "pending_leave" && intersects(x.interval, interval));
    if (blocked) {
      needsReplacement.push(a);
      continue;
    }
    filled.push(a);
    if (absences.some((x) => x.kind === "pending_leave" && intersects(x.interval, interval))) atRisk.push(a);
  }
  const unfilled = Math.max(0, requirement.count - filled.length);
  return {
    requirement,
    job,
    filled,
    needsReplacement,
    atRisk,
    unfilled,
    unfilledIfPendingApproved: Math.max(0, requirement.count - (filled.length - atRisk.length)),
  };
}

export const roleLabel = { electrician: "Electrician", apprentice: "Apprentice" } as const;

/** Checks run for every new assignment, including bulk copies. Returns reasons it can't be saved. */
export function assignmentProblems(
  ctx: PlanContext,
  employee: Employee,
  requirement: Requirement,
): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  const job = ctx.jobs.find((j) => j.id === requirement.jobId);
  const interval: Interval = [toMinutes(requirement.start), toMinutes(requirement.end)];

  if (!job) problems.push("This job no longer exists.");
  else if (job.status === "cancelled" || job.status === "archived" || job.status === "completed") {
    problems.push(`${job.ref} is ${job.status}. Reopen it before assigning people.`);
  }
  if (!employee.active) problems.push(`${employee.name} is no longer active.`);
  if (employee.role !== requirement.role) {
    problems.push(
      `${employee.name} is an ${roleLabel[employee.role].toLowerCase()}; this slot needs an ${roleLabel[requirement.role].toLowerCase()}.`,
    );
  }
  const holiday = bankHolidayName(requirement.date, ctx.settings);
  if (holiday) problems.push(`${holiday} is a bank holiday.`);
  else if (!employee.pattern.days.includes(isoWeekday(requirement.date))) {
    problems.push(`${employee.name} doesn’t work on this day of the week.`);
  } else {
    const [ws, we] = patternWindow(employee);
    if (interval[0] < ws || interval[1] > we) {
      problems.push(`${requirement.start}–${requirement.end} is outside ${employee.name}’s working hours (${employee.pattern.start}–${employee.pattern.end}).`);
    }
  }
  for (const absence of absencesOn(employee, requirement.date, ctx, true)) {
    if (!intersects(absence.interval, interval)) continue;
    if (absence.kind === "pending_leave") warnings.push(`${employee.name} has pending leave that day.`);
    else problems.push(`${employee.name} is unavailable: ${absence.label.toLowerCase()}.`);
  }
  for (const other of ctx.assignments) {
    if (other.employeeId !== employee.id || other.date !== requirement.date) continue;
    if (other.requirementId === requirement.id) {
      problems.push(`${employee.name} is already assigned to this slot.`);
      continue;
    }
    if (other.status === "confirmed" && intersects(assignmentInterval(other), interval)) {
      const otherJob = ctx.jobs.find((j) => j.id === other.jobId);
      problems.push(`${employee.name} is already booked on ${otherJob?.ref ?? "another job"} ${other.start}–${other.end}.`);
    }
  }
  const coverage = requirementCoverage(requirement, ctx);
  if (coverage.unfilled === 0 && coverage.needsReplacement.length === 0) {
    problems.push(`All ${requirement.count} ${roleLabel[requirement.role].toLowerCase()} places are already filled.`);
  } else if (coverage.unfilled === 0) {
    problems.push("This slot is already covered.");
  }
  return { problems: [...new Set(problems)], warnings };
}

export function requirementsOn(ctx: PlanContext, date: string, includeTentative: boolean) {
  return ctx.requirements.filter((r) => {
    if (r.date !== date) return false;
    const job = ctx.jobs.find((j) => j.id === r.jobId);
    if (!job || job.status === "cancelled" || job.status === "archived") return false;
    return includeTentative || job.status !== "tentative";
  });
}