import "server-only";
import { formatDateRange, isDateKey, todayKey, toMinutes } from "@/lib/field/dates";
import {
  buildLeaveDays,
  intersects,
  leaveBalance,
  leaveInterval,
  leaveYearOf,
  requirementCoverage,
  sumDays,
  type LeaveBalance,
} from "./calc";
import { AppError, OFFICE_USER_IDS, audit, expectVersion, mutate, nextId, notify, requireRecord, type Actor } from "./store";
import type { Employee, LeaveDay, LeavePortion, LeaveRequest, LeaveStatus, WeStore } from "./types";

export const leaveStatusLabel: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

const PORTIONS: LeavePortion[] = ["full", "am", "pm"];
const MAX_RANGE_DAYS = 31;

const portionsClash = (a: LeavePortion, b: LeavePortion) => a === "full" || b === "full" || a === b;

function daysInYear(days: LeaveDay[], year: number, store: WeStore) {
  return sumDays(days.filter((d) => leaveYearOf(d.date, store.settings) === year));
}

/** Years a request touches, with the balance for each (a request can span the new year). */
export function balancesFor(store: WeStore, employee: Employee, days: LeaveDay[], excludeId?: string) {
  const years = [...new Set(days.map((d) => leaveYearOf(d.date, store.settings)))];
  return years.map((year) => ({
    year,
    requested: daysInYear(days, year, store),
    balance: leaveBalance(employee, store.leave, year, store.settings, excludeId),
  }));
}

export function overAllowance(store: WeStore, employee: Employee, days: LeaveDay[], excludeId?: string) {
  return balancesFor(store, employee, days, excludeId).filter((b) => b.requested > b.balance.remainingIfPendingApproved);
}

export interface LeaveInput {
  employeeId?: unknown;
  firstDay?: unknown;
  lastDay?: unknown;
  portions?: unknown;
  note?: unknown;
}

export async function createLeave(actor: Actor, input: LeaveInput): Promise<LeaveRequest> {
  const onBehalf = actor.role === "office";
  const today = todayKey();
  if (!isDateKey(input.firstDay) || !isDateKey(input.lastDay)) throw new AppError(400, "Choose the first and last day off.");
  const firstDay = input.firstDay;
  const lastDay = input.lastDay;
  if (lastDay < firstDay) throw new AppError(400, "The last day must be on or after the first day.");
  if (!onBehalf && firstDay < today) throw new AppError(400, "Choose a first day from today onward.");
  const rawPortions = (input.portions && typeof input.portions === "object" ? input.portions : {}) as Record<string, unknown>;
  const portions: Record<string, LeavePortion> = {};
  for (const [date, portion] of Object.entries(rawPortions)) {
    if (isDateKey(date) && PORTIONS.includes(portion as LeavePortion)) portions[date] = portion as LeavePortion;
  }
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 200) : "";

  return mutate((store) => {
    const employeeId = onBehalf ? String(input.employeeId ?? "") : actor.id;
    const employee = requireRecord(store.employees.find((e) => e.id === employeeId), "Employee");
    const days = buildLeaveDays(employee, firstDay, lastDay, portions, store.settings);
    if (days.length === 0) throw new AppError(400, "Those dates don’t include any of your working days.");
    if (days.length > MAX_RANGE_DAYS) throw new AppError(400, `Request up to ${MAX_RANGE_DAYS} working days at a time.`);

    for (const other of store.leave) {
      if (other.employeeId !== employeeId || (other.status !== "pending" && other.status !== "approved")) continue;
      const clash = other.days.find((d) => days.some((x) => x.date === d.date && portionsClash(x.portion, d.portion)));
      if (clash) {
        throw new AppError(409, `You already have ${other.status} leave on ${formatDateRange(clash.date, clash.date)} (${other.id}). Change the dates or withdraw that request first.`);
      }
    }

    const now = new Date().toISOString();
    const request: LeaveRequest = {
      id: nextId(store, "L"),
      employeeId,
      days,
      firstDay: days[0].date,
      lastDay: days[days.length - 1].date,
      totalDays: sumDays(days),
      note,
      status: "pending",
      cancellation: null,
      createdAt: now,
      createdBy: actor.id,
      decidedAt: null,
      decidedBy: null,
      decisionReason: "",
      history: [{ at: now, by: actor.id, action: onBehalf ? "recorded by office" : "submitted", reason: note }],
      version: 1,
    };
    store.leave.push(request);

    if (onBehalf) {
      const over = overAllowance(store, employee, days, request.id);
      if (over.length) {
        store.leave.pop();
        throw new AppError(409, `This would take ${employee.name} over their ${over[0].year} allowance (${over[0].balance.remainingIfPendingApproved} days left including pending requests).`);
      }
      approve(store, actor, request, "Recorded by the office on the employee’s behalf");
      audit(store, actor, { entity: "leave", entityId: request.id, action: "recorded on behalf", after: days, reason: note });
      notify(store, [employeeId], "Leave recorded for you", `${formatDateRange(request.firstDay, request.lastDay)} was recorded by ${actor.name}.`, "/field/leave");
    } else {
      audit(store, actor, { entity: "leave", entityId: request.id, action: "submitted", after: days, reason: note });
      notify(store, OFFICE_USER_IDS, "New leave request", `${employee.name}: ${formatDateRange(request.firstDay, request.lastDay)}`, `/office/leave/${request.id}`);
    }
    return request;
  });
}

/** Marks the employee's overlapping assignments as needing a replacement. */
function applyLeaveToAssignments(store: WeStore, actor: Actor, request: LeaveRequest) {
  const employee = store.employees.find((e) => e.id === request.employeeId)!;
  const affected = [];
  for (const a of store.assignments) {
    if (a.employeeId !== request.employeeId || a.status !== "confirmed") continue;
    const d = request.days.find((x) => x.date === a.date);
    if (!d || !intersects(leaveInterval(d.portion, employee), [toMinutes(a.start), toMinutes(a.end)])) continue;
    a.status = "needs_replacement";
    a.statusReason = `Approved leave ${request.id}`;
    affected.push(a);
    audit(store, actor, { entity: "assignment", entityId: a.id, action: "needs replacement", reason: `Leave ${request.id} approved` });
  }
  return affected;
}

function approve(store: WeStore, actor: Actor, request: LeaveRequest, reason: string) {
  const employee = store.employees.find((e) => e.id === request.employeeId)!;
  const over = overAllowance(store, employee, request.days, request.id).filter(
    (b) => b.requested > b.balance.remaining,
  );
  if (over.length) {
    throw new AppError(409, `Approving would exceed ${employee.name}’s ${over[0].year} allowance: ${over[0].balance.remaining} days left, ${over[0].requested} requested.`);
  }
  const now = new Date().toISOString();
  request.status = "approved";
  request.decidedAt = now;
  request.decidedBy = actor.id;
  request.decisionReason = reason;
  request.version++;
  request.history.push({ at: now, by: actor.id, action: "approved", reason });
  return applyLeaveToAssignments(store, actor, request);
}

export async function decideLeave(
  actor: Actor,
  id: string,
  input: { action?: unknown; reason?: unknown; version?: unknown },
) {
  const action = input.action;
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
  return mutate((store) => {
    const request = requireRecord(store.leave.find((r) => r.id === id), "Leave request");
    expectVersion(request.version, input.version, "leave request");
    const employee = store.employees.find((e) => e.id === request.employeeId)!;
    const range = formatDateRange(request.firstDay, request.lastDay);
    const now = new Date().toISOString();
    const balanceText = () => {
      const year = leaveYearOf(request.firstDay, store.settings);
      const b = leaveBalance(employee, store.leave, year, store.settings);
      return `${b.remaining} days remaining for ${year}.`;
    };

    switch (action) {
      case "approve": {
        if (request.status !== "pending") throw new AppError(409, `This request was already ${request.status}.`);
        const affected = approve(store, actor, request, reason);
        audit(store, actor, { entity: "leave", entityId: request.id, action: "approved", reason });
        notify(store, [request.employeeId], "Leave approved", `${range} approved. ${balanceText()}`, "/field/leave");
        return { request, affected: affected.length };
      }
      case "decline": {
        if (request.status !== "pending") throw new AppError(409, `This request was already ${request.status}.`);
        if (reason.length < 5) throw new AppError(400, "Give a reason for declining so the employee understands.");
        request.status = "declined";
        request.decidedAt = now;
        request.decidedBy = actor.id;
        request.decisionReason = reason;
        request.version++;
        request.history.push({ at: now, by: actor.id, action: "declined", reason });
        audit(store, actor, { entity: "leave", entityId: request.id, action: "declined", reason });
        notify(store, [request.employeeId], "Leave declined", `${range}: ${reason}`, "/field/leave");
        return { request, affected: 0 };
      }
      case "approve_cancel": {
        if (request.status !== "approved" || !request.cancellation) throw new AppError(409, "There’s no cancellation waiting on this request.");
        request.status = "cancelled";
        request.history.push({ at: now, by: actor.id, action: "cancellation approved", reason: reason || request.cancellation.reason });
        request.cancellation = null;
        request.version++;
        restoreAssignments(store, actor, request);
        audit(store, actor, { entity: "leave", entityId: request.id, action: "cancellation approved", reason });
        notify(store, [request.employeeId], "Leave cancellation approved", `${range} is cancelled and back in your allowance. ${balanceText()}`, "/field/leave");
        return { request, affected: 0 };
      }
      case "decline_cancel": {
        if (request.status !== "approved" || !request.cancellation) throw new AppError(409, "There’s no cancellation waiting on this request.");
        if (reason.length < 5) throw new AppError(400, "Give a reason so the employee understands why the leave stays booked.");
        request.history.push({ at: now, by: actor.id, action: "cancellation declined", reason });
        request.cancellation = null;
        request.version++;
        audit(store, actor, { entity: "leave", entityId: request.id, action: "cancellation declined", reason });
        notify(store, [request.employeeId], "Leave stays booked", `Your cancellation for ${range} was declined: ${reason}`, "/field/leave");
        return { request, affected: 0 };
      }
    }
    throw new AppError(400, "Unknown action.");
  });
}

/** When approved leave is cancelled, put people back on slots that are still open. */
function restoreAssignments(store: WeStore, actor: Actor, request: LeaveRequest) {
  for (const a of [...store.assignments]) {
    if (a.statusReason !== `Approved leave ${request.id}` || a.status !== "needs_replacement") continue;
    const req = store.requirements.find((r) => r.id === a.requirementId);
    a.status = "confirmed";
    a.statusReason = undefined;
    const stillOpen = req ? requirementCoverage(req, store).filled.length <= req.count : false;
    if (stillOpen) {
      audit(store, actor, { entity: "assignment", entityId: a.id, action: "restored after leave cancelled" });
    } else {
      store.assignments.splice(store.assignments.indexOf(a), 1);
      audit(store, actor, { entity: "assignment", entityId: a.id, action: "removed (slot already filled by a replacement)" });
    }
  }
}

export async function employeeLeaveAction(actor: Actor, id: string, input: { action?: unknown; reason?: unknown }) {
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 200) : "";
  return mutate((store) => {
    const request = store.leave.find((r) => r.id === id);
    if (!request || request.employeeId !== actor.id) throw new AppError(404, "Leave request not found.");
    const now = new Date().toISOString();
    const range = formatDateRange(request.firstDay, request.lastDay);
    if (input.action === "withdraw") {
      if (request.status !== "pending") throw new AppError(409, `Only pending requests can be withdrawn. This one is ${request.status}.`);
      request.status = "withdrawn";
      request.version++;
      request.history.push({ at: now, by: actor.id, action: "withdrawn", reason });
      audit(store, actor, { entity: "leave", entityId: request.id, action: "withdrawn", reason });
      return request;
    }
    if (input.action === "cancel") {
      if (request.status !== "approved") throw new AppError(409, "Only approved leave can be cancelled.");
      if (request.cancellation) throw new AppError(409, "You’ve already asked to cancel this. The office will decide.");
      if (request.lastDay < todayKey()) throw new AppError(409, "This leave has already been taken.");
      if (reason.length < 3) throw new AppError(400, "Add a short reason for the office.");
      request.cancellation = { requestedAt: now, reason };
      request.version++;
      request.history.push({ at: now, by: actor.id, action: "cancellation requested", reason });
      audit(store, actor, { entity: "leave", entityId: request.id, action: "cancellation requested", reason });
      const employee = store.employees.find((e) => e.id === actor.id)!;
      notify(store, OFFICE_USER_IDS, "Leave cancellation requested", `${employee.name}: ${range}`, `/office/leave/${request.id}`);
      return request;
    }
    throw new AppError(400, "Unknown action.");
  });
}

export function currentBalance(store: WeStore, employee: Employee): LeaveBalance {
  return leaveBalance(employee, store.leave, leaveYearOf(todayKey(), store.settings), store.settings);
}
