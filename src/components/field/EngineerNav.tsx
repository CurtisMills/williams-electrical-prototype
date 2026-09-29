"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home } from "lucide-react";

const tabs = [
  { href: "/field", label: "Today", icon: Home },
  { href: "/field/holiday", label: "Holiday", icon: CalendarDays },
];

export function EngineerNav({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="flex gap-1">
        {tabs.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-bold ${
                active ? "bg-white/10 text-white" : "text-ink-200 hover:text-white"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t border-ink-100 bg-white/95 px-3 backdrop-blur"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-extrabold ${
              active ? "text-signal-600" : "text-ink-400"
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
