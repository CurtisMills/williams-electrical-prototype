"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Clock, Home } from "lucide-react";

const tabs = [
  { href: "/field", label: "Today", icon: Home },
  { href: "/field/leave", label: "My leave", icon: CalendarDays },
  { href: "/field/hours", label: "My hours", icon: Clock },
  { href: "/field/notifications", label: "Updates", icon: Bell },
];

function isActive(pathname: string, href: string) {
  return href === "/field" ? pathname === href : pathname.startsWith(href);
}

export function EngineerNav({ variant, unread = 0 }: { variant: "bottom" | "top"; unread?: number }) {
  const pathname = usePathname();

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="flex gap-1">
        {tabs.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative rounded-lg px-3 py-2 text-sm font-bold ${
                active ? "bg-white/10 text-white" : "text-ink-200 hover:text-white"
              }`}
            >
              {label}
              {href === "/field/notifications" && unread > 0 && (
                <span className="ml-1.5 rounded-full bg-signal-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t border-ink-100 bg-white/95 px-2 backdrop-blur"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-extrabold ${
              active ? "text-signal-600" : "text-ink-400"
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.8} />
            {label}
            {href === "/field/notifications" && unread > 0 && (
              <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-signal-600 px-1.5 text-[10px] font-extrabold text-white">
                {unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
