"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, Home } from "lucide-react";

const tabs = [
  { href: "/field", label: "Today", icon: Home },
  { href: "/field/hours", label: "Time", icon: Clock },
  { href: "/field/leave", label: "Holiday", icon: CalendarDays },
];

function isActive(pathname: string, href: string) {
  return href === "/field" ? pathname === href : pathname.startsWith(href);
}

export function EngineerNav({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="flex gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-2 border-b-[3px] px-3 text-label font-semibold ${
                active ? "border-accent-on-ink text-white" : "border-transparent text-white/80 hover:text-white"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-xl px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-label font-semibold ${active ? "text-primary" : "text-muted hover:text-ink"}`}
            >
              <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${active ? "bg-primary-soft" : ""}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
