"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

/** Large touch target (56px) for gloved hands on site. */
export function BigButton({
  children,
  onClick,
  busy = false,
  disabled = false,
  tone,
  icon,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone: "primary" | "outline" | "white" | "ghost";
  icon?: ReactNode;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-signal-600 text-white hover:bg-signal-700",
    outline: "border-2 border-ink-200 bg-white text-ink-900 hover:border-ink-400",
    white: "bg-white text-ink-950 hover:bg-ink-50",
    ghost: "bg-white/15 text-white hover:bg-white/25",
  }[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-3 text-base font-extrabold transition disabled:opacity-60 ${styles}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
