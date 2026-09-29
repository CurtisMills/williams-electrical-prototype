import type { ReactNode } from "react";
import type { LeaveStatus } from "@/lib/we/types";
import { HolidayStatusBadge } from "./status";

const statusLine: Partial<Record<LeaveStatus, string>> = {
  pending: "Waiting for approval. Not booked yet.",
  approved: "Holiday approved.",
  declined: "Declined.",
  withdrawn: "You withdrew this request.",
  cancelled: "Cancelled. The days went back to your balance.",
};

export function HolidayRequest({
  range,
  days,
  reference,
  status,
  cancelling = false,
  who,
  children,
}: {
  range: string;
  days: string;
  reference: string;
  status: LeaveStatus;
  cancelling?: boolean;
  /** Office views name the employee. */
  who?: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          {who && <p className="text-label font-semibold text-muted">{who}</p>}
          <h3 className="text-body font-bold text-ink">{range}</h3>
          <p className="text-label text-muted tabular-nums">
            {days} · Ref {reference}
          </p>
        </div>
        <HolidayStatusBadge status={status} cancelling={cancelling} />
      </div>
      {!who && statusLine[status] && <p className="mt-2 text-label text-ink">{statusLine[status]}</p>}
      {children && <div className="mt-3">{children}</div>}
    </article>
  );
}
