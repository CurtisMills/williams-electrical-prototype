import type { Metadata } from "next";
import Link from "next/link";
import { Card, Empty, PageHeader, td, th } from "@/components/office/kit";
import { LeaveStatusPill, Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatDateRange, formatWhen, todayKey } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { currentBalance } from "@/lib/we/leave";
import { leaveImpact } from "@/lib/we/planning";
import { readStore } from "@/lib/we/store";
import type { LeaveRequest } from "@/lib/we/types";
import { RecordLeaveForm } from "./RecordLeaveForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leave" };

export default async function OfficeLeavePage() {
  await requireRole("office");
  const store = await readStore();
  const today = todayKey();
  const name = (id: string) => store.employees.find((e) => e.id === id)?.name ?? id;
  const waiting = store.leave.filter((l) => l.status === "pending").sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  const cancellations = store.leave.filter((l) => l.status === "approved" && l.cancellation);
  const upcoming = store.leave.filter((l) => l.status === "approved" && !l.cancellation && l.lastDay >= today).sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  const past = store.leave
    .filter((l) => !waiting.includes(l) && !cancellations.includes(l) && !upcoming.includes(l))
    .sort((a, b) => b.firstDay.localeCompare(a.firstDay))
    .slice(0, 25);

  const table = (rows: LeaveRequest[], withImpact: boolean) => (
    <div className="-mx-5 -my-5 overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/60">
          <tr>
            <th className={th}>Employee</th>
            <th className={th}>Dates</th>
            <th className={th}>Days</th>
            <th className={th}>Status</th>
            {withImpact && <th className={th}>Impact if approved</th>}
            <th className={th}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {rows.map((r) => {
            const impact = withImpact ? leaveImpact(store, r) : null;
            const gaps = impact ? impact.affected.filter((a) => a.unfilledAfter > 0) : [];
            const emp = store.employees.find((e) => e.id === r.employeeId)!;
            return (
              <tr key={r.id}>
                <td className={td}>
                  <span className="font-bold">{name(r.employeeId)}</span>
                  <span className="block text-xs text-ink-500">{roleLabel[emp.role]} · {currentBalance(store, emp).remaining} days left</span>
                </td>
                <td className={td}>
                  {formatDateRange(r.firstDay, r.lastDay)}
                  {r.note && <span className="block text-xs text-ink-500">“{r.note}”</span>}
                </td>
                <td className={`${td} font-mono`}>{r.totalDays}</td>
                <td className={td}>
                  <LeaveStatusPill status={r.status} cancelling={!!r.cancellation} />
                  <span className="block text-xs text-ink-500">{formatWhen(r.createdAt)}</span>
                </td>
                {withImpact && (
                  <td className={td}>
                    {impact!.affected.length === 0 ? (
                      <span className="text-ink-500">No planned work affected</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        <Pill tone={gaps.length ? "red" : "amber"}>
                          {impact!.affected.length} assignment{impact!.affected.length > 1 ? "s" : ""} affected
                        </Pill>
                        {gaps.length > 0 && <Pill tone="red">{gaps.length} would be unfilled</Pill>}
                      </span>
                    )}
                  </td>
                )}
                <td className={td}>
                  <Link href={`/office/leave/${r.id}`} className="font-extrabold text-signal-700 hover:underline">
                    {r.status === "pending" || r.cancellation ? "Review" : "Open"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader overline="OFFICE" title="Leave">
        Pending requests are not booked until approved. Open a request to see who else is off and which jobs it affects before you decide.
      </PageHeader>

      <div className="space-y-6">
        <Card title={`Waiting for a decision (${waiting.length})`}>{waiting.length ? table(waiting, true) : <Empty>No leave requests waiting.</Empty>}</Card>
        {cancellations.length > 0 && <Card title={`Cancellation requests (${cancellations.length})`}>{table(cancellations, false)}</Card>}
        <Card title="Booked (approved, upcoming)">{upcoming.length ? table(upcoming, false) : <Empty>No upcoming approved leave.</Empty>}</Card>
        <Card title="Record leave for an employee" aside="Approved straight away; the employee is notified">
          <RecordLeaveForm employees={store.employees.map((e) => ({ id: e.id, name: e.name }))} />
        </Card>
        {past.length > 0 && <Card title="History">{table(past, false)}</Card>}
      </div>
    </>
  );
}
