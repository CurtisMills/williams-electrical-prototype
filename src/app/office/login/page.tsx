import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { FieldBrand } from "@/components/field/ui";

export const metadata: Metadata = { title: "Sign in" };

export default function OfficeLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="relative overflow-hidden border-b-4 border-signal-600 bg-ink-900 px-6 py-6 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:border-r-4 lg:border-b-0 lg:px-14 lg:py-12">
        <FieldBrand className="h-20 w-auto self-center lg:h-32" />
        <div className="hidden lg:block">
          <p className="mb-4 text-xs font-extrabold tracking-[0.2em] text-signal-400">OFFICE PORTAL</p>
          <h1 className="max-w-md text-5xl leading-[1.08] font-extrabold tracking-tight">
            Your crew, jobs and time off in one view.
          </h1>
        </div>
        <p className="hidden text-sm text-ink-400 lg:block">© {new Date().getFullYear()} Williams Electrical</p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 hidden h-96 w-96 rounded-full border-[40px] border-white/[0.03] lg:block"
        />
      </aside>

      <main className="flex flex-1 items-start justify-center bg-white px-6 py-10 sm:items-center lg:px-16">
        <div className="w-full max-w-sm">
          <p className="mb-2 text-xs font-extrabold tracking-[0.2em] text-signal-700 lg:hidden">OFFICE PORTAL</p>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Sign in</h2>
          <p className="mt-2 mb-8 text-sm text-ink-500">Use your Williams Electrical office account.</p>
          <LoginForm portal="office" />
        </div>
      </main>
    </div>
  );
}
