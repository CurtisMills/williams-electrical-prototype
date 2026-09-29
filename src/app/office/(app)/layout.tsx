import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { DemoMenu } from "@/components/DemoMenu";
import { RefreshOnFocus } from "@/components/field/RefreshOnFocus";
import { Avatar, DemoBadge, FieldBrand, UserMenu } from "@/components/field/ui";
import { OfficeNav, type OfficeBadges } from "@/components/office/OfficeNav";
import { requireRole } from "@/lib/auth/session";
import { DEMO_MODE, demoPeople } from "@/lib/auth/users";
import { readStore } from "@/lib/we/store";
import { exceptions } from "@/lib/we/views";

export default async function OfficeAppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("office");
  const store = await readStore();
  const badges: OfficeBadges = {
    leave: store.leave.filter((l) => l.status === "pending" || (l.status === "approved" && !!l.cancellation)).length,
    exceptions: exceptions(store, new Date()).filter((e) => e.kind !== "timesheet_review").length,
    timesheets: store.timesheets.filter((t) => t.status === "submitted").length,
    notifications: store.notifications.filter((n) => n.userId === user.id && !n.read).length,
  };

  return (
    <div className="lg:flex">
      <RefreshOnFocus intervalMs={20000} />

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r-4 border-signal-600 bg-ink-900 px-4 py-5 text-white lg:flex print:hidden">
        <div className="px-2">
          <FieldBrand className="h-auto w-full" />
        </div>
        {DEMO_MODE && (
          <div className="mt-4 flex items-center justify-between gap-2 px-2 text-amber-200">
            <DemoBadge />
            <DemoMenu people={demoPeople()} currentId={user.id} />
          </div>
        )}
        <p className="mt-5 mb-2 px-3 text-[11px] font-extrabold tracking-[0.16em] text-ink-400">OFFICE</p>
        <OfficeNav badges={badges} variant="sidebar" />
        <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <Avatar initials={user.initials} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="truncate text-xs text-ink-400">{user.title}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="portal" value="office" />
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-200 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b-[3px] border-signal-600 bg-ink-900 text-white lg:hidden print:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <FieldBrand className="h-12 w-auto" />
          <div className="flex items-center gap-2">
            {DEMO_MODE && <DemoMenu people={demoPeople()} currentId={user.id} />}
            <UserMenu name={user.name} title={user.title} initials={user.initials} portal="office" />
          </div>
        </div>
        <div className="px-2">
          <OfficeNav badges={badges} variant="tabs" />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
