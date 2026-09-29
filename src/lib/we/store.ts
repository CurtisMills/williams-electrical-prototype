import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSeed } from "./seed";
import type { AuditEntry, WeStore } from "./types";

// Lightest persistent option for the prototype: one JSON file on the server shared by the
// employee app and the office. Replace with a database without changing the domain modules.
const DATA_DIR = process.env.FIELD_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "we-store.json");

export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export interface Actor {
  id: string;
  name: string;
  role: "engineer" | "office";
}

export const OFFICE_USER_IDS = ["office-megan", "office-gareth"];

async function readFromDisk(): Promise<WeStore | null> {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf8")) as WeStore;
    if (parsed?.version === 2 && Array.isArray(parsed.sessions)) return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.warn("Store unreadable, reseeding demo data", err);
  }
  return null;
}

// Layout and page render in parallel; only one of them may seed a missing store.
let seeding: Promise<WeStore> | null = null;

async function load(): Promise<WeStore> {
  const existing = await readFromDisk();
  if (existing) return existing;
  seeding ??= (async () => {
    const store = buildSeed();
    await save(store);
    return store;
  })().finally(() => {
    seeding = null;
  });
  return structuredClone(await seeding);
}

let saveCount = 0;

async function save(store: WeStore) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.${++saveCount}.tmp`;
  await writeFile(tmp, JSON.stringify(store));
  await rename(tmp, DATA_FILE);
}

// Serialise read-modify-write so double taps and simultaneous office actions are applied one
// at a time; each action re-checks state inside the queue before changing anything.
let queue: Promise<unknown> = Promise.resolve();

export function mutate<T>(fn: (store: WeStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const store = await load();
    const result = await fn(store);
    await save(store);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function readStore(): Promise<WeStore> {
  await queue;
  return load();
}

export async function resetStore() {
  await mutate((store) => {
    Object.assign(store, buildSeed());
  });
}

export function nextId(store: WeStore, prefix: string) {
  store.counters[prefix] = (store.counters[prefix] ?? 0) + 1;
  return `${prefix}-${store.counters[prefix]}`;
}

export function audit(
  store: WeStore,
  actor: Actor,
  entry: Pick<AuditEntry, "entity" | "entityId" | "action"> & Partial<Pick<AuditEntry, "before" | "after" | "reason">>,
) {
  store.audit.push({
    id: nextId(store, "AU"),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    before: null,
    after: null,
    reason: "",
    ...entry,
  });
}

export function notify(store: WeStore, userIds: string[], title: string, body: string, href: string) {
  const at = new Date().toISOString();
  for (const userId of userIds) {
    store.notifications.push({ id: nextId(store, "N"), userId, at, title, body, href, read: false });
  }
}

export function expectVersion(current: number, expected: unknown, what: string) {
  if (expected !== undefined && expected !== null && Number(expected) !== current) {
    throw new AppError(409, `This ${what} was changed by someone else a moment ago. The page has been refreshed; check it and try again.`);
  }
}

export function requireRecord<T>(value: T | undefined, what: string): T {
  if (!value) throw new AppError(404, `${what} not found.`);
  return value;
}
