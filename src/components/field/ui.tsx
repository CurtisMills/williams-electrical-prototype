import type { ReactNode } from "react";
import { Notice as PortalNotice } from "@/components/portal/notice";
import { StatusBadge, type StatusTone } from "@/components/portal/status";

export { HolidayStatusBadge as LeaveStatusPill, TimesheetBadge as TimesheetPill } from "@/components/portal/status";
export { Avatar } from "@/components/portal/Menu";

export type PillTone = "amber" | "green" | "red" | "grey" | "blue" | "violet";

const toneMap: Record<PillTone, StatusTone> = {
  amber: "warning",
  green: "success",
  red: "error",
  grey: "neutral",
  blue: "info",
  violet: "info",
};

/** Status is always spelled out, so it reads the same without colour. */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <StatusBadge tone={toneMap[tone]}>{children}</StatusBadge>;
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <PortalNotice tone={tone} title={tone === "error" ? "Couldn’t save" : undefined}>
      {children}
    </PortalNotice>
  );
}
