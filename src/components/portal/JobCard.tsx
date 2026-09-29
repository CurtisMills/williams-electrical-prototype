import type { ReactNode } from "react";
import { Clock, KeyRound, MapPin } from "lucide-react";

const mapsHref = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Assigned job, site, planned hours and state, shown before the action. */
export function JobCard({
  refCode,
  title,
  customer,
  site,
  address,
  access,
  planned,
  badge,
  state,
  children,
  active = false,
  headingId,
  as: Heading = "h2",
}: {
  refCode?: string;
  title: string;
  customer?: string;
  site?: string;
  address?: string;
  access?: string;
  /** e.g. "08:00–16:00 · 8h planned" */
  planned?: string;
  badge?: ReactNode;
  /** Confirmed state line, e.g. "Started at 08:02". */
  state?: ReactNode;
  children?: ReactNode;
  active?: boolean;
  headingId?: string;
  as?: "h2" | "h3";
}) {
  return (
    <article
      aria-labelledby={headingId}
      className={`rounded-card border bg-surface p-5 sm:p-6 ${active ? "border-success shadow-[inset_0_0_0_1px_var(--ww-success)]" : "border-line"}`}
    >
      {(refCode || badge) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {refCode && <span className="text-label font-semibold text-muted tabular-nums">{refCode}</span>}
          {badge}
        </div>
      )}
      <Heading id={headingId} className="mt-2 text-section font-bold tracking-[-0.01em] text-ink">
        {title}
      </Heading>
      {(customer || site) && <p className="mt-0.5 text-body text-ink">{[customer, site].filter(Boolean).join(" · ")}</p>}
      {address && (
        <a
          href={mapsHref(address)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-12 items-center gap-2 py-1 text-label text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {address}
            <span className="sr-only"> (opens map)</span>
          </span>
        </a>
      )}
      {access && (
        <p className="mt-2 flex items-start gap-2 rounded-control bg-subtle p-3 text-label text-ink">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <span>
            <span className="font-semibold">Access: </span>
            {access}
          </span>
        </p>
      )}
      {planned && (
        <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-label text-ink tabular-nums">
          <Clock className="size-5 shrink-0 text-muted" aria-hidden />
          {planned}
        </p>
      )}
      {state && <div className="mt-3">{state}</div>}
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </article>
  );
}
