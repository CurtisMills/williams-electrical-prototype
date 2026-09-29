"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { LogOut, Settings } from "lucide-react";

/** <details> menu that also closes on Escape, outside click and navigation, returning focus to its trigger. */
export function MenuDetails({ summary, summaryClassName, panelClassName, label, children }: {
  summary: ReactNode;
  summaryClassName: string;
  panelClassName: string;
  label?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary aria-label={label} className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}>
        {summary}
      </summary>
      <div className={`absolute z-50 rounded-dialog border border-line bg-surface p-2 text-ink shadow-overlay ${panelClassName}`}>{children}</div>
    </details>
  );
}

export function Avatar({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-caption font-extrabold text-primary ${className}`}>
      {initials}
    </span>
  );
}

export const menuItem = "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-label font-semibold text-ink hover:bg-subtle";

/** Account and settings, always with a visible label rather than a lone avatar. */
export function AccountMenu({
  name,
  title,
  initials,
  portal,
  settingsHref,
  placement = "down",
}: {
  name: string;
  title: string;
  initials: string;
  portal: "field" | "office";
  settingsHref?: string;
  placement?: "down" | "up";
}) {
  return (
    <MenuDetails
      label={`Account: ${name}`}
      summaryClassName="flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-control px-2 text-caption font-semibold text-white hover:bg-white/10"
      panelClassName={`w-72 ${placement === "up" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"}`}
      summary={
        <>
          <Avatar initials={initials} className="size-6 bg-white/15 text-white" />
          <span>Account</span>
        </>
      }
    >
      <div className="px-3 py-2">
        <p className="font-bold break-words">{name}</p>
        <p className="text-label text-muted">{title}</p>
      </div>
      {settingsHref && (
        <Link href={settingsHref} className={menuItem}>
          <Settings className="size-5 text-muted" aria-hidden />
          Settings
        </Link>
      )}
      <form action="/api/auth/logout" method="post">
        <input type="hidden" name="portal" value={portal} />
        <button type="submit" className={menuItem}>
          <LogOut className="size-5 text-muted" aria-hidden />
          Sign out
        </button>
      </form>
    </MenuDetails>
  );
}
