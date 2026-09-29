import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/portal/button";
import { EmptyState, PageHeading, SummaryCount } from "@/components/portal/layout";

export { th, td } from "@/components/portal/layout";

export function PageHeader({ overline, title, children, aside }: { overline?: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <PageHeading eyebrow={overline} title={title} actions={aside}>
      {children}
    </PageHeading>
  );
}

/** Office card with fixed 20px padding so edge-to-edge tables can use -mx-5/-my-5. */
export function Card({ title, aside, children, className = "", id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-card border border-line bg-surface ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-4">
          {title && <h2 className="text-section font-bold tracking-[-0.01em]">{title}</h2>}
          {aside && <div className="text-label text-muted">{aside}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  tone = "plain",
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "plain" | "warn" | "good" | "info";
  href?: string;
  icon?: LucideIcon;
}) {
  const map = { plain: "neutral", warn: "warning", good: "success", info: "info" } as const;
  return <SummaryCount label={label} value={value} note={note} href={href} icon={icon} tone={map[tone]} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState title={children} />;
}

export const inputCls = "block min-h-12 w-full rounded-control border border-control bg-surface px-3 text-body text-ink";
export const labelCls = "block text-label font-semibold text-ink [&>input]:mt-1.5 [&>select]:mt-1.5 [&>textarea]:mt-1.5";
export const btn = {
  primary: buttonClass({ variant: "primary" }),
  dark: buttonClass({ variant: "primary" }),
  outline: buttonClass({ variant: "secondary" }),
  ghost: buttonClass({ variant: "quiet" }),
  danger: buttonClass({ variant: "danger" }),
};
