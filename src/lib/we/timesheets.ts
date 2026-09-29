import "server-only";
import { addDays, dateKeyOf, todayKey, weekStartOf } from "@/lib/field/dates";
import { dailySplit, isBookedLeave, netMinutes, portionValue } from "./calc";
import { AppError, OFFICE_USER_IDS, audit, expectVersion, mutate, nextId, notify, requireRecord, type Actor } from "./store";
import type { LeaveDay, Timesheet, TimesheetStatus, WeStore, WorkSession } from "./types";

export const timesheetStatusLabel: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  approved: "Approved",
};

/** The stored sheet, or an unsaved draft if nobody has touched that week yet. */
export function sheetFor(store: WeStore, employeeId: string, weekStart: string): Timesheet {
  return (
    store.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === weekStart) ?? {
      id: "",
      employeeId,
      weekStart,
      status: "draft",
      revision: 1,
      approvedMinutes: null,
      approvedAt: null,
      approvedBy: null,
      submittedAt: null,
      returnReason: "",
      reopenedReason: "",
      history: [],
      version: 0,
    }
  );
}

function ensureSheet(store: WeStore, employeeId: string, weekStart: string): Timesheet {
  const existing = store.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === weekStart);
  if (existing) return existing;
  const sheet = { ...sheetFor(store, employeeId, weekStart), id: nextId(store, "T"), version: 1 };
  store.timesheets.push(sheet);
  return sheet;
}

/**
 * Called whenever recorded time changes. An approved week is reopened for review with a new
 * revision, and exports that used the old revision are marked superseded.
 */
export function touchTimesheets(store: WeStore, actor: Actor, employeeId: string, dates: string[], reason: string) {
  for (const weekStart of new Set(dates.map(weekStartOf))) {
    const sheet = store.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === weekStart);
    if (!sheet || sheet.status !== "approved") continue;
    const oldKey = `${employeeId}:${weekStart}:${sheet.revision}`;
    sheet.status = "submitted";
    sheet.revision++;
    sheet.approvedMinutes = null;
    sheet.approvedAt = null;
    sheet.approvedBy = null;
    sheet.reopenedReason = reason;
    sheet.version++;
    sheet.history.push({ at: new Date().toISOString(), by: actor.id, action: "reopened", revision: sheet.revision, reason });
    const now = new Date().toISOString();
    for (const exp of store.exports) {
      if (!exp.supersededAt && exp.timesheetRevisions.includes(oldKey)) {
        exp.supersededAt = now;
        exp.supersededReason = `Timesheet revision changed (${reason})`;
      }
    }
    audit(store, actor, { entity: "timesheet", entityId: sheet.id, action: "reopened", reason });
    const name = store.employees.find((e) => e.id === employeeId)?.name ?? "An employee";
    notify(store, [employeeId], "Approved timesheet reopened", `Week of ${weekStart} changed and needs approving again.`, `/field/hours?week=${weekStart}`);
    notify(store, OFFICE_USER_IDS, "Timesheet reopened", `${name}, week of ${weekStart}: ${reason}`, `/office/timesheets/${employeeId}?week=${weekStart}`);
  }
}

export interface WeekLine {
  session: WorkSession;
  date: string;
  netMinutes: number;
  breakMinutes: number;
}

export interface WeekSummary {
  employeeId: string;
  weekStart: string;
  weekEnd: string;
  sheet: Timesheet;
  days: { date: string; lines: WeekLine[]; netMinutes: number; leave: LeaveDay | null; unavailable: string | null }[];
  totalMinutes: number;
  jobMinutes: number;
  otherMinutes: number;
  openSessions: WorkSession[];
  leaveDays: number;
  previousWeekMinutes: number;
}

function linesFor(store: WeStore, employeeId: string, first: string, last: string): WeekLine[] {
  return store.sessions
    .filter((s) => s.employeeId === employeeId && !s.voided && s.finishedAt)
    .flatMap((session) =>
      dailySplit(session)
        .filter((x) => x.date >= first && x.date <= last)
        .map((x) => ({ session, date: x.date, netMinutes: x.netMinutes, breakMinutes: x.breakMinutes })),
    )
    .sort((a, b) => a.session.startedAt.localeCompare(b.session.startedAt));
}

export function weekSummary(store: WeStore, employeeId: string, weekStart: string): WeekSummary {
  const weekEnd = addDays(weekStart, 6);
  const lines = linesFor(store, employeeId, weekStart, weekEnd);
  const leaveDays = store.leave
    .filter((r) => r.employeeId === employeeId && isBookedLeave(r))
    .flatMap((r) => r.days)
    .filter((d) => d.date >= weekStart && d.date <= weekEnd);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayLines = lines.filter((l) => l.date === date);
    return {
      date,
      lines: dayLines,
      netMinutes: dayLines.reduce((n, l) => n + l.netMinutes, 0),
      leave: leaveDays.find((d) => d.date === date) ?? null,
      unavailable: store.unavailability.find((u) => u.employeeId === employeeId && u.date === date)?.reason ?? null,
    };
  });
  const totalMinutes = lines.reduce((n, l) => n + l.netMinutes, 0);
  const jobMinutes = lines.filter((l) => l.session.activity === "job").reduce((n, l) => n + l.netMinutes, 0);
  const previous = linesFor(store, employeeId, addDays(weekStart, -7), addDays(weekStart, -1));
  return {
    employeeId,
    weekStart,
    weekEnd,
    sheet: sheetFor(store, employeeId, weekStart),
    days,
    totalMinutes,
    jobMinutes,
    otherMinutes: totalMinutes - jobMinutes,
    openSessions: store.sessions.filter(
      (s) => s.employeeId === employeeId && !s.voided && !s.finishedAt && dateKeyOf(s.startedAt) <= weekEnd && dateKeyOf(s.startedAt) >= weekStart,
    ),
    leaveDays: leaveDays.reduce((n, d) => n + portionValue(d.portion), 0),
    previousWeekMinutes: previous.reduce((n, l) => n + l.netMinutes, 0),
  };
}

/** Minutes so far for an open session, for live displays only (never totals). */
export const liveMinutes = (s: WorkSession) => netMinutes(s);

export async function submitTimesheet(actor: Actor, weekStart: unknown) {
  if (typeof weekStart !== "string" || weekStartOf(weekStart) !== weekStart) throw new AppError(400, "Choose a week.");
  if (weekStart > weekStartOf(todayKey())) throw new AppError(400, "You can’t submit a future week.");
  return mutate((store) => {
    const summary = weekSummary(store, actor.id, weekStart);
    if (summary.openSessions.length) {
      throw new AppError(409, "Finish or correct the record that is still open before submitting this week.");
    }
    const sheet = ensureSheet(store, actor.id, weekStart);
    if (sheet.status === "submitted") throw new AppError(409, "This week is already with the office.");
    if (sheet.status === "approved") throw new AppError(409, "This week has already been approved.");
    sheet.status = "submitted";
    sheet.submittedAt = new Date().toISOString();
    sheet.version++;
    sheet.history.push({ at: sheet.submittedAt, by: actor.id, action: "submitted", revision: sheet.revision, reason: "" });
    audit(store, actor, { entity: "timesheet", entityId: sheet.id, action: "submitted" });
    notify(store, OFFICE_USER_IDS, "Timesheet submitted", `${actor.name}, week of ${weekStart}`, `/office/timesheets/${actor.id}?week=${weekStart}`);
    return sheet;
  });
}

export async function decideTimesheet(
  actor: Actor,
  input: { employeeId?: unknown; weekStart?: unknown; decision?: unknown; reason?: unknown; version?: unknown },
) {
  const decision = input.decision;
  if (decision !== "approve" && decision !== "return") throw new AppError(400, "Choose approve or request changes.");
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
  if (decision === "return" && reason.length < 5) throw new AppError(400, "Say what needs changing so the employee knows what to fix.");
  return mutate((store) => {
    const employeeId = String(input.employeeId);
    const weekStart = String(input.weekStart);
    requireRecord(store.employees.find((e) => e.id === employeeId), "Employee");
    const sheet = requireRecord(
      store.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === weekStart),
      "Submitted timesheet",
    );
    expectVersion(sheet.version, input.version, "timesheet");
    if (sheet.status !== "submitted") {
      throw new AppError(409, `This timesheet is ${timesheetStatusLabel[sheet.status].toLowerCase()}, not awaiting review.`);
    }
    const summary = weekSummary(store, employeeId, weekStart);
    const now = new Date().toISOString();
    if (decision === "approve") {
      if (summary.openSessions.length) throw new AppError(409, "A record in this week is still open. Correct it before approving.");
      sheet.status = "approved";
      sheet.approvedMinutes = summary.totalMinutes;
      sheet.approvedAt = now;
      sheet.approvedBy = actor.id;
      sheet.returnReason = "";
    } else {
      sheet.status = "changes_requested";
      sheet.returnReason = reason;
    }
    sheet.version++;
    sheet.history.push({ at: now, by: actor.id, action: sheet.status, revision: sheet.revision, reason });
    audit(store, actor, { entity: "timesheet", entityId: sheet.id, action: sheet.status, reason });
    notify(
      store,
      [employeeId],
      decision === "approve" ? "Timesheet approved" : "Timesheet needs changes",
      decision === "approve" ? `Week of ${weekStart} approved.` : reason,
      `/field/hours?week=${weekStart}`,
    );
    return sheet;
  });
}

/** Is recorded time on this date part of an approved timesheet? */
export function isApprovedDate(store: WeStore, employeeId: string, date: string) {
  return sheetFor(store, employeeId, weekStartOf(date)).status === "approved";
}
