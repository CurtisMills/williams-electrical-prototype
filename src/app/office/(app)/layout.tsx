import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, LogOut, Settings } from "lucide-react";
import { DemoStrip } from "@/components/DemoMenu";
import { RefreshOnFocus } from "@/components/field/RefreshOnFocus";
import { OfficeCompactNav, OfficeSidebarNav, OfficeUpdatesLink, type OfficeBadges } from "@/components/office/OfficeNav";
import { BrandLockup, CompanyLogo } from "@/components/portal/brand";
import { AccountMenu, Avatar } from "@/components/portal/Menu";
import { requireRole } from "@/lib/auth/session";
import { DEMO_MODE, demoPeople } from "@/lib/auth/users";
import { readStore } from "@/lib/we/store";
import { exceptions } from "@/lib/we/views";

const SETTINGS_HREF = "/office/exceptions#settings";

export default async function OfficeAppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("office");
  const store = await readStore();
  const badges: OfficeBadges = {
    leave: store.leave.filter((l) => l.status === "pending" || (l.status === "approved" && !!l.cancellation)).length,
    exceptions: exceptions(store, new Date()).filter((e) => e.kind !== "timesheet_review").length,
    timesheets: store.timesheets.filter((t) => t.status === "submitted").length,
    notifications: store.notifications.filter((n) => n.userId === user.id && !n.read).length,
  };
  const sideAction = "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-label font-semibold text-white/80 hover:bg-white/5 hover:text-white";

  return (
    <div className="lg:flex">
      <RefreshOnFocus intervalMs={20000} />
      <a href="#main" className="sr-only z-50 rounded-control bg-surface px-4 py-3 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      <aside className="surface-ink sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-ink text-white lg:flex print:hidden">
        <div className="px-5 pt-6 pb-5">
          <Link href="/office" className="block rounded-control" aria-label="Williams Electrical Staff Portal, Office today">
            <CompanyLogo tone="onInk" className="h-auto w-full" />
          </Link>
          <p className="mt-3 text-caption font-semibold tracking-[0.12em] text-accent-on-ink uppercase">
            Staff Portal <span className="text-white/80">· Office</span>
          </p>
        </div>
        <div className="flex-1 px-3">
          <OfficeSidebarNav badges={badges} />
        </div>
        <div className="mt-6 space-y-0.5 border-t border-white/10 px-3 py-3">
          <OfficeUpdatesLink badges={badges} />
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar initials={user.initials} className="bg-white/15 text-white" />
            <div className="min-w-0">
              <p className="text-label font-bold break-words">{user.name}</p>
              <p className="text-caption text-white/70">{user.title}</p>
            </div>
          </div>
          <Link href={SETTINGS_HREF} className={sideAction}>
            <Settings className="size-5" aria-hidden />
            Settings
          </Link>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="portal" value="office" />
            <button type="submit" className={sideAction}>
              <LogOut className="size-5" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="surface-ink sticky top-0 z-30 bg-ink text-white lg:hidden print:hidden">
          <div className="flex min-h-16 items-center justify-between gap-2 px-3 sm:px-5">
            <Link href="/office" className="min-w-0 rounded-control py-1" aria-label="Williams Electrical Staff Portal, Office today">
              <BrandLockup role="Office" />
            </Link>
            <div className="flex shrink-0 items-center">
              <Link
                href="/office/notifications"
                aria-label={badges.notifications ? `Updates, ${badges.notifications} unread` : "Updates"}
                className="relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-control px-2 text-caption font-semibold text-white hover:bg-white/10"
              >
                <Bell className="size-5" aria-hidden />
                <span aria-hidden>Updates</span>
                {badges.notifications > 0 && (
                  <span aria-hidden className="absolute top-0.5 right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-caption leading-none font-bold text-white">
                    {badges.notifications}
                  </span>
                )}
              </Link>
              <AccountMenu name={user.name} title={user.title} initials={user.initials} portal="office" settingsHref={SETTINGS_HREF} />
            </div>
          </div>
          <div className="border-t border-white/10">
            <OfficeCompactNav badges={badges} />
          </div>
        </header>

        {DEMO_MODE && (
          <div className="print:hidden">
            <DemoStrip people={demoPeople()} currentId={user.id} />
          </div>
        )}

        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
