import Image from "next/image";

/** The official Williams Electrical logo at its original proportions. */
export function CompanyLogo({ tone = "onLight", className = "h-24 w-auto" }: { tone?: "onLight" | "onInk"; className?: string }) {
  return (
    <Image
      src={tone === "onInk" ? "/logo-light.png" : "/logo.png"}
      alt="Williams Electrical (Cymru) Ltd"
      width={999}
      height={431}
      className={`block max-w-full ${className}`}
    />
  );
}

/** The dragon from the official logo, for compact placements. Decorative when the company name sits beside it. */
export function Emblem({ className = "size-8", label }: { className?: string; label?: string }) {
  return <Image src="/brand/dragon.png" width={256} height={256} alt={label ?? ""} aria-hidden={label ? undefined : true} className={`block shrink-0 ${className}`} />;
}

/**
 * Compact identity: company first, Staff Portal second, optional role third.
 * Used where the full logo would be too small to read.
 */
export function BrandLockup({ tone = "onInk", role }: { tone?: "onInk" | "onLight"; role?: "Office" | "Employee" }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Emblem className="size-9" />
      <span className="min-w-0 leading-tight">
        <span className={`block text-label font-extrabold tracking-[-0.01em] whitespace-nowrap ${tone === "onInk" ? "text-white" : "text-ink"}`}>
          Williams Electrical
        </span>
        <span className={`block text-caption font-semibold whitespace-nowrap ${tone === "onInk" ? "text-accent-on-ink" : "text-primary"}`}>
          Staff Portal{role && <span className={tone === "onInk" ? "text-white/80" : "text-muted"}> · {role}</span>}
        </span>
      </span>
    </span>
  );
}

/** Quiet angled frame for identity panels only. Never behind work content. */
export function DiagonalMotif({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={`pointer-events-none ${className}`} fill="none">
      <path d="M9 4H59L51 60H1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="miter" />
      <path d="M17 12H51L45 52H11Z" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="miter" opacity="0.6" />
    </svg>
  );
}
