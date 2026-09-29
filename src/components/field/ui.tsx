import type { ReactNode } from "react";
import type { LeaveStatus, TimesheetStatus } from "@/lib/we/types";

export function FieldBrand({
  size = "md",
  tone = "light",
  className,
}: {
  size?: "md" | "lg";
  tone?: "light" | "dark";
  className?: string;
}) {
  const sizeClass = size === "lg" ? "h-24 w-auto self-center sm:h-32" : "h-20 w-auto self-center";
  return (
    <img
      src={tone === "light" ? "/logo-light.png" : "/logo.png"}
      alt="Williams Electrical (Cymru) Ltd"
      width={999}
      height={431}
      className={`block max-w-full ${className ?? sizeClass}`}
    />
  );
}

export function Avatar({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8dfe0] text-xs font-extrabold text-signal-800 ${className}`}
    >
      {initials}
    </span>
  );
}

/** Account menu using <details> so it works without client JavaScript. */
export function UserMenu({
  name,
  title,
  initials,
  portal,
  align = "right",
}: {
  name: string;
  title: string;
  initials: string;
  portal: "field" | "office";
  align?: "right" | "up";
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-full p-0.5 [&::-webkit-details-marker]:hidden">
        <Avatar initials={initials} />
        <span className="sr-only">Account menu for {name}</span>
      </summary>
      <div
        className={`absolute z-30 w-56 rounded-xl border border-ink-100 bg-white p-2 text-ink-950 shadow-xl ${
          align === "up" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"
        }`}
      >
        <div className="px-3 py-2">
          <p className="text-sm font-extrabold">{name}</p>
          <p className="text-xs text-ink-500">{title}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <input type="hidden" name="portal" value={portal} />
          <button
            type="submit"
            className="mt-1 flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-bold text-signal-700 hover:bg-ink-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

export function Overline({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-extrabold tracking-[0.14em] text-signal-700">{children}</p>;
}

export function FieldSectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-base font-extrabold text-ink-950">{title}</h3>
      {aside && <span className="text-xs font-bold text-ink-400">{aside}</span>}
    </div>
  );
}

export type PillTone = "amber" | "green" | "red" | "grey" | "dark" | "blue" | "violet";

const toneStyles: Record<PillTone, string> = {
  amber: "bg-amber-50 text-amber-900 ring-amber-300",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-signal-600/10 text-signal-800 ring-signal-600/30",
  grey: "bg-ink-50 text-ink-600 ring-ink-200",
  dark: "bg-ink-800 text-white ring-ink-800",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};

/** Status is always spelled out, so it reads the same without colour. */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-extrabold whitespace-nowrap ring-1 ring-inset ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

const leaveTone: Record<LeaveStatus, PillTone> = {
  pending: "amber",
  approved: "green",
  declined: "red",
  withdrawn: "grey",
  cancelled: "grey",
};

export function LeaveStatusPill({ status, cancelling = false }: { status: LeaveStatus; cancelling?: boolean }) {
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      <Pill tone={leaveTone[status]}>{status[0].toUpperCase() + status.slice(1)}</Pill>
      {cancelling && <Pill tone="amber">Cancellation requested</Pill>}
    </span>
  );
}

const sheetTone: Record<TimesheetStatus, PillTone> = {
  draft: "grey",
  submitted: "blue",
  changes_requested: "amber",
  approved: "green",
};
const sheetLabel: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export function TimesheetPill({ status }: { status: TimesheetStatus }) {
  return <Pill tone={sheetTone[status]}>{sheetLabel[status]}</Pill>;
}

export function DemoBadge() {
  return (
    <span className="rounded border border-dashed border-current px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.12em] uppercase opacity-80">
      Demo data
    </span>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg px-3 py-2.5 text-sm ${
        tone === "error" ? "bg-signal-600/10 text-signal-800" : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {children}
    </p>
  );
}
