import type { ReactNode } from "react";
import Link from "next/link";
import { EngineerNav } from "@/components/field/EngineerNav";
import { RefreshOnFocus } from "@/components/field/RefreshOnFocus";
import { FieldBrand, UserMenu } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";

export default async function EngineerAppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("engineer");

  return (
    <>
      <RefreshOnFocus />
      <header className="sticky top-0 z-20 border-b-[3px] border-signal-600 bg-ink-900 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/field" aria-label="Today">
            <FieldBrand />
          </Link>
          <div className="hidden sm:block">
            <EngineerNav variant="top" />
          </div>
          <UserMenu name={user.name} title={user.title} initials={user.initials} portal="field" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-28 sm:pb-12">{children}</main>

      <div className="sm:hidden">
        <EngineerNav variant="bottom" />
      </div>
    </>
  );
}
