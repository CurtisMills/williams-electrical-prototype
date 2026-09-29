import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { FieldBrand } from "@/components/field/ui";

export const metadata: Metadata = { title: "Sign in" };

export default function FieldLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-900 sm:items-center sm:justify-center sm:p-6">
      <div className="px-6 pt-[max(3.5rem,env(safe-area-inset-top))] pb-10 sm:hidden">
        <FieldBrand size="lg" />
        <h1 className="mt-10 text-3xl leading-tight font-extrabold tracking-tight text-white">
          Sign in to
          <br />
          your working day
        </h1>
      </div>

      <div className="flex-1 rounded-t-3xl border-t-4 border-signal-600 bg-white px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:w-full sm:max-w-md sm:flex-none sm:rounded-3xl sm:border-t-0 sm:p-10 sm:shadow-2xl">
        <div className="mb-8 hidden sm:block">
          <FieldBrand size="lg" tone="dark" />
          <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Sign in to your working day</h1>
        </div>
        <LoginForm portal="field" />
        <p className="mt-8 text-center text-xs text-ink-400">Williams Electrical · Field</p>
      </div>
    </div>
  );
}
