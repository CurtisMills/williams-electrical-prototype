import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock,
  Coffee,
  PlayCircle,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { LeaveStatus, TimesheetStatus } from "@/lib/we/types";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const tones: Record<StatusTone, string> = {
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  error: "bg-error-surface text-error",
  info: "bg-info-surface text-info",
  neutral: "bg-subtle text-ink",
};

/** Status always has a text label; colour and icon only reinforce it. */
export function StatusBadge({ tone, icon: Icon, children }: { tone: StatusTone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-bold whitespace-nowrap ${tones[tone]}`}>
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  );
}

const leaveMeta: Record<LeaveStatus, { tone: StatusTone; label: string; icon: LucideIcon }> = {
  pending: { tone: "warning", label: "Pending", icon: Clock },
  approved: { tone: "success", label: "Approved", icon: CheckCircle2 },
  // A decision, not a system failure.
  declined: { tone: "neutral", label: "Declined", icon: XCircle },
  withdrawn: { tone: "neutral", label: "Withdrawn", icon: Undo2 },
  cancelled: { tone: "neutral", label: "Cancelled", icon: Undo2 },
};

export function HolidayStatusBadge({ status, cancelling = false }: { status: LeaveStatus; cancelling?: boolean }) {
  const m = leaveMeta[status];
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      <StatusBadge tone={m.tone} icon={m.icon}>
        {m.label}
      </StatusBadge>
      {cancelling && (
        <StatusBadge tone="warning" icon={Clock}>
          Cancellation requested
        </StatusBadge>
      )}
    </span>
  );
}

const sheetMeta: Record<TimesheetStatus, { tone: StatusTone; label: string; icon: LucideIcon }> = {
  draft: { tone: "neutral", label: "Draft", icon: CircleDashed },
  submitted: { tone: "info", label: "Submitted", icon: Clock },
  changes_requested: { tone: "warning", label: "Changes requested", icon: AlertTriangle },
  approved: { tone: "success", label: "Approved", icon: CheckCircle2 },
};

export function TimesheetBadge({ status }: { status: TimesheetStatus }) {
  const m = sheetMeta[status];
  return (
    <StatusBadge tone={m.tone} icon={m.icon}>
      {m.label}
    </StatusBadge>
  );
}

export type CrewStatus = "working" | "on_break" | "finished" | "on_leave" | "no_start" | "due_later" | "not_scheduled";

const crewMeta: Record<CrewStatus, { tone: StatusTone; icon: LucideIcon }> = {
  working: { tone: "success", icon: PlayCircle },
  on_break: { tone: "neutral", icon: Coffee },
  no_start: { tone: "warning", icon: AlertTriangle },
  due_later: { tone: "info", icon: Clock },
  finished: { tone: "neutral", icon: CheckCircle2 },
  on_leave: { tone: "info", icon: CalendarDays },
  not_scheduled: { tone: "neutral", icon: CircleDashed },
};

export function CrewStatusBadge({ status, label }: { status: CrewStatus; label: string }) {
  const m = crewMeta[status];
  return (
    <StatusBadge tone={m.tone} icon={m.icon}>
      {label}
    </StatusBadge>
  );
}
