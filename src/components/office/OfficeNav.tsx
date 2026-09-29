"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";

const items = [
  { href: "/office", label: "Overview", icon: LayoutDashboard },
  { href: "/office/team", label: "Team today", icon: Users },
];

export function OfficeNav({ pendingCount, variant }: { pendingCount: number; variant: "sidebar" | "tabs" }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={variant === "sidebar" ? "space-y-1" : "flex gap-1 overflow-x-auto"}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        const badge = href === "/office" && pendingCount > 0 ? pendingCount : null;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              variant === "sidebar"
                ? `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold ${
                    active ? "bg-white/10 text-white" : "text-ink-200 hover:bg-white/5 hover:text-white"
                  }`
                : `flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-bold ${
                    active ? "border-signal-500 text-white" : "border-transparent text-ink-200"
                  }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
            {badge && (
              <span
                className="ml-auto rounded-full bg-signal-600 px-2 py-0.5 text-[11px] font-extrabold text-white"
                aria-label={`${badge} pending holiday requests`}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
