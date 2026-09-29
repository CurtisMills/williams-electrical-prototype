import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { AvailabilitySummary } from "@/components/portal/AvailabilitySummary";
import { buttonClass } from "@/components/portal/button";
import { HolidayRequest } from "@/components/portal/HolidayRequest";
import { Card, EmptyState, PageHeading, SectionHeading, td, th } from "@/components/portal/layout";
import { HolidayStatusBadge } from "@/components/portal/status";
import { requireRole } from "@/lib/auth/session";
import { dayCount, formatDateRange, formatDayKey, formatWhen, todayKey } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { currentBalance } from "@/lib/we/leave";
import { leaveImpact } from "@/lib/we/planning";
import { formatBalance } from "@/lib/we/present";
import { readStore } from "@/lib/we/store";
import type { LeaveRequest } from "@/lib/we/types";
import { RecordLeaveForm } from "./RecordLeaveForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Holiday" };

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

  const table = (rows: LeaveRequest[], caption: string) => (
    <Card flush>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-body">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line">
            <tr>
              <th className={th}>Employee</th>
              <th className={th}>Dates</th>
              <th className={`${th} text-right`}>Days</th>
              <th className={th}>Status</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <span className="font-bold">{name(r.employeeId)}</span>
                </td>
                <td className={td}>
                  {formatDateRange(r.firstDay, r.lastDay)}
                  {r.note && <span className="block text-label text-muted">“{r.note}”</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.totalDays}</td>
                <td className={td}>
                  <HolidayStatusBadge status={r.status} cancelling={!!r.cancellation} />
                  <span className="mt-1 block text-label text-muted">Requested {formatWhen(r.createdAt)}</span>
                </td>
                <td className={`${td} text-right`}>
                  <Link href={`/office/leave/${r.id}`} className="inline-flex min-h-12 items-center gap-1 font-bold text-primary hover:underline">
                    {r.cancellation ? "Review request" : "View"}
                    <span className="sr-only">
                      {" "}
                      for {name(r.employeeId)}, {formatDateRange(r.firstDay, r.lastDay)}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <>
      <PageHeading eyebrow="Office" title="Holiday">
        Pending requests are not booked until approved. Review a request to see crew availability and affected jobs before you decide.
      </PageHeading>

      <div className="space-y-10">
        <section id="waiting" aria-labelledby="waiting-heading" className="scroll-mt-28">
          <SectionHeading id="waiting-heading" title={`Waiting for review (${waiting.length})`} />
          {waiting.length === 0 ? (
            <EmptyState title="No holiday requests waiting." />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {waiting.map((r) => {
                const impact = leaveImpact(store, r);
                const emp = impact.employee;
                const gaps = impact.affected.filter((a) => a.unfilledAfter > 0).length;
                const balance = currentBalance(store, emp).remaining;
                return (
                  <li key={r.id}>
                    <HolidayRequest who={`${emp.name} · ${roleLabel[emp.role]}`} range={formatDateRange(r.firstDay, r.lastDay)} days={dayCount(r.totalDays)} reference={r.id} status={r.status}>
                      <dl className="grid grid-cols-2 gap-3 text-label">
                        <div>
                          <dt className="text-muted">Holiday left now</dt>
                          <dd className="font-bold tabular-nums">{formatBalance(balance)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Planned work affected</dt>
                          <dd className="font-bold">
                            {impact.affected.length === 0 ? "None" : `${impact.affected.length} ${impact.affected.length === 1 ? "assignment" : "assignments"}`}
                          </dd>
                        </div>
                      </dl>
                      {gaps > 0 && (
                        <p className="mt-2 flex items-start gap-1.5 text-label font-semibold text-warning">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {gaps} planned {gaps === 1 ? "slot" : "slots"} would be left without cover.
                        </p>
                      )}
                      {r.note && <p className="mt-2 text-label text-muted">“{r.note}”</p>}
                      <div className="mt-3">
                        <AvailabilitySummary
                          compact
                          role={`${roleLabel[emp.role].toLowerCase()}s`}
                          days={impact.sameRoleOffByDate.map((d) => ({ date: d.date, label: formatDayKey(d.date, "short"), available: d.total - d.off, total: d.total }))}
                        />
                      </div>
                      <Link href={`/office/leave/${r.id}`} className={`${buttonClass({ variant: "primary" })} mt-4`}>
                        Review request <ArrowRight className="size-4" aria-hidden />
                        <span className="sr-only">from {emp.name}</span>
                      </Link>
                    </HolidayRequest>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {cancellations.length > 0 && (
          <section aria-labelledby="cancel-heading">
            <SectionHeading id="cancel-heading" title={`Cancellation requests (${cancellations.length})`} />
            {table(cancellations, "Cancellation requests")}
          </section>
        )}

        <section aria-labelledby="booked-heading">
          <SectionHeading id="booked-heading" title="Booked holiday" aside="Approved and upcoming" />
          {upcoming.length ? table(upcoming, "Booked holiday") : <EmptyState title="No upcoming approved holiday." />}
        </section>

        <Card title="Record holiday for an employee" aside="Approved straight away. The employee is notified.">
          <RecordLeaveForm employees={store.employees.map((e) => ({ id: e.id, name: e.name }))} />
        </Card>

        {past.length > 0 && (
          <section aria-labelledby="past-heading">
            <SectionHeading id="past-heading" title="History" />
            {table(past, "Holiday history")}
          </section>
        )}
      </div>
    </>
  );
}
