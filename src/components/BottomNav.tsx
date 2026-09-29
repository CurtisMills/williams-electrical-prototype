"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, PlusCircle, User, Wrench } from "lucide-react";

const tabs = [
  { href: "/customer", label: "Home", icon: Home },
  { href: "/customer/services", label: "Services", icon: Wrench },
  { href: "/customer/quote", label: "Quote", icon: PlusCircle, primary: true },
  { href: "/customer/jobs", label: "My Jobs", icon: ClipboardList },
  { href: "/customer/account", label: "Account", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pb-safe absolute inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/customer" ? pathname === "/customer" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-brand-600" : "text-slate-500"
                }`}
              >
                {primary ? (
                  <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-spark-400 text-brand-900 shadow-lg ring-4 ring-white">
                    <Icon className="h-6 w-6" />
                  </span>
                ) : (
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
