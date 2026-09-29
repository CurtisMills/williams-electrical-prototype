import Link from "next/link";
import { AlertTriangle, ChevronRight, HelpCircle, Users } from "lucide-react";
import { summariseAvailability, type DayAvailability } from "@/lib/we/present";

/**
 * Confirmed crew availability for a set of days, leading with the strongest constraint.
 * A planning aid: low cover is a warning, never a block.
 */
export function AvailabilitySummary({
  days,
  role,
  condition = "If approved",
  inspectHref,
  compact = false,
}: {
  days: DayAvailability[];
  /** Plural role name, e.g. "electricians". */
  role: string;
  condition?: string;
  inspectHref?: (date: string) => string;
  compact?: boolean;
}) {
  const s = summariseAvailability(days);

  if (s.status === "unknown" || !s.weakest) {
    return (
      <p className="inline-flex items-center gap-2 rounded-control bg-subtle px-3 py-2 text-label text-ink">
        <HelpCircle className="size-4 shrink-0 text-muted" aria-hidden />
        Crew availability: Not available
      </p>
    );
  }

  const w = s.weakest;
  const headline = s.sameAcrossDays
    ? `${condition}: ${w.available} of ${w.total} ${role} available${s.days.length > 1 ? ` on ${s.days.length === 2 ? "both" : `all ${s.days.length}`} days` : ` on ${w.label}`}`
    : `${condition}: lowest cover ${w.label}, ${w.available} of ${w.total} ${role} available`;
  const low = s.status === "low";

  const summary = (
    <p className={`inline-flex items-start gap-2 rounded-control px-3 py-2 text-label ${low ? "bg-warning-surface text-ink" : "bg-info-surface text-ink"}`}>
      {low ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> : <Users className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />}
      <span>
        {low && <span className="font-bold text-warning">Low cover. </span>}
        {headline}.
      </span>
    </p>
  );

  if (compact) return summary;

  return (
    <div>
      {summary}
      {low && <p className="mt-2 text-label text-muted">This is a planning aid, not a block. You can still approve.</p>}
      <ul className="mt-4 divide-y divide-line rounded-card border border-line">
        {s.days.map((d) => (
          <li key={d.date} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
            <span className="min-w-0">
              <span className="block font-semibold">{d.label}</span>
              <span className={`text-label tabular-nums ${d.low ? "font-semibold text-warning" : "text-muted"}`}>
                {d.available} of {d.total} {role} available{d.low && " · low cover"}
                {d.date === w.date && !s.sameAcrossDays && " · strongest constraint"}
              </span>
            </span>
            {inspectHref && (
              <Link href={inspectHref(d.date)} className="inline-flex min-h-12 items-center gap-1 text-label font-bold text-primary hover:underline">
                View day <span className="sr-only">{d.label} in the crew plan</span>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
