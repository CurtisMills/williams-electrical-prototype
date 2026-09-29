import type { ReactNode } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { DemoStrip } from "@/components/DemoMenu";
import { EngineerNav } from "@/components/field/EngineerNav";
import { OfflineProvider } from "@/components/field/OfflineQueue";
import { RefreshOnFocus } from "@/components/field/RefreshOnFocus";
import { BrandLockup } from "@/components/portal/brand";
import { AccountMenu } from "@/components/portal/Menu";
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
      <a href="#main" className="sr-only z-50 rounded-control bg-surface px-4 py-3 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="surface-ink sticky top-0 z-30 bg-ink pt-safe text-white">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-2 px-3 sm:px-5">
          <Link href="/field" className="min-w-0 rounded-control py-1" aria-label="Williams Electrical Staff Portal, Today">
            <BrandLockup />
          </Link>
          <div className="hidden md:block">
            <EngineerNav variant="top" />
          </div>
          <div className="flex shrink-0 items-center">
            <Link
              href="/field/notifications"
              aria-label={unread ? `Updates, ${unread} unread` : "Updates"}
              className="relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-control px-2 text-caption font-semibold text-white hover:bg-white/10"
            >
              <Bell className="size-5" aria-hidden />
              <span aria-hidden>Updates</span>
              {unread > 0 && (
                <span aria-hidden className="absolute top-0.5 right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-caption leading-none font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <AccountMenu name={user.name} title={user.title} initials={user.initials} portal="field" />
          </div>
        </div>
      </header>
      {DEMO_MODE && <DemoStrip people={demoPeople()} currentId={user.id} />}

      <main id="main" className="mx-auto w-full max-w-xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 md:pb-12">
        {children}
      </main>

      <div className="md:hidden">
        <EngineerNav variant="bottom" />
      </div>
    </OfflineProvider>
  );
}
