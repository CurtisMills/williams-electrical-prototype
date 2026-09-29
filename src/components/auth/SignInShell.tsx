import Link from "next/link";
import { CompanyLogo, DiagonalMotif } from "@/components/portal/brand";
import { LoginForm } from "./LoginForm";

const roles = {
  field: { label: "Employee", other: { href: "/office/login", text: "Office staff? Sign in to Office" } },
  office: { label: "Office", other: { href: "/field/login", text: "Working on site? Sign in as an employee" } },
} as const;

/** Compact charcoal header on phones; split identity panel and form where the width allows. */
export function SignInShell({ portal }: { portal: "field" | "office" }) {
  const role = roles[portal];
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <header className="surface-ink relative overflow-hidden border-b-4 border-primary bg-ink px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:border-r-4 lg:border-b-0 lg:px-14 lg:py-12">
        <div className="relative z-10">
          <CompanyLogo tone="onInk" className="h-20 w-auto sm:h-24 lg:h-36" />
          <p className="mt-3 text-label font-semibold tracking-[0.12em] text-accent-on-ink uppercase">Staff Portal</p>
        </div>
        <div className="relative z-10 hidden lg:block">
          <p className="max-w-xl text-display font-extrabold tracking-[-0.03em] text-balance">
            The working day, <span className="text-accent-on-ink">connected.</span>
          </p>
          <p className="mt-5 max-w-md text-body text-white/80">Your work, time and holiday at Williams Electrical, in one place.</p>
        </div>
        <p className="relative z-10 hidden text-label text-white/70 lg:block">© {new Date().getFullYear()} Williams Electrical (Cymru) Ltd</p>
        <DiagonalMotif className="absolute -right-24 -bottom-28 hidden size-[34rem] text-accent-on-ink opacity-20 lg:block" />
      </header>

      <main className="flex flex-1 justify-center px-5 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:items-center sm:py-12 lg:px-16">
        <div className="w-full max-w-[400px]">
          <p className="text-label font-semibold text-muted">
            Staff Portal <span aria-hidden>·</span> {role.label}
          </p>
          <h1 className="mt-1 text-page-mobile font-bold tracking-[-0.02em] sm:text-page">Sign in</h1>
          <p className="mt-2 mb-6 text-body text-muted">Sign in to the Williams Electrical Staff Portal with your work email.</p>
          <LoginForm portal={portal} />
          <p className="mt-8 border-t border-line pt-5 text-label text-muted">
            <Link href={role.other.href} className="font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink">
              {role.other.text}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
