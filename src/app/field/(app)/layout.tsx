import type { ReactNode } from "react";
import Link from "next/link";
import { DemoMenu } from "@/components/DemoMenu";
import { EngineerNav } from "@/components/field/EngineerNav";
import { OfflineProvider } from "@/components/field/OfflineQueue";
import { RefreshOnFocus } from "@/components/field/RefreshOnFocus";
import { DemoBadge, FieldBrand, UserMenu } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { DEMO_MODE, demoPeople } from "@/lib/auth/users";
import { readStore } from "@/lib/we/store";

export default async function EngineerAppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("engineer");
  const store = await readStore();
  const unread = store.notifications.filter((n) => n.userId === user.id && !n.read).length;

  return (
    <OfflineProvider userId={user.id}>
      <RefreshOnFocus />
      <header className="sticky top-0 z-20 border-b-[3px] border-signal-600 bg-ink-900 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link href="/field" aria-label="Williams Electrical, today" className="min-w-0">
            <FieldBrand className="h-12 w-auto sm:h-14" />
          </Link>
          <div className="hidden md:block">
            <EngineerNav variant="top" unread={unread} />
          </div>
          <div className="flex items-center gap-2">
            {DEMO_MODE && <DemoMenu people={demoPeople()} currentId={user.id} />}
            <UserMenu name={user.name} title={user.title} initials={user.initials} portal="field" />
          </div>
        </div>
        {DEMO_MODE && (
          <div className="flex items-center justify-center gap-2 bg-amber-300 px-4 py-0.5 text-[11px] font-bold text-ink-950">
            <DemoBadge /> Sample people, jobs and times for demonstration
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-28 sm:px-5 md:pb-12">{children}</main>

      <div className="md:hidden">
        <EngineerNav variant="bottom" unread={unread} />
      </div>
    </OfflineProvider>
  );
}
