// Presentation helpers shared by the employee and office screens. No storage access, so they can be tested directly.

/** The job the employee should see first: the one they're recording, else the next planned job with nothing recorded yet. */
export function pickFocusJob<T extends { jobId: string; recorded: readonly string[] }>(planned: readonly T[], activeJobId: string | null): T | null {
  if (activeJobId) return planned.find((p) => p.jobId === activeJobId) ?? null;
  return planned.find((p) => p.recorded.length === 0) ?? null;
}

export interface DayAvailability {
  date: string;
  label: string;
  /** People of the relevant role still available that day, after absences (and the request being reviewed). */
  available: number;
  total: number;
}

export interface AvailabilitySummaryResult {
  /** "unknown" when any day's crew size can't be worked out; show "Not available" instead of a number. */
  status: "ok" | "low" | "unknown";
  weakest: (DayAvailability & { low: boolean }) | null;
  sameAcrossDays: boolean;
  days: (DayAvailability & { low: boolean })[];
}

/** Same threshold the leave review already highlighted: 40% or more of the role off is low cover. It is a warning, not a block. */
export const LOW_COVER_SHARE = 0.6;

export function summariseAvailability(days: readonly DayAvailability[]): AvailabilitySummaryResult {
  if (days.length === 0 || days.some((d) => !Number.isFinite(d.total) || d.total <= 0 || !Number.isFinite(d.available))) {
    return { status: "unknown", weakest: null, sameAcrossDays: false, days: [] };
  }
  const marked = days.map((d) => {
    const available = Math.max(0, Math.min(d.total, d.available));
    return { ...d, available, low: available / d.total <= LOW_COVER_SHARE };
  });
  const weakest = marked.reduce((w, d) => (d.available / d.total < w.available / w.total ? d : w));
  const sameAcrossDays = marked.every((d) => d.available === weakest.available && d.total === weakest.total);
  return { status: weakest.low ? "low" : "ok", weakest, sameAcrossDays, days: marked };
}

/** Absence labels from the domain layer say "leave"; the portal's current booking scope is holiday. */
export function holidayWording(label: string): string {
  return label.replace(/\bleave\b/g, "holiday").replace(/\bLeave\b/g, "Holiday");
}

/** Holiday balance only when it can be shown honestly. */
export function formatBalance(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
