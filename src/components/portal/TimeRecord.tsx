import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock, CloudOff, PencilLine, PlayCircle } from "lucide-react";
import { StatusBadge } from "./status";

export type TimeRecordState = "recording" | "saved" | "corrected" | "change_requested" | "waiting" | "failed";

/** Every state reads without colour: a label plus an icon. */
export function TimeRecordStatus({ state }: { state: TimeRecordState }) {
  switch (state) {
    case "recording":
      return (
        <StatusBadge tone="success" icon={PlayCircle}>
          Recording
        </StatusBadge>
      );
    case "corrected":
      return (
        <StatusBadge tone="info" icon={PencilLine}>
          Corrected
        </StatusBadge>
      );
    case "change_requested":
      return (
        <StatusBadge tone="warning" icon={Clock}>
          Change requested
        </StatusBadge>
      );
    case "waiting":
      return (
        <StatusBadge tone="warning" icon={CloudOff}>
          Saved on this phone, waiting to send
        </StatusBadge>
      );
    case "failed":
      return (
        <StatusBadge tone="error" icon={AlertCircle}>
          Couldn’t save
        </StatusBadge>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-success">
          <CheckCircle2 className="size-3.5" strokeWidth={2.25} aria-hidden />
          Saved
        </span>
      );
  }
}

export function TimeRecord({
  title,
  times,
  detail,
  duration,
  state,
  action,
}: {
  title: string;
  /** e.g. "08:02–12:30" */
  times: string;
  detail?: string;
  duration: string;
  state: TimeRecordState;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="font-semibold break-words text-ink">{title}</p>
        <p className="text-label text-muted tabular-nums">
          {times}
          {detail && ` · ${detail}`}
        </p>
        <div className="mt-1.5">
          <TimeRecordStatus state={state} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-bold tabular-nums">{duration}</span>
        {action}
      </div>
    </li>
  );
}
