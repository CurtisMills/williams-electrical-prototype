import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { addDays, countWorkingDays, isDateKey, isWeekend, rangesOverlap, todayKey } from "./dates";
import { SAMPLE_ENGINEERS, getAssignedJobs, seedHolidayRequests } from "./sample-data";
import type { AssignedJob, Engineer, FieldStore, HolidayRequest, HolidayStatus, TimeLog } from "./types";

// Lightest persistent option for the prototype: a JSON file on the server, shared by the
// engineer and office views. Replace with a database without changing the exported functions.
const DATA_DIR = process.env.FIELD_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "field-store.json");

export const MAX_HOLIDAY_WORKING_DAYS = 15;

export class FieldError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

function freshStore(): FieldStore {
  return { version: 1, timeLogs: [], holidayRequests: seedHolidayRequests() };
}

async function load(): Promise<FieldStore> {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf8")) as FieldStore;
    if (parsed?.version === 1 && Array.isArray(parsed.timeLogs) && Array.isArray(parsed.holidayRequests)) {
      return parsed;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.warn("Field store unreadable, reseeding", err);
  }
  const store = freshStore();
  await save(store);
  return store;
}

async function save(store: FieldStore) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2));
  await rename(tmp, DATA_FILE);
}

// Serialise read-modify-write so double taps can't both pass the duplicate checks.
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (store: FieldStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const store = await load();
    const result = await fn(store);
    await save(store);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<FieldStore> {
  await queue;
  return load();
}

export function listEngineers() {
  return SAMPLE_ENGINEERS;
}

export function getEngineer(id: string) {
  return SAMPLE_ENGINEERS.find((e) => e.id === id);
}

// ---- Job time ----

export async function getEngineerDay(engineerId: string, date = todayKey()) {
  const [jobs, store] = await Promise.all([getAssignedJobs(engineerId, date), read()]);
  const jobIds = new Set(jobs.map((j) => j.id));
  const logs = store.timeLogs.filter((l) => l.engineerId === engineerId && jobIds.has(l.jobId));
  const activeLog = store.timeLogs.find((l) => l.engineerId === engineerId && !l.finishedAt) ?? null;
  return { date, jobs, logs, activeLog };
}

async function requireTodaysJob(engineerId: string, jobId: string) {
  const jobs = await getAssignedJobs(engineerId, todayKey());
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new FieldError(404, "That job isn't assigned to you today.");
  return job;
}

export async function startJob(engineerId: string, jobId: string): Promise<TimeLog> {
  const job = await requireTodaysJob(engineerId, jobId);
  return mutate((store) => {
    const existing = store.timeLogs.find((l) => l.jobId === job.id && l.engineerId === engineerId);
    if (existing) {
      throw new FieldError(
        409,
        existing.finishedAt ? "This job has already been finished." : "This job has already been started.",
      );
    }
    const active = store.timeLogs.find((l) => l.engineerId === engineerId && !l.finishedAt);
    if (active) throw new FieldError(409, "Finish your current job before starting another.");

    const log: TimeLog = {
      id: randomUUID(),
      jobId: job.id,
      jobReference: job.reference,
      jobName: job.name,
      engineerId,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    store.timeLogs.push(log);
    return log;
  });
}

// Finishing only needs the engineer's own log, so a job left open yesterday can still be closed.
export async function finishJob(engineerId: string, jobId: string): Promise<TimeLog> {
  return mutate((store) => {
    const log = store.timeLogs.find((l) => l.jobId === jobId && l.engineerId === engineerId);
    if (!log) throw new FieldError(409, "Start this job before finishing it.");
    if (log.finishedAt) throw new FieldError(409, "This job has already been finished.");
    log.finishedAt = new Date().toISOString();
    return log;
  });
}

export type EngineerDayStatus = "on_leave" | "on_site" | "between_jobs" | "finished" | "not_started" | "no_jobs";

export interface TeamMemberDay {
  engineer: Engineer;
  status: EngineerDayStatus;
  jobs: { job: AssignedJob; log: TimeLog | null }[];
  activeLog: TimeLog | null;
}

export async function getTeamDay(date = todayKey()): Promise<TeamMemberDay[]> {
  const store = await read();
  return Promise.all(
    SAMPLE_ENGINEERS.map(async (engineer) => {
      const assigned = await getAssignedJobs(engineer.id, date);
      const jobs = assigned.map((job) => ({
        job,
        log: store.timeLogs.find((l) => l.jobId === job.id && l.engineerId === engineer.id) ?? null,
      }));
      const activeLog = store.timeLogs.find((l) => l.engineerId === engineer.id && !l.finishedAt) ?? null;
      const onLeave = store.holidayRequests.some(
        (r) => r.engineerId === engineer.id && r.status === "approved" && r.firstDay <= date && r.lastDay >= date,
      );
      const finishedCount = jobs.filter((j) => j.log?.finishedAt).length;
      const status: EngineerDayStatus = activeLog
        ? "on_site"
        : onLeave
          ? "on_leave"
          : jobs.length === 0
            ? "no_jobs"
            : finishedCount === jobs.length
              ? "finished"
              : finishedCount > 0
                ? "between_jobs"
                : "not_started";
      return { engineer, status, jobs, activeLog };
    }),
  );
}

export async function countActiveJobs(): Promise<number> {
  const store = await read();
  return store.timeLogs.filter((l) => !l.finishedAt).length;
}

// ---- Holiday ----

export async function listHolidayRequests(filter?: { engineerId?: string; status?: HolidayStatus }) {
  const store = await read();
  return store.holidayRequests
    .filter((r) => (!filter?.engineerId || r.engineerId === filter.engineerId) && (!filter?.status || r.status === filter.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.firstDay.localeCompare(b.firstDay));
}

export function validateHolidayDates(firstDay: unknown, lastDay: unknown, today = todayKey()): string | null {
  if (!isDateKey(firstDay) || !isDateKey(lastDay)) return "Choose the first and last day off.";
  if (firstDay < today) return "Choose a first day from today onward.";
  if (lastDay < firstDay) return "The last day must be on or after the first day.";
  const days = countWorkingDays(firstDay, lastDay);
  if (days === 0) return "Choose at least one working day (weekends are excluded).";
  if (days > MAX_HOLIDAY_WORKING_DAYS) return `You can request up to ${MAX_HOLIDAY_WORKING_DAYS} working days at a time.`;
  return null;
}

export async function createHolidayRequest(
  engineerId: string,
  input: { firstDay?: unknown; lastDay?: unknown; note?: unknown },
): Promise<HolidayRequest> {
  const error = validateHolidayDates(input.firstDay, input.lastDay);
  if (error) throw new FieldError(400, error);
  const firstDay = input.firstDay as string;
  const lastDay = input.lastDay as string;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 160) : "";

  return mutate((store) => {
    const clash = store.holidayRequests.find(
      (r) =>
        r.engineerId === engineerId &&
        r.status !== "declined" &&
        rangesOverlap(r.firstDay, r.lastDay, firstDay, lastDay),
    );
    if (clash) throw new FieldError(409, `These dates overlap a request that is already ${clash.status}.`);

    const request: HolidayRequest = {
      id: randomUUID(),
      engineerId,
      firstDay,
      lastDay,
      workingDays: countWorkingDays(firstDay, lastDay),
      note,
      status: "pending",
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    store.holidayRequests.push(request);
    return request;
  });
}

export async function decideHolidayRequest(id: string, decision: unknown): Promise<HolidayRequest> {
  if (decision !== "approved" && decision !== "declined") {
    throw new FieldError(400, "Decision must be approved or declined.");
  }
  return mutate((store) => {
    const request = store.holidayRequests.find((r) => r.id === id);
    if (!request) throw new FieldError(404, "Holiday request not found.");
    if (request.status !== "pending") throw new FieldError(409, `This request was already ${request.status}.`);
    request.status = decision;
    request.decidedAt = new Date().toISOString();
    return request;
  });
}

// ---- Availability ----

export interface AvailabilityDay {
  date: string;
  totalCrew: number;
  approvedLeave: string[];
  available: number;
  pendingLeave: string[];
  /** Crew available if every pending request on this date were approved. */
  availableIfApproved: number;
}

export async function getAvailability(options: { workingDays?: number } = {}): Promise<AvailabilityDay[]> {
  const { workingDays = 10 } = options;
  const store = await read();
  const today = todayKey();
  const crew = SAMPLE_ENGINEERS;
  const nameOf = (id: string) => getEngineer(id)?.name ?? "Unknown engineer";

  const dates = new Set<string>();
  for (let key = today, added = 0, guard = 0; added < workingDays && guard < 60; key = addDays(key, 1), guard++) {
    if (!isWeekend(key)) {
      dates.add(key);
      added++;
    }
  }
  // Always surface dates touched by open requests, even beyond the default window.
  for (const r of store.holidayRequests) {
    if (r.status === "declined" || r.lastDay < today) continue;
    for (let key = r.firstDay < today ? today : r.firstDay, guard = 0; key <= r.lastDay && guard < 60; key = addDays(key, 1), guard++) {
      if (!isWeekend(key)) dates.add(key);
    }
  }

  return [...dates].sort().map((date) => {
    const onDate = (status: HolidayStatus) =>
      store.holidayRequests.filter((r) => r.status === status && r.firstDay <= date && r.lastDay >= date);
    const approvedIds = new Set(onDate("approved").map((r) => r.engineerId));
    const pendingIds = new Set(onDate("pending").map((r) => r.engineerId).filter((id) => !approvedIds.has(id)));
    const available = Math.max(0, crew.length - approvedIds.size);
    return {
      date,
      totalCrew: crew.length,
      approvedLeave: [...approvedIds].map(nameOf),
      available,
      pendingLeave: [...pendingIds].map(nameOf),
      availableIfApproved: Math.max(0, available - pendingIds.size),
    };
  });
}

// ---- Demo ----

export async function resetFieldStore() {
  await mutate((store) => {
    const fresh = freshStore();
    store.timeLogs = fresh.timeLogs;
    store.holidayRequests = fresh.holidayRequests;
  });
}
