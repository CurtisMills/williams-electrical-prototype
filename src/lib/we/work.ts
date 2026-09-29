import "server-only";
import { addDays, dateKeyOf, formatClock, isDateKey, isTimeKey, londonIso, todayKey, weekStartOf } from "@/lib/field/dates";
import { breakMinutes, dailySplit, isOnBreak, manualBreak, overlappingSessions, sessionValues } from "./calc";
import { touchTimesheets } from "./timesheets";
import { AppError, OFFICE_USER_IDS, audit, expectVersion, mutate, nextId, notify, requireRecord, type Actor } from "./store";
import type { Activity, CorrectionRequest, WeStore, WorkEventType, WorkSession } from "./types";

const ACTIVITIES: Activity[] = ["job", "travel", "other", "unassigned"];
const OFFLINE_AFTER_MS = 60_000;
const MAX_OFFLINE_AGE_MS = 7 * 86400_000;

export const activityLabel: Record<Activity, string> = {
  job: "Job",
  travel: "Travel",
  other: "Other work",
  unassigned: "Job not found",
};

function jobForNewTime(store: WeStore, jobId: unknown) {
  const job = requireRecord(store.jobs.find((j) => j.id === jobId), "Job");
  if (job.status === "cancelled" || job.status === "archived") {
    throw new AppError(409, `${job.ref} is ${job.status}, so time can’t be recorded against it. Ask the office to reopen it.`);
  }
  return job;
}

function activityTarget(store: WeStore, input: { activity?: unknown; jobId?: unknown; note?: unknown }) {
  const activity = (ACTIVITIES.includes(input.activity as Activity) ? input.activity : "job") as Activity;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 240) : "";
  if (activity === "job") return { activity, jobId: jobForNewTime(store, input.jobId).id, note: "" };
  if (activity === "unassigned" && note.length < 3) {
    throw new AppError(400, "Say where you are and what the work is, so the office can find the right job.");
  }
  return { activity, jobId: null, note };
}

const describe = (store: WeStore, s: Pick<WorkSession, "jobId" | "activity">) =>
  s.jobId ? (store.jobs.find((j) => j.id === s.jobId)?.ref ?? "a job") : activityLabel[s.activity].toLowerCase();

export interface WorkInput {
  action?: unknown;
  clientEventId?: unknown;
  occurredAt?: unknown;
  jobId?: unknown;
  activity?: unknown;
  note?: unknown;
}

export interface WorkResult {
  outcome: "applied" | "duplicate" | "conflict";
  message: string;
  session: WorkSession | null;
}

/**
 * One entry point for every button on the Today screen. Each tap carries a client event id,
 * so retries (double taps, offline resends) are applied once. Events queued offline keep the
 * time they happened; conflicts with newer records are kept for the office instead of dropped.
 */
export async function recordWork(actor: Actor, input: WorkInput): Promise<WorkResult> {
  const action = input.action as WorkEventType;
  if (!["start", "break", "resume", "finish", "switch"].includes(action)) throw new AppError(400, "Unknown action.");
  const clientEventId = typeof input.clientEventId === "string" ? input.clientEventId.slice(0, 80) : "";
  if (!clientEventId) throw new AppError(400, "Missing event id. Refresh the page and try again.");

  return mutate((store) => {
    const employee = requireRecord(store.employees.find((e) => e.id === actor.id), "Employee");
    if (!employee.active) throw new AppError(403, "Your account is inactive. Contact the office.");

    const previous = store.events.find((e) => e.employeeId === actor.id && e.clientEventId === clientEventId);
    if (previous) {
      return {
        outcome: "duplicate" as const,
        message: "Already saved.",
        session: store.sessions.find((s) => s.id === previous.sessionId) ?? null,
      };
    }

    const receivedAt = new Date().toISOString();
    let occurredAt = receivedAt;
    if (typeof input.occurredAt === "string" && !Number.isNaN(Date.parse(input.occurredAt))) {
      const t = Date.parse(input.occurredAt);
      if (t < Date.now() - MAX_OFFLINE_AGE_MS) throw new AppError(400, "This saved event is more than a week old. Ask the office to add it.");
      occurredAt = new Date(Math.min(t, Date.now())).toISOString();
    }
    const offline = Date.parse(receivedAt) - Date.parse(occurredAt) > OFFLINE_AFTER_MS;
    const open = store.sessions.find((s) => s.employeeId === actor.id && !s.finishedAt && !s.voided) ?? null;

    const logEvent = (outcome: "applied" | "conflict", sessionId: string | null, detail: string) =>
      store.events.push({
        id: nextId(store, "E"), clientEventId, employeeId: actor.id, type: action, occurredAt, receivedAt,
        sessionId, offline, outcome, detail,
      });

    const conflict = (detail: string): WorkResult => {
      if (!offline) throw new AppError(409, detail);
      logEvent("conflict", open?.id ?? null, detail);
      notify(store, OFFICE_USER_IDS, "Phone event needs review", `${employee.name}: ${detail}`, "/office/exceptions");
      return { outcome: "conflict", message: "Saved for the office to review because it clashes with a newer record.", session: open };
    };

    const touch = (s: WorkSession) => {
      s.lastEventAt = receivedAt;
      s.version++;
    };

    const startSession = (target: ReturnType<typeof activityTarget>, startedAt: string): WorkSession => {
      const clash = overlappingSessions(store.sessions, actor.id, startedAt, null).filter((s) => s.id !== open?.id);
      if (clash.length) {
        throw new AppError(409, `That start time overlaps work already recorded from ${formatClock(clash[0].startedAt)}.`);
      }
      const session: WorkSession = {
        id: nextId(store, "S"), employeeId: actor.id, jobId: target.jobId, activity: target.activity, note: target.note,
        startedAt, finishedAt: null, breaks: [], source: offline ? "phone_offline" : "phone", receivedAt,
        lastEventAt: receivedAt, edited: false, voided: false, version: 1, original: null,
      };
      store.sessions.push(session);
      return session;
    };

    const closeSession = (s: WorkSession, at: string) => {
      if (Date.parse(at) < Date.parse(s.startedAt)) throw new AppError(409, "Finish time can’t be before the start time.");
      for (const b of s.breaks) if (!b.end) b.end = at;
      s.finishedAt = at;
      touch(s);
    };

    switch (action) {
      case "start": {
        const target = activityTarget(store, input);
        if (open) {
          if (open.jobId === target.jobId && open.activity === target.activity) {
            logEvent("applied", open.id, "Repeated start ignored");
            return { outcome: "duplicate", message: `Already recording since ${formatClock(open.startedAt)}.`, session: open };
          }
          return conflict(`You’re already recording ${describe(store, open)}. Use Change job or Finish work first.`);
        }
        try {
          const session = startSession(target, occurredAt);
          logEvent("applied", session.id, "Started");
          touchTimesheets(store, actor, actor.id, [dateKeyOf(occurredAt)], "New work recorded");
          return { outcome: "applied", message: `Started at ${formatClock(occurredAt)}.`, session };
        } catch (err) {
          if (err instanceof AppError && offline) return conflict(err.message);
          throw err;
        }
      }
      case "break": {
        if (!open) return conflict("No work is being recorded, so a break can’t start.");
        if (isOnBreak(open)) {
          logEvent("applied", open.id, "Repeated break ignored");
          return { outcome: "duplicate", message: "You’re already on a break.", session: open };
        }
        if (Date.parse(occurredAt) < Date.parse(open.startedAt)) return conflict("Break can’t start before the work started.");
        open.breaks.push({ start: occurredAt, end: null });
        touch(open);
        logEvent("applied", open.id, "Break started");
        return { outcome: "applied", message: `Break started at ${formatClock(occurredAt)}.`, session: open };
      }
      case "resume": {
        const current = open?.breaks.find((b) => !b.end);
        if (!open || !current) {
          if (open) logEvent("applied", open.id, "Repeated resume ignored");
          return open
            ? { outcome: "duplicate", message: "You’re already working.", session: open }
            : conflict("No break is open to resume.");
        }
        current.end = occurredAt < current.start ? current.start : occurredAt;
        touch(open);
        logEvent("applied", open.id, "Resumed");
        return { outcome: "applied", message: `Back to work at ${formatClock(occurredAt)}.`, session: open };
      }
      case "finish": {
        if (!open) {
          const last = store.sessions
            .filter((s) => s.employeeId === actor.id && s.finishedAt && !s.voided)
            .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))[0];
          if (last && Date.now() - Date.parse(last.lastEventAt) < 120_000) {
            logEvent("applied", last.id, "Repeated finish ignored");
            return { outcome: "duplicate", message: `Already finished at ${formatClock(last.finishedAt!)}.`, session: last };
          }
          return conflict("No work is being recorded, so there’s nothing to finish.");
        }
        try {
          closeSession(open, occurredAt);
        } catch (err) {
          if (err instanceof AppError && offline) return conflict(err.message);
          throw err;
        }
        logEvent("applied", open.id, "Finished");
        touchTimesheets(store, actor, actor.id, sessionDates(open), "Work finished");
        return { outcome: "applied", message: `Finished at ${formatClock(occurredAt)}.`, session: open };
      }
      case "switch": {
        const target = activityTarget(store, input);
        if (!open) return conflict("No work is being recorded. Use Start work instead.");
        if (open.jobId === target.jobId && open.activity === target.activity) {
          logEvent("applied", open.id, "Switch to the same job ignored");
          return { outcome: "duplicate", message: "You’re already recording this.", session: open };
        }
        closeSession(open, occurredAt);
        const session = startSession(target, occurredAt);
        logEvent("applied", session.id, `Changed from ${open.id}`);
        touchTimesheets(store, actor, actor.id, sessionDates(open), "Changed job");
        return { outcome: "applied", message: `Changed to ${describe(store, session)} at ${formatClock(occurredAt)}.`, session };
      }
    }
    throw new AppError(400, "Unknown action.");
  });
}

export const sessionDates = (s: WorkSession) => {
  const split = dailySplit(s).map((x) => x.date);
  return split.length ? split : [dateKeyOf(s.startedAt)];
};

// ---------------------------------------------------------------- manual times

export interface TimesInput {
  date?: unknown;
  start?: unknown;
  finish?: unknown;
  finishNextDay?: unknown;
  breakMinutes?: unknown;
  jobId?: unknown;
  activity?: unknown;
  note?: unknown;
}

function parseTimes(input: TimesInput, allowOpen: boolean) {
  if (!isDateKey(input.date)) throw new AppError(400, "Choose the date of the work.");
  if (!isTimeKey(input.start)) throw new AppError(400, "Enter a start time as HH:MM, for example 07:45.");
  const startedAt = londonIso(input.date, input.start);
  let finishedAt: string | null = null;
  if (input.finish === "" || input.finish === null || input.finish === undefined) {
    if (!allowOpen) throw new AppError(400, "Enter a finish time as HH:MM, for example 16:30.");
  } else {
    if (!isTimeKey(input.finish)) throw new AppError(400, "Enter a finish time as HH:MM, for example 16:30.");
    finishedAt = londonIso(input.finishNextDay ? addDays(input.date, 1) : input.date, input.finish);
    if (Date.parse(finishedAt) <= Date.parse(startedAt)) {
      throw new AppError(400, "The finish time must be after the start time. Tick “Finished after midnight” for night work.");
    }
  }
  if (Date.parse(startedAt) > Date.now()) throw new AppError(400, "The start time can’t be in the future.");
  if (finishedAt && Date.parse(finishedAt) > Date.now()) throw new AppError(400, "The finish time can’t be in the future.");
  const brk = Number(input.breakMinutes ?? 0);
  if (!Number.isInteger(brk) || brk < 0) throw new AppError(400, "Enter the break in whole minutes, for example 30.");
  if (finishedAt && brk >= (Date.parse(finishedAt) - Date.parse(startedAt)) / 60000) {
    throw new AppError(400, "The break is longer than the time worked.");
  }
  return { startedAt, finishedAt, breakMinutes: brk };
}

function checkOverlap(store: WeStore, employeeId: string, startedAt: string, finishedAt: string | null, excludeId?: string) {
  const clash = overlappingSessions(store.sessions, employeeId, startedAt, finishedAt, excludeId);
  if (clash.length) {
    const c = clash[0];
    throw new AppError(
      409,
      `Those times overlap another record (${describe(store, c)}, ${formatClock(c.startedAt)}–${c.finishedAt ? formatClock(c.finishedAt) : "still open"} on ${dateKeyOf(c.startedAt)}). Change the times or correct that record first.`,
    );
  }
}

function applyValues(
  store: WeStore,
  actor: Actor,
  session: WorkSession,
  input: TimesInput,
  reason: string,
  action: string,
) {
  const times = parseTimes(input, !session.finishedAt && !input.finish);
  const target = activityTarget(store, { activity: input.activity ?? session.activity, jobId: input.jobId ?? session.jobId, note: input.note ?? session.note });
  checkOverlap(store, session.employeeId, times.startedAt, times.finishedAt, session.id);
  const before = sessionValues(session);
  const beforeDates = sessionDates(session);
  if (!session.original) session.original = before;
  const recordedBreakMinutes = breakMinutes(session);
  session.startedAt = times.startedAt;
  session.finishedAt = times.finishedAt;
  const endForBreak = times.finishedAt ?? new Date().toISOString();
  session.breaks =
    times.breakMinutes === recordedBreakMinutes && session.breaks.every((b) => b.start >= times.startedAt && (b.end ?? endForBreak) <= endForBreak)
      ? session.breaks
      : manualBreak(times.startedAt, endForBreak, times.breakMinutes);
  session.jobId = target.jobId;
  session.activity = target.activity;
  session.note = target.note;
  session.edited = true;
  session.version++;
  session.lastEventAt = new Date().toISOString();
  audit(store, actor, { entity: "session", entityId: session.id, action, before, after: sessionValues(session), reason });
  touchTimesheets(store, actor, session.employeeId, [...beforeDates, ...sessionDates(session)], `Record ${session.id} corrected: ${reason}`);
}

function requireReason(reason: unknown) {
  const text = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
  if (text.length < 5) throw new AppError(400, "Give a short reason (at least 5 characters) so the history makes sense later.");
  return text;
}

// ---------------------------------------------------------------- employee corrections

export async function requestCorrection(actor: Actor, input: TimesInput & { sessionId?: unknown; reason?: unknown }) {
  const reason = requireReason(input.reason);
  return mutate((store) => {
    const session = input.sessionId ? store.sessions.find((s) => s.id === input.sessionId) : undefined;
    if (input.sessionId && (!session || session.employeeId !== actor.id)) throw new AppError(404, "Record not found.");
    if (session?.voided) throw new AppError(409, "That record has been removed by the office.");
    if (session && store.corrections.some((c) => c.sessionId === session.id && c.status === "pending")) {
      throw new AppError(409, "You’ve already asked for a change to this record. The office will review it.");
    }
    const times = parseTimes(input, false);
    const target = activityTarget(store, input);
    checkOverlap(store, actor.id, times.startedAt, times.finishedAt, session?.id);
    const correction: CorrectionRequest = {
      id: nextId(store, "C"),
      employeeId: actor.id,
      sessionId: session?.id ?? null,
      proposed: {
        date: input.date as string,
        start: input.start as string,
        finish: input.finish as string,
        breakMinutes: times.breakMinutes,
        jobId: target.jobId,
        activity: target.activity,
      },
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      decisionNote: "",
    };
    if (target.activity === "unassigned") correction.reason = `${reason} · ${target.note}`;
    if (session && !session.finishedAt && dateKeyOf(session.startedAt) < todayKey()) {
      correction.provisional = true;
      applyValues(store, actor, session, input, `Missing finish added by employee, awaiting office check: ${reason}`, "finish added by employee");
    }
    store.corrections.push(correction);
    audit(store, actor, { entity: "correction", entityId: correction.id, action: "requested", after: correction.proposed, reason });
    notify(
      store,
      OFFICE_USER_IDS,
      "Time correction requested",
      `${actor.name}: ${session ? "change to" : "missing entry for"} ${correction.proposed.date}`,
      `/office/exceptions`,
    );
    return correction;
  });
}

export async function decideCorrection(actor: Actor, id: string, input: { decision?: unknown; note?: unknown }) {
  const decision = input.decision;
  if (decision !== "approve" && decision !== "reject") throw new AppError(400, "Choose approve or reject.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) : "";
  if (decision === "reject" && note.length < 5) throw new AppError(400, "Say why the change is rejected so the employee knows what to do.");
  return mutate((store) => {
    const correction = requireRecord(store.corrections.find((c) => c.id === id), "Correction request");
    if (correction.status !== "pending") throw new AppError(409, `This request was already ${correction.status}.`);
    const reason = `Employee correction ${correction.id}: ${correction.reason}${note ? ` (office: ${note})` : ""}`;
    const input: TimesInput = { ...correction.proposed, finishNextDay: correction.proposed.finish < correction.proposed.start };
    if (decision === "approve" && !correction.provisional) {
      if (correction.sessionId) {
        const session = requireRecord(store.sessions.find((s) => s.id === correction.sessionId), "Record");
        applyValues(store, actor, session, input, reason, "corrected (employee request)");
      } else {
        createSessionIn(store, actor, correction.employeeId, input, reason, "added (employee request)");
      }
    }
    correction.status = decision === "approve" ? "approved" : "rejected";
    correction.decidedAt = new Date().toISOString();
    correction.decidedBy = actor.id;
    correction.decisionNote = note;
    audit(store, actor, { entity: "correction", entityId: correction.id, action: correction.status, reason: note });
    notify(
      store,
      [correction.employeeId],
      decision === "approve" ? "Time correction approved" : "Time correction not approved",
      decision === "approve"
        ? `Your change for ${correction.proposed.date} has been ${correction.provisional ? "confirmed" : "applied"}.`
        : `${note}${correction.provisional ? " The office will correct the record." : ""}`,
      "/field/hours",
    );
    return correction;
  });
}

// ---------------------------------------------------------------- office changes

function createSessionIn(store: WeStore, actor: Actor, employeeId: string, input: TimesInput, reason: string, action: string) {
  requireRecord(store.employees.find((e) => e.id === employeeId), "Employee");
  const times = parseTimes(input, false);
  const target = activityTarget(store, input);
  checkOverlap(store, employeeId, times.startedAt, times.finishedAt);
  const now = new Date().toISOString();
  const session: WorkSession = {
    id: nextId(store, "S"), employeeId, jobId: target.jobId, activity: target.activity, note: target.note,
    startedAt: times.startedAt, finishedAt: times.finishedAt,
    breaks: manualBreak(times.startedAt, times.finishedAt!, times.breakMinutes),
    source: "office", receivedAt: now, lastEventAt: now, edited: true, voided: false, version: 1, original: null,
  };
  store.sessions.push(session);
  audit(store, actor, { entity: "session", entityId: session.id, action, after: sessionValues(session), reason });
  touchTimesheets(store, actor, employeeId, sessionDates(session), `Record ${session.id} added: ${reason}`);
  return session;
}

export async function officeCreateSession(actor: Actor, input: TimesInput & { employeeId?: unknown; reason?: unknown }) {
  const reason = requireReason(input.reason);
  return mutate((store) => createSessionIn(store, actor, String(input.employeeId), input, reason, "added by office"));
}

export async function officeCorrectSession(actor: Actor, id: string, input: TimesInput & { reason?: unknown; version?: unknown }) {
  const reason = requireReason(input.reason);
  return mutate((store) => {
    const session = requireRecord(store.sessions.find((s) => s.id === id), "Record");
    if (session.voided) throw new AppError(409, "This record has been removed. Restore it first.");
    expectVersion(session.version, input.version, "record");
    applyValues(store, actor, session, input, reason, "corrected by office");
    // Resolve any pending employee request for the same record so it doesn't linger.
    for (const c of store.corrections) {
      if (c.sessionId === session.id && c.status === "pending") {
        c.status = "approved";
        c.decidedAt = new Date().toISOString();
        c.decidedBy = actor.id;
        c.decisionNote = "Resolved by an office correction.";
      }
    }
    return session;
  });
}

export async function officeVoidSession(actor: Actor, id: string, input: { reason?: unknown; version?: unknown }) {
  const reason = requireReason(input.reason);
  return mutate((store) => {
    const session = requireRecord(store.sessions.find((s) => s.id === id), "Record");
    expectVersion(session.version, input.version, "record");
    const before = sessionValues(session);
    session.voided = !session.voided;
    session.version++;
    session.edited = true;
    audit(store, actor, { entity: "session", entityId: session.id, action: session.voided ? "removed" : "restored", before, reason });
    touchTimesheets(store, actor, session.employeeId, sessionDates(session), `Record ${session.id} ${session.voided ? "removed" : "restored"}: ${reason}`);
    return session;
  });
}

/** Offline events that clashed with newer records; kept until the office dismisses them. */
export async function dismissConflict(actor: Actor, eventId: string, input: { reason?: unknown }) {
  const reason = requireReason(input.reason);
  return mutate((store) => {
    const event = requireRecord(store.events.find((e) => e.id === eventId && e.outcome === "conflict"), "Event");
    event.outcome = "applied";
    event.detail = `${event.detail} · Reviewed: ${reason}`;
    audit(store, actor, { entity: "session", entityId: event.sessionId ?? event.id, action: "phone event reviewed", reason });
    return event;
  });
}

export const weekOf = (iso: string) => weekStartOf(dateKeyOf(iso));
