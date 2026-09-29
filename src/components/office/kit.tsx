import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({ overline, title, children, aside }: { overline: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-extrabold tracking-[0.14em] text-signal-700">{overline}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {children && <div className="mt-1.5 max-w-3xl text-sm text-ink-600">{children}</div>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2 print:hidden">{aside}</div>}
    </div>
  );
}

export function Card({ title, aside, children, className = "", id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 rounded-2xl border border-ink-100 bg-white shadow-[0_3px_14px_#17252a07] ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-50 px-5 py-3.5">
          {title && <h2 className="text-base font-extrabold">{title}</h2>}
          {aside && <div className="text-sm text-ink-500">{aside}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, note, tone = "plain", href }: { label: string; value: ReactNode; note?: ReactNode; tone?: "plain" | "warn" | "good" | "dark"; href?: string }) {
  const styles = {
    plain: "border-ink-100 bg-white",
    warn: "border-amber-300 bg-amber-50",
    good: "border-emerald-200 bg-emerald-50",
    dark: "border-ink-900 bg-ink-900 text-white",
  }[tone];
  const body = (
    <>
      <p className={`text-xs font-bold ${tone === "dark" ? "text-ink-300" : "text-ink-500"}`}>{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold">{value}</p>
      {note && <p className={`mt-0.5 text-xs ${tone === "dark" ? "text-ink-300" : "text-ink-600"}`}>{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={`block rounded-xl border p-4 hover:border-ink-400 ${styles}`}>
      {body}
    </Link>
  ) : (
    <div className={`rounded-xl border p-4 ${styles}`}>{body}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-ink-200 bg-white p-5 text-center text-sm text-ink-500">{children}</p>;
}

export const th = "px-3 py-2.5 text-left text-xs font-extrabold tracking-wide text-ink-500 uppercase";
export const td = "px-3 py-2.5 align-top";
export const inputCls = "min-h-10 w-full rounded-lg border border-ink-200 bg-white px-2.5 text-sm";
export const labelCls = "block text-xs font-extrabold text-ink-700";
export const btn = {
  primary: "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-signal-600 px-4 text-sm font-extrabold text-white hover:bg-signal-700 disabled:opacity-50",
  dark: "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 text-sm font-extrabold text-white hover:bg-ink-800 disabled:opacity-50",
  outline: "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 text-sm font-extrabold text-ink-900 hover:border-ink-400 disabled:opacity-50",
  ghost: "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold text-signal-700 hover:bg-ink-50 disabled:opacity-50",
};
