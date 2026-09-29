"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Download,
  History,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";
import { MenuDetails } from "@/components/portal/Menu";

export type OfficeBadges = { leave: number; exceptions: number; timesheets: number; notifications: number };

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  badge: keyof OfficeBadges | null;
  match: (p: string) => boolean;
}

const primary: Item[] = [
  { href: "/office", label: "Today", icon: Home, badge: null, match: (p) => p === "/office" },
  { href: "/office/jobs", label: "Jobs", icon: Briefcase, badge: null, match: (p) => p.startsWith("/office/jobs") || p.startsWith("/office/planning/jobs") },
  { href: "/office/planning", label: "Crew", icon: Users, badge: null, match: (p) => p.startsWith("/office/planning") && !p.startsWith("/office/planning/jobs") },
  { href: "/office/leave", label: "Holiday", icon: CalendarDays, badge: "leave", match: (p) => p.startsWith("/office/leave") },
];

const timeRecords: Item[] = [
  { href: "/office/timesheets", label: "Timesheets", icon: ClipboardCheck, badge: "timesheets", match: (p) => p.startsWith("/office/timesheets") },
  { href: "/office/exceptions", label: "Needs attention", icon: AlertTriangle, badge: "exceptions", match: (p) => p.startsWith("/office/exceptions") },
  { href: "/office/history", label: "Work history", icon: History, badge: null, match: (p) => p.startsWith("/office/history") || p.startsWith("/office/records") },
  { href: "/office/exports", label: "Exports", icon: Download, badge: null, match: (p) => p.startsWith("/office/exports") },
];

const updates: Item = { href: "/office/notifications", label: "Updates", icon: Bell, badge: "notifications", match: (p) => p.startsWith("/office/notifications") };

const badgeLabels: Record<keyof OfficeBadges, string> = {
  leave: "holiday requests waiting",
  exceptions: "items needing attention",
  timesheets: "timesheets waiting for approval",
  notifications: "unread updates",
};

function Count({ n, kind, tone = "onInk" }: { n: number; kind: keyof OfficeBadges; tone?: "onInk" | "onLight" }) {
  if (n <= 0) return null;
  return (
    <span className={`ml-auto rounded-full px-2 text-caption font-bold tabular-nums ${tone === "onInk" ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>
      {n}
      <span className="sr-only"> {badgeLabels[kind]}</span>
    </span>
  );
}

function SidebarLink({ item, badges, pathname }: { item: Item; badges: OfficeBadges; pathname: string }) {
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-control px-3 text-label font-semibold transition-colors ${
        active ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--ww-signal-on-ink)]" : "text-white/80 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {item.label}
      {item.badge && <Count n={badges[item.badge]} kind={item.badge} />}
    </Link>
  );
}

export function OfficeSidebarNav({ badges }: { badges: OfficeBadges }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      <ul className="space-y-0.5">
        {primary.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} badges={badges} pathname={pathname} />
          </li>
        ))}
      </ul>
      <div>
        <p id="nav-time-records" className="mb-1 px-3 text-caption font-semibold text-white/70">
          Time records
        </p>
        <ul aria-labelledby="nav-time-records" className="space-y-0.5">
          {timeRecords.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} badges={badges} pathname={pathname} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function OfficeUpdatesLink({ badges }: { badges: OfficeBadges }) {
  const pathname = usePathname();
  return <SidebarLink item={updates} badges={badges} pathname={pathname} />;
}

/** Narrow screens: the four main areas as tabs, time records under "More". */
export function OfficeCompactNav({ badges }: { badges: OfficeBadges }) {
  const pathname = usePathname();
  const moreActive = timeRecords.some((i) => i.match(pathname));
  const moreCount = timeRecords.reduce((n, i) => n + (i.badge ? badges[i.badge] : 0), 0);
  const tab = (active: boolean) =>
    `flex min-h-12 flex-1 items-center justify-center gap-1 border-b-[3px] px-1 text-caption font-semibold whitespace-nowrap sm:gap-1.5 sm:px-1.5 sm:text-label ${
      active ? "border-accent-on-ink text-white" : "border-transparent text-white/80 hover:text-white"
    }`;
  return (
    <nav aria-label="Main" className="flex items-stretch px-1">
      {primary.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tab(active)}>
            <Icon className="hidden size-5 sm:block" aria-hidden />
            {item.label}
            {item.badge && badges[item.badge] > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-caption font-bold text-white tabular-nums">
                {badges[item.badge]}
                <span className="sr-only"> {badgeLabels[item.badge]}</span>
              </span>
            )}
          </Link>
        );
      })}
      <div className="flex flex-1">
        <MenuDetails
          summaryClassName={`${tab(moreActive)} h-full w-full`}
          panelClassName="top-full right-0 mt-1 w-64"
          summary={
            <>
              More
              {moreCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-caption font-bold text-white tabular-nums">
                  {moreCount}
                  <span className="sr-only"> items waiting</span>
                </span>
              )}
              <ChevronDown className="hidden size-4 sm:block" aria-hidden />
            </>
          }
        >
          <p className="px-3 pt-1 pb-2 text-caption font-semibold text-muted">Time records</p>
          <ul>
            {timeRecords.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-control px-3 text-label font-semibold ${active ? "bg-primary-soft text-primary" : "text-ink hover:bg-subtle"}`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {item.label}
                    {item.badge && <Count n={badges[item.badge]} kind={item.badge} tone="onLight" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </MenuDetails>
      </div>
    </nav>
  );
}
