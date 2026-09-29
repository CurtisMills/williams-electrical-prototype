import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";

export type NoticeTone = "success" | "error" | "warning" | "info";

const styles: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  success: { box: "border-success/30 bg-success-surface", icon: "text-success", Icon: CheckCircle2 },
  error: { box: "border-error/30 bg-error-surface", icon: "text-error", Icon: AlertCircle },
  warning: { box: "border-warning/30 bg-warning-surface", icon: "text-warning", Icon: AlertTriangle },
  info: { box: "border-info/25 bg-info-surface", icon: "text-info", Icon: Info },
};

/**
 * Inline message with an icon and explicit wording. Errors announce themselves (role="alert");
 * pass live={false} when the notice sits inside a FeedbackRegion that already announces.
 */
export function Notice({
  tone,
  title,
  children,
  action,
  icon,
  live = true,
  className = "",
}: {
  tone: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  live?: boolean;
  className?: string;
}) {
  const s = styles[tone];
  const Icon = icon ?? s.Icon;
  const role = !live ? undefined : tone === "error" ? "alert" : "status";
  return (
    <div role={role} className={`flex items-start gap-3 rounded-card border p-4 text-label text-ink ${s.box} ${className}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${s.icon}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className={`font-bold ${s.icon}`}>{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/**
 * Always-mounted live region so results are announced when they appear, not just when the page loads.
 * Errors use role="alert"; confirmations use a polite status region.
 */
export function FeedbackRegion({
  error,
  message,
  messageTitle,
  className = "",
}: {
  error?: string | null;
  message?: ReactNode;
  messageTitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={error || message ? className : undefined}>
      <div role="status" aria-live="polite" aria-atomic="true">
        {message && (
          <Notice tone="success" title={messageTitle} live={false}>
            {message}
          </Notice>
        )}
      </div>
      <div role="alert" aria-atomic="true" className="[&:not(:empty)]:mt-2">
        {error && (
          <Notice tone="error" title="Couldn’t save" live={false}>
            {error}
          </Notice>
        )}
      </div>
    </div>
  );
}
