import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/** One per page. Eyebrow carries the task context (date, section); the title is the page. */
export function PageHeading({
  eyebrow,
  title,
  children,
  actions,
  id,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-label font-semibold text-muted">{eyebrow}</p>}
        <h1 id={id} className="text-page-mobile font-bold tracking-[-0.02em] text-ink sm:text-page">
          {title}
        </h1>
        {children && <div className="mt-2 max-w-3xl text-body text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

export function SectionHeading({ title, aside, id, as: Tag = "h2" }: { title: ReactNode; aside?: ReactNode; id?: string; as?: "h2" | "h3" }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Tag id={id} className="text-section font-bold tracking-[-0.01em] text-ink">
        {title}
      </Tag>
      {aside && <div className="text-label text-muted">{aside}</div>}
    </div>
  );
}

/** White working surface. Prefer whitespace and alignment before reaching for a card. */
export function Card({
  title,
  aside,
  children,
  className = "",
  id,
  flush = false,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  /** Remove body padding, e.g. for edge-to-edge tables. */
  flush?: boolean;
}) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-card border border-line bg-surface ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-4 sm:px-6">
          {title && <h2 className="text-section font-bold tracking-[-0.01em]">{title}</h2>}
          {aside && <div className="text-label text-muted">{aside}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}

/** A headline count that links to the records behind it. */
export function SummaryCount({
  label,
  value,
  note,
  href,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const iconTone = { neutral: "text-muted", success: "text-success", warning: "text-warning", info: "text-info" }[tone];
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-label font-semibold text-ink">
          {Icon && <Icon className={`size-5 shrink-0 ${iconTone}`} aria-hidden />}
          {label}
        </span>
        {href && <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />}
      </span>
      <span className="mt-2 block text-figure font-bold tabular-nums">{value}</span>
      {note && <span className="mt-1 block text-caption text-muted">{note}</span>}
    </>
  );
  const cls = "block rounded-card border border-line bg-surface p-5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-control`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-control bg-surface px-5 py-6 text-center">
      {Icon && <Icon className="mx-auto mb-2 size-6 text-muted" aria-hidden />}
      <p className="font-bold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-label text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Placeholder block for a known layout while it loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-subtle motion-reduce:animate-none ${className}`} />;
}

/** Table cell classes shared across office tables. */
export const th = "px-4 py-3 text-left text-label font-semibold text-muted";
export const td = "px-4 py-3 align-top";
