import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { RefreshOnFocus } from "@/components/field/RefreshOnFocus";
import { Avatar, FieldBrand, UserMenu } from "@/components/field/ui";
import { OfficeNav } from "@/components/office/OfficeNav";
import { requireRole } from "@/lib/auth/session";
import { listHolidayRequests } from "@/lib/field/store";

export default async function OfficeAppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("office");
  const pendingCount = (await listHolidayRequests({ status: "pending" })).length;

  return (
    <div className="lg:flex">
      <RefreshOnFocus />

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r-4 border-signal-600 bg-ink-900 px-4 py-6 text-white lg:flex">
        <div className="px-2">
          <FieldBrand className="h-auto w-full" />
        </div>
        <p className="mt-8 mb-2 px-3 text-[11px] font-extrabold tracking-[0.16em] text-ink-400">OFFICE</p>
        <OfficeNav pendingCount={pendingCount} variant="sidebar" />
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

      <header className="sticky top-0 z-20 border-b-[3px] border-signal-600 bg-ink-900 text-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <FieldBrand />
          <UserMenu name={user.name} title={user.title} initials={user.initials} portal="office" />
        </div>
        <div className="px-2">
          <OfficeNav pendingCount={pendingCount} variant="tabs" />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
