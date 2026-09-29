import type { Metadata } from "next";
import { PageHeading } from "@/components/portal/layout";
import { requireRole } from "@/lib/auth/session";
import { formatDateRange, formatDayKey, formatWhen, todayKey } from "@/lib/field/dates";
import { portionLabel } from "@/lib/we/calc";
import { currentBalance } from "@/lib/we/leave";
import { readStore } from "@/lib/we/store";
import { LeaveScreen, type LeaveItem } from "./LeaveScreen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Holiday" };

export default async function MyHolidayPage(props: PageProps<"/field/leave">) {
  const { user } = await requireRole("engineer");
  const sp = await props.searchParams;
  const store = await readStore();
  const employee = store.employees.find((e) => e.id === user.id)!;
  const mine = store.leave.filter((r) => r.employeeId === user.id);
  const names = new Map([...store.employees.map((e) => [e.id, e.name] as const), ["office-megan", "Megan Lloyd"], ["office-gareth", "Gareth Williams"]]);
  const today = todayKey();

  const items: LeaveItem[] = mine
    .sort((a, b) => b.firstDay.localeCompare(a.firstDay))
    .map((r) => ({
      id: r.id,
      range: formatDateRange(r.firstDay, r.lastDay),
      firstDay: r.firstDay,
      lastDay: r.lastDay,
      totalDays: r.totalDays,
      status: r.status,
      cancelling: !!r.cancellation,
      note: r.note,
      decisionReason: r.decisionReason,
      days: r.days.map((d) => `${formatDayKey(d.date, "short")}${d.portion === "full" ? "" : ` (${portionLabel[d.portion].toLowerCase()})`}`),
      history: r.history.map((h) => ({
        when: formatWhen(h.at),
        who: h.by === user.id ? "You" : (names.get(h.by) ?? h.by),
        action: h.action,
        reason: h.reason,
      })),
      upcoming: r.lastDay >= today,
    }));

  return (
    <section aria-labelledby="holiday-heading">
      <PageHeading id="holiday-heading" eyebrow="Holiday" title="My holiday" />
      <LeaveScreen
        today={today}
        employee={employee}
        settings={store.settings}
        requests={mine}
        balance={currentBalance(store, employee)}
        items={items}
        startOpen={sp.new === "1"}
      />
    </section>
  );
}
