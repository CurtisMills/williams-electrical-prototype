import "server-only";
import { addDays, daysBetween, formatDayKey, isDateKey, isTimeKey, isoWeekday, todayKey, toMinutes, weekStartOf } from "@/lib/field/dates";
import {
  absencesOn,
  assignmentProblems,
  bankHolidayName,
  dayCapacity,
  intersects,
  leaveInterval,
  requirementCoverage,
  requirementsOn,
  roleLabel,
  type DayCapacity,
  type PlanContext,
  type RequirementCoverage,
} from "./calc";
import { AppError, audit, mutate, nextId, notify, requireRecord, type Actor } from "./store";
import type { Employee, Job, JobStatus, LeaveRequest, Requirement, StaffRole, WeStore } from "./types";

export const jobStatusLabel: Record<JobStatus, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

// ---------------------------------------------------------------- candidates and impact

export interface Candidate {
  employee: Employee;
  ok: boolean;
  problems: string[];
  warnings: string[];
  remainingMinutes: number;
}

/** Everyone of the right role, suitable people first, with the reason others can't be used. */
export function candidatesFor(ctx: PlanContext, requirement: Requirement): Candidate[] {
  return ctx.employees
    .filter((e) => e.active && e.role === requirement.role)
    .map((employee) => {
      const { problems, warnings } = assignmentProblems(ctx, employee, requirement);
      const capacity = dayCapacity(employee, requirement.date, ctx);
      return { employee, ok: problems.length === 0, problems, warnings, remainingMinutes: capacity.remainingMinutes };
    })
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.remainingMinutes - a.remainingMinutes || a.employee.name.localeCompare(b.employee.name));
}

/** What approving this leave would do: other absence, affected assignments, resulting gaps. */
export function leaveImpact(store: WeStore, request: LeaveRequest) {
  const employee = store.employees.find((e) => e.id === request.employeeId)!;
  const preview: PlanContext =
    request.status === "pending"
      ? { ...store, leave: store.leave.map((r) => (r.id === request.id ? { ...r, status: "approved" as const } : r)) }
      : store;

  const otherAbsence = request.days.flatMap((d) =>
    store.employees
      .filter((e) => e.id !== employee.id)
      .flatMap((e) =>
        absencesOn(e, d.date, store, true).map((a) => ({ date: d.date, employee: e, label: a.label, kind: a.kind })),
      ),
  );

  const affected = store.assignments
    .filter((a) => {
      if (a.employeeId !== employee.id) return false;
      const d = request.days.find((x) => x.date === a.date);
      return !!d && intersects(leaveInterval(d.portion, employee), [toMinutes(a.start), toMinutes(a.end)]);
    })
    .map((a) => {
      const requirement = store.requirements.find((r) => r.id === a.requirementId)!;
      const after = requirementCoverage(requirement, preview);
      return {
        assignment: a,
        job: store.jobs.find((j) => j.id === a.jobId)!,
        requirement,
        unfilledAfter: after.unfilled,
        candidates: candidatesFor(preview, requirement).filter((c) => c.ok),
      };
    });

  const sameRoleOffByDate = request.days.map((d) => {
    const others = otherAbsence.filter((o) => o.date === d.date && o.employee.role === employee.role && o.kind !== "pending_leave");
    const total = store.employees.filter((e) => e.active && e.role === employee.role).length;
    return { date: d.date, off: others.length + 1, total };
  });

  return { employee, otherAbsence, affected, sameRoleOffByDate };
}

// ---------------------------------------------------------------- planning views

export interface PlanningDay {
  date: string;
  holiday: string | null;
  required: number;
  filled: number;
  unfilled: number;
  unfilledIfPending: number;
  tentativeRequired: number;
}

export interface PlanningRow {
  employee: Employee;
  days: (DayCapacity & { chips: { ref: string; jobId: string; start: string; end: string; status: string; tentative: boolean }[] })[];
  weeks: { weekStart: string; pattern: number; leave: number; other: number; usable: number; assigned: number; remaining: number; overloaded: boolean }[];
}

export function planningView(store: WeStore, from: string, weeks: number, includePreview: boolean) {
  const start = weekStartOf(from);
  const dates = daysBetween(start, addDays(start, weeks * 7 - 1));
  const workdays = dates.filter((d) => isoWeekday(d) <= 5);

  const rows: PlanningRow[] = store.employees
    .filter((e) => e.active)
    .map((employee) => {
      const days = workdays.map((date) => {
        const cap = dayCapacity(employee, date, store, includePreview);
        return {
          ...cap,
          chips: cap.assignments
            .map((a) => {
              const job = store.jobs.find((j) => j.id === a.jobId)!;
              return { ref: job.ref, jobId: job.id, start: a.start, end: a.end, status: a.status, tentative: job.status === "tentative" };
            })
            .filter((c) => includePreview || !c.tentative)
            .sort((a, b) => a.start.localeCompare(b.start)),
        };
      });
      const weekStarts = [...new Set(workdays.map(weekStartOf))];
      return {
        employee,
        days,
        weeks: weekStarts.map((weekStart) => {
          const inWeek = days.filter((d) => weekStartOf(d.date) === weekStart);
          const sum = (k: keyof DayCapacity) => inWeek.reduce((n, d) => n + (d[k] as number), 0);
          return {
            weekStart,
            pattern: sum("patternMinutes"),
            leave: sum("leaveMinutes"),
            other: sum("otherMinutes"),
            usable: sum("usableMinutes"),
            assigned: sum("assignedMinutes"),
            remaining: sum("remainingMinutes"),
            overloaded: inWeek.some((d) => d.assignedMinutes > d.usableMinutes),
          };
        }),
      };
    });

  const coverage: RequirementCoverage[] = workdays.flatMap((date) =>
    requirementsOn(store, date, true).map((r) => requirementCoverage(r, store)),
  );

  const days: PlanningDay[] = workdays.map((date) => {
    const onDate = coverage.filter((c) => c.requirement.date === date);
    const confirmed = onDate.filter((c) => c.job.status !== "tentative");
    const tentative = onDate.filter((c) => c.job.status === "tentative");
    return {
      date,
      holiday: bankHolidayName(date, store.settings),
      required: confirmed.reduce((n, c) => n + c.requirement.count, 0),
      filled: confirmed.reduce((n, c) => n + c.filled.length, 0),
      unfilled: confirmed.reduce((n, c) => n + c.unfilled, 0),
      unfilledIfPending: confirmed.reduce((n, c) => n + c.unfilledIfPendingApproved, 0),
      tentativeRequired: tentative.reduce((n, c) => n + c.unfilled, 0),
    };
  });

  const gaps = coverage.filter((c) => c.unfilled > 0 && (includePreview || c.job.status !== "tentative"));
  return { start, dates: workdays, rows, days, coverage, gaps };
}

export function jobPlan(store: WeStore, jobId: string, from = todayKey()) {
  const job = requireRecord(store.jobs.find((j) => j.id === jobId), "Job");
  const requirements = store.requirements
    .filter((r) => r.jobId === jobId && r.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date) || a.role.localeCompare(b.role) || a.start.localeCompare(b.start));
  return {
    job,
    site: store.sites.find((s) => s.id === job.siteId)!,
    customer: store.customers.find((c) => c.id === job.customerId)!,
    rows: requirements.map((r) => {
      const coverage = requirementCoverage(r, store);
      const open = coverage.unfilled > 0;
      return { coverage, candidates: open ? candidatesFor(store, r) : [] };
    }),
  };
}

// ---------------------------------------------------------------- actions

function assignIn(store: WeStore, actor: Actor, requirement: Requirement, employee: Employee) {
  const { problems } = assignmentProblems(store, employee, requirement);
  if (problems.length) return { ok: false as const, problems };
  const now = new Date().toISOString();
  // A replacement closes out the assignment that needed replacing.
  const replaced = store.assignments.find((a) => a.requirementId === requirement.id && a.status === "needs_replacement");
  if (replaced) {
    store.assignments.splice(store.assignments.indexOf(replaced), 1);
    audit(store, actor, { entity: "assignment", entityId: replaced.id, action: `replaced by ${employee.name}`, before: replaced });
  }
  const assignment = {
    id: nextId(store, "A"),
    jobId: requirement.jobId,
    requirementId: requirement.id,
    employeeId: employee.id,
    date: requirement.date,
    start: requirement.start,
    end: requirement.end,
    status: "confirmed" as const,
    createdAt: now,
    createdBy: actor.id,
  };
  store.assignments.push(assignment);
  audit(store, actor, { entity: "assignment", entityId: assignment.id, action: "assigned", after: assignment });
  return { ok: true as const, assignment };
}

export async function assign(actor: Actor, input: { requirementId?: unknown; employeeId?: unknown }) {
  return mutate((store) => {
    const requirement = requireRecord(store.requirements.find((r) => r.id === input.requirementId), "Staffing requirement");
    const employee = requireRecord(store.employees.find((e) => e.id === input.employeeId), "Employee");
    const result = assignIn(store, actor, requirement, employee);
    if (!result.ok) throw new AppError(409, `Not saved. ${result.problems.join(" ")}`);
    const job = store.jobs.find((j) => j.id === requirement.jobId)!;
    notify(store, [employee.id], "New assignment", `${job.ref} ${job.title} on ${formatDayKey(requirement.date)}, ${requirement.start}–${requirement.end}.`, "/field");
    return result.assignment;
  });
}

/** Copy a person onto every open slot of one role on a job, running the same checks each day. */
export async function assignAcross(
  actor: Actor,
  input: { jobId?: unknown; role?: unknown; employeeId?: unknown; from?: unknown; to?: unknown },
) {
  if (!isDateKey(input.from) || !isDateKey(input.to) || input.to < input.from) throw new AppError(400, "Choose a valid date range.");
  const from = input.from;
  const to = input.to;
  return mutate((store) => {
    const employee = requireRecord(store.employees.find((e) => e.id === input.employeeId), "Employee");
    const job = requireRecord(store.jobs.find((j) => j.id === input.jobId), "Job");
    const targets = store.requirements.filter(
      (r) => r.jobId === job.id && r.role === input.role && r.date >= from && r.date <= to && requirementCoverage(r, store).unfilled > 0,
    );
    const assigned: string[] = [];
    const skipped: { date: string; reason: string }[] = [];
    for (const r of targets) {
      const result = assignIn(store, actor, r, employee);
      if (result.ok) assigned.push(r.date);
      else skipped.push({ date: r.date, reason: result.problems[0] });
    }
    if (assigned.length) {
      notify(store, [employee.id], "New assignments", `${job.ref} ${job.title}: ${assigned.length} day(s) added to your schedule.`, "/field");
    }
    return { assigned, skipped };
  });
}

export async function unassign(actor: Actor, input: { assignmentId?: unknown; reason?: unknown }) {
  return mutate((store) => {
    const a = requireRecord(store.assignments.find((x) => x.id === input.assignmentId), "Assignment");
    store.assignments.splice(store.assignments.indexOf(a), 1);
    audit(store, actor, { entity: "assignment", entityId: a.id, action: "unassigned", before: a, reason: String(input.reason ?? "") });
    const job = store.jobs.find((j) => j.id === a.jobId)!;
    if (a.date >= todayKey()) {
      notify(store, [a.employeeId], "Assignment removed", `${job.ref} on ${formatDayKey(a.date)} is no longer on your schedule.`, "/field");
    }
    return { ok: true };
  });
}

export async function addRequirements(
  actor: Actor,
  input: { jobId?: unknown; from?: unknown; to?: unknown; role?: unknown; count?: unknown; start?: unknown; end?: unknown },
) {
  if (!isDateKey(input.from) || !isDateKey(input.to) || input.to < input.from) throw new AppError(400, "Choose a valid date range.");
  if (input.role !== "electrician" && input.role !== "apprentice") throw new AppError(400, "Choose electrician or apprentice.");
  const count = Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new AppError(400, "Enter how many people, from 1 to 10.");
  if (!isTimeKey(input.start) || !isTimeKey(input.end) || input.end <= input.start) throw new AppError(400, "Enter start and end times, end after start.");
  const from = input.from;
  const to = input.to;
  const role = input.role as StaffRole;
  const start = input.start;
  const end = input.end;
  return mutate((store) => {
    const job = requireRecord(store.jobs.find((j) => j.id === input.jobId), "Job");
    if (job.status === "cancelled" || job.status === "archived") throw new AppError(409, `${job.ref} is ${job.status}. Reopen it first.`);
    const dates = daysBetween(from, to).filter((d) => isoWeekday(d) <= 5 && !bankHolidayName(d, store.settings));
    if (dates.length === 0) throw new AppError(400, "That range has no working days.");
    let created = 0;
    let updated = 0;
    for (const date of dates) {
      const existing = store.requirements.find((r) => r.jobId === job.id && r.date === date && r.role === role && r.start === start && r.end === end);
      if (existing) {
        existing.count = count;
        updated++;
      } else {
        store.requirements.push({ id: nextId(store, "R"), jobId: job.id, date, role, count, start, end });
        created++;
      }
    }
    if (dates[0] < job.startDate) job.startDate = dates[0];
    if (dates[dates.length - 1] > job.endDate) job.endDate = dates[dates.length - 1];
    audit(store, actor, {
      entity: "requirement",
      entityId: job.id,
      action: "staffing requirement set",
      after: { from, to, role, count, start, end, days: dates.length },
    });
    return { created, updated, label: `${count} × ${roleLabel[role].toLowerCase()} on ${dates.length} day(s)` };
  });
}

export async function removeRequirement(actor: Actor, input: { requirementId?: unknown }) {
  return mutate((store) => {
    const r = requireRecord(store.requirements.find((x) => x.id === input.requirementId), "Staffing requirement");
    if (store.assignments.some((a) => a.requirementId === r.id)) throw new AppError(409, "Unassign the people on this slot first.");
    store.requirements.splice(store.requirements.indexOf(r), 1);
    audit(store, actor, { entity: "requirement", entityId: r.id, action: "removed", before: r });
    return { ok: true };
  });
}

export async function createJob(
  actor: Actor,
  input: { customerId?: unknown; siteId?: unknown; title?: unknown; type?: unknown; status?: unknown; startDate?: unknown; endDate?: unknown; plannedHours?: unknown },
) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 80) : "";
  if (title.length < 3) throw new AppError(400, "Give the job a title.");
  if (!isDateKey(input.startDate) || !isDateKey(input.endDate) || input.endDate < input.startDate) throw new AppError(400, "Enter valid start and end dates.");
  const status = input.status === "tentative" ? "tentative" : "confirmed";
  const plannedHours = Math.max(0, Math.round(Number(input.plannedHours) || 0));
  const startDate = input.startDate;
  const endDate = input.endDate;
  return mutate((store) => {
    const site = requireRecord(store.sites.find((s) => s.id === input.siteId), "Site");
    if (site.customerId !== input.customerId) throw new AppError(400, "That site belongs to a different customer.");
    const n = (store.counters.J = (store.counters.J ?? 2053) + 1);
    const job: Job = {
      id: `job-${n}`,
      ref: `WE-${n}`,
      customerId: site.customerId,
      siteId: site.id,
      title,
      type: typeof input.type === "string" && input.type.trim() ? input.type.trim().slice(0, 30) : "Installation",
      status,
      startDate,
      endDate,
      plannedHours,
    };
    store.jobs.push(job);
    audit(store, actor, { entity: "job", entityId: job.id, action: "created", after: job });
    return job;
  });
}

export async function setJobStatus(actor: Actor, input: { jobId?: unknown; status?: unknown; reason?: unknown }) {
  const status = input.status as JobStatus;
  if (!Object.keys(jobStatusLabel).includes(status)) throw new AppError(400, "Unknown job status.");
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 200) : "";
  return mutate((store) => {
    const job = requireRecord(store.jobs.find((j) => j.id === input.jobId), "Job");
    if ((job.status === "cancelled" || job.status === "archived") && reason.length < 5) {
      throw new AppError(400, "Give a reason for reopening this job.");
    }
    const before = job.status;
    job.status = status;
    audit(store, actor, { entity: "job", entityId: job.id, action: `status ${before} → ${status}`, reason });
    return job;
  });
}

export async function createSite(
  actor: Actor,
  input: { customerId?: unknown; customerName?: unknown; name?: unknown; address?: unknown; contactName?: unknown; contactPhone?: unknown; access?: unknown },
) {
  const text = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = text(input.name, 80);
  const address = text(input.address);
  if (name.length < 3 || address.length < 5) throw new AppError(400, "Enter the site name and address.");
  return mutate((store) => {
    let customerId = String(input.customerId ?? "");
    if (customerId === "new") {
      const customerName = text(input.customerName, 80);
      if (customerName.length < 3) throw new AppError(400, "Enter the new customer’s name.");
      const n = store.customers.length + 1;
      customerId = `cus-${nextId(store, "CUS").toLowerCase()}`;
      store.customers.push({ id: customerId, ref: `CUS-${String(n).padStart(2, "0")}`, name: customerName, contact: "" });
      audit(store, actor, { entity: "job", entityId: customerId, action: "customer created", after: { name: customerName } });
    }
    requireRecord(store.customers.find((c) => c.id === customerId), "Customer");
    const site = {
      id: `site-${nextId(store, "SITE").toLowerCase()}`,
      ref: `SITE-${String(store.sites.length + 1).padStart(2, "0")}`,
      customerId,
      name,
      address,
      contactName: text(input.contactName, 60),
      contactPhone: text(input.contactPhone, 30),
      access: text(input.access, 300),
    };
    store.sites.push(site);
    audit(store, actor, { entity: "job", entityId: site.id, action: "site created", after: site });
    return site;
  });
}
