// Date helpers shared by server and client. Everything is pinned to UK time so server
// rendering and the browser agree regardless of where either runs.

export const TIME_ZONE = "Europe/London";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** London calendar date of an instant. */
export const dateKeyOf = (iso: string) => todayKey(new Date(iso));

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const d = parseKey(value);
  return d.toISOString().slice(0, 10) === value;
}

export const isTimeKey = (value: unknown): value is string => typeof value === "string" && TIME_KEY.test(value);

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

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: string): number {
  const day = parseKey(key).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isWeekend(key: string): boolean {
  return isoWeekday(key) >= 6;
}

/** Monday of the week containing `key` (weeks run Monday to Sunday). */
export const weekStartOf = (key: string) => addDays(key, 1 - isoWeekday(key));

export function daysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let key = first, guard = 0; key <= last && guard < 800; key = addDays(key, 1), guard++) out.push(key);
  return out;
}

/** Inclusive count of Monday–Friday dates. */
export function countWorkingDays(first: string, last: string): number {
  if (!isDateKey(first) || !isDateKey(last) || last < first) return 0;
  return daysBetween(first, last).filter((k) => !isWeekend(k)).length;
}

export function rangesOverlap(aFirst: string, aLast: string, bFirst: string, bLast: string) {
  return aFirst <= bLast && bFirst <= aLast;
}

function londonOffsetMinutes(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant) / 60000);
}

/** London wall-clock date and time to a UTC ISO instant (handles BST changes). */
export function londonIso(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let instant = guess - londonOffsetMinutes(guess) * 60000;
  instant = guess - londonOffsetMinutes(instant) * 60000;
  return new Date(instant).toISOString();
}

/** Minutes past London midnight, as "HH:mm". */
export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** e.g. "2026-09-29T07:45:00+01:00" – the local time with its UTC offset, for exports. */
export function formatIsoWithOffset(iso: string): string {
  const instant = Date.parse(iso);
  const offset = londonOffsetMinutes(instant);
  const local = new Date(instant + offset * 60000).toISOString().slice(0, 19);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const dayStyles = {
  short: { weekday: "short", day: "numeric", month: "short" },
  long: { day: "numeric", month: "short", year: "numeric" },
  full: { weekday: "long", day: "numeric", month: "long" },
  weekday: { weekday: "long" },
  dow: { weekday: "short" },
  dm: { day: "numeric", month: "short" },
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

/** "Tue 29 Sep, 07:45" */
export const formatWhen = (iso: string) => `${formatDayKey(dateKeyOf(iso))}, ${formatClock(iso)}`;

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
}

/** Hours and minutes, never rounded: 495 → "8h 15m". */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h ? `${sign}${h}h ${String(m).padStart(2, "0")}m` : `${sign}${m}m`;
}

/** 495 → "8.25". Two decimal places; minutes remain the exact value. */
export const decimalHours = (minutes: number) => (minutes / 60).toFixed(2);

export function timeAgo(iso: string, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return formatWhen(iso);
}

export function ukHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now),
  );
}

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Leave days can be halves: 1.5 → "1.5 days", 1 → "1 day". */
export const dayCount = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;
