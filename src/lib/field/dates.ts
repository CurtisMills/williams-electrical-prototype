// Date helpers shared by server and client. Everything is pinned to UK time so server
// rendering and the browser agree regardless of where either runs.

export const TIME_ZONE = "Europe/London";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const d = parseKey(value);
  return d.toISOString().slice(0, 10) === value;
}

/** Date keys are treated as UTC midnight internally so arithmetic ignores DST. */
function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: string, count: number): string {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(key: string): boolean {
  const day = parseKey(key).getUTCDay();
  return day === 0 || day === 6;
}

/** Inclusive count of Monday–Friday dates. Bank holidays are not excluded in this prototype. */
export function countWorkingDays(first: string, last: string): number {
  if (!isDateKey(first) || !isDateKey(last) || last < first) return 0;
  let n = 0;
  for (let key = first, guard = 0; key <= last && guard < 800; key = addDays(key, 1), guard++) {
    if (!isWeekend(key)) n++;
  }
  return n;
}

export function rangesOverlap(aFirst: string, aLast: string, bFirst: string, bLast: string) {
  return aFirst <= bLast && bFirst <= aLast;
}

const dayStyles = {
  short: { weekday: "short", day: "numeric", month: "short" },
  long: { day: "numeric", month: "short", year: "numeric" },
  full: { weekday: "long", day: "numeric", month: "long" },
  weekday: { weekday: "long" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDayKey(key: string, style: keyof typeof dayStyles = "short"): string {
  const options: Intl.DateTimeFormatOptions = dayStyles[style];
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(parseKey(key));
}

export function formatDateRange(first: string, last: string): string {
  return first === last
    ? formatDayKey(first, "long")
    : `${formatDayKey(first, "short")} – ${formatDayKey(last, "long")}`;
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

export function ukHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now),
  );
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
