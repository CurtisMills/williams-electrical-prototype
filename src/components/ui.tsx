import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { statusMeta } from "@/lib/format";
import type { JobStatus } from "@/lib/types";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <img
      src={light ? "/logo-light.png" : "/logo.png"}
      alt="Williams Electrical (Cymru) Ltd"
      width={999}
      height={431}
      className="block h-20 w-auto max-w-full"
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 pt-5 pb-4 backdrop-blur">
      {backHref && (
        <Link href={backHref} className="-ml-1 mb-2 inline-flex items-center text-sm text-brand-600">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      )}
      <h1 className="text-xl font-bold text-brand-900">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-brand-900">{children}</h2>
      {action}
    </div>
  );
}
