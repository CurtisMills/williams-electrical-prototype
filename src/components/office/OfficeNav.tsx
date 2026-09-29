"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Download,
  History,
  LayoutDashboard,
} from "lucide-react";

export type OfficeBadges = { leave: number; exceptions: number; timesheets: number; notifications: number };

const items = [
  { href: "/office", label: "Today", icon: LayoutDashboard, badge: null },
  { href: "/office/exceptions", label: "Exceptions", icon: AlertTriangle, badge: "exceptions" },
  { href: "/office/leave", label: "Leave", icon: CalendarDays, badge: "leave" },
  { href: "/office/planning", label: "Planning", icon: CalendarRange, badge: null },
  { href: "/office/jobs", label: "Jobs and sites", icon: Briefcase, badge: null },
  { href: "/office/history", label: "Work history", icon: History, badge: null },
  { href: "/office/timesheets", label: "Timesheets", icon: ClipboardCheck, badge: "timesheets" },
  { href: "/office/exports", label: "Exports", icon: Download, badge: null },
  { href: "/office/notifications", label: "Updates", icon: Bell, badge: "notifications" },
] as const;

const badgeLabels: Record<keyof OfficeBadges, string> = {
  leave: "leave requests waiting",
  exceptions: "exceptions to review",
  timesheets: "timesheets waiting for approval",
  notifications: "unread updates",
};

export function OfficeNav({ badges, variant }: { badges: OfficeBadges; variant: "sidebar" | "tabs" }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={variant === "sidebar" ? "space-y-0.5" : "flex gap-1 overflow-x-auto"}>
      {items.map(({ href, label, icon: Icon, badge }) => {
        const active = href === "/office" ? pathname === href : pathname.startsWith(href);
        const count = badge ? badges[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              variant === "sidebar"
                ? `flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-bold ${
                    active ? "bg-white/10 text-white" : "text-ink-200 hover:bg-white/5 hover:text-white"
                  }`
                : `flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-bold whitespace-nowrap ${
                    active ? "border-signal-500 text-white" : "border-transparent text-ink-200"
                  }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
            {badge && count > 0 && (
              <span className="ml-auto rounded-full bg-signal-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                {count}
                <span className="sr-only"> {badgeLabels[badge]}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
