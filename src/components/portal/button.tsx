import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "inverse" | "danger";
/** lg = 56px employee primary action; md = 48px default; sm = 48px tall but narrower, for dense office tables. */
export type ButtonSize = "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control border font-bold text-center transition-colors disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  lg: "min-h-14 px-5 text-body",
  md: "min-h-12 px-4 text-label",
  sm: "min-h-12 px-3 text-label",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover active:bg-primary-pressed disabled:border-line disabled:bg-subtle disabled:text-muted",
  secondary: "border-control bg-surface text-ink hover:bg-subtle active:bg-line disabled:border-line disabled:text-muted",
  quiet: "border-transparent text-primary hover:bg-primary-soft disabled:text-muted",
  inverse: "border-white/50 bg-transparent text-white hover:bg-white/10 disabled:opacity-60",
  danger: "border-error bg-surface text-error hover:bg-error-surface disabled:border-line disabled:text-muted",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  full = false,
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {}) {
  return `${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${className}`;
}

export function Button({
  variant,
  size,
  full,
  busy = false,
  busyLabel,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  /** Pending: disables the button so a second tap can't send a duplicate. */
  busy?: boolean;
  busyLabel?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className={buttonClass({ variant, size, full, className })}
      {...rest}
    >
      {busy ? <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden /> : icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
