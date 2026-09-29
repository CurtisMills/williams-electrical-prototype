import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActionButton, ReasonAction } from "@/components/office/actions";
import { Card, PageHeader, Stat, td, th } from "@/components/office/kit";
import { Pill, TimesheetPill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, dateKeyOf, formatClock, formatDateRange, formatDayKey, formatDuration, formatWhen, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { portionLabel } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { weekSummary } from "@/lib/we/timesheets";
import { lookup } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Timesheet" };

export default async function EmployeeTimesheetPage(props: PageProps<"/office/timesheets/[employeeId]">) {
  await requireRole("office");
  const { employeeId } = await props.params;
  const sp = await props.searchParams;
  const store = await readStore();
  const employee = store.employees.find((e) => e.id === employeeId);
  if (!employee) notFound();
  const week = weekStartOf(isDateKey(sp.week) ? sp.week : addDays(todayKey(), -7));
  const s = weekSummary(store, employeeId, week);
  const l = lookup(store);
  const sheet = s.sheet;
  const names = new Map([...store.employees.map((e) => [e.id, e.name] as const), ["office-megan", "Megan Lloyd"], ["office-gareth", "Gareth Williams"]]);
  const diff = s.totalMinutes - s.previousWeekMinutes;

  return (
    <>
      <PageHeader
        overline="Timesheet"
        title={`${employee.name}, ${formatDateRange(week, s.weekEnd)}`}
        aside={
          <>
            <Link href={`/office/timesheets/${employeeId}?week=${addDays(week, -7)}`} className="grid size-12 place-items-center rounded-control border border-line bg-surface" aria-label="Previous week">
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <Link href={`/office/timesheets/${employeeId}?week=${addDays(week, 7)}`} className="grid size-12 place-items-center rounded-control border border-line bg-surface" aria-label="Next week">
              <ChevronRight className="size-5" aria-hidden />
            </Link>
            <Link href={`/office/timesheets?week=${week}`} className="inline-flex min-h-12 items-center text-label font-bold text-primary hover:underline">
              All timesheets
            </Link>
          </>
        }
      >
        <span className="inline-flex items-center gap-2">
          <TimesheetPill status={sheet.status} /> Revision {sheet.revision}
          {sheet.submittedAt && ` · submitted ${formatWhen(sheet.submittedAt)}`}
        </span>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total recorded" value={formatDuration(s.totalMinutes)} />
        <Stat label="On jobs" value={formatDuration(s.jobMinutes)} note={`${formatDuration(s.otherMinutes)} travel and other`} />
        <Stat
          label="Previous week"
          value={formatDuration(s.previousWeekMinutes)}
          note={s.previousWeekMinutes > 0 ? `${diff >= 0 ? "+" : "−"}${formatDuration(Math.abs(diff))} this week` : undefined}
        />
        <Stat label="Holiday" value={s.leaveDays ? `${s.leaveDays} day${s.leaveDays === 1 ? "" : "s"}` : "None"} />
      </div>

      {sheet.reopenedReason && sheet.revision > 1 && sheet.status !== "approved" && (
        <p className="mb-4 rounded-card border border-warning/40 bg-warning-surface p-3 text-sm text-warning">
          <span className="font-bold">Reopened after approval:</span> {sheet.reopenedReason}. Exports that used the earlier revision are marked superseded.
        </p>
      )}
      {s.openSessions.length > 0 && (
        <p className="mb-4 rounded-card bg-warning-surface p-3 text-sm font-bold text-warning">
          {s.openSessions.length} record(s) have no finish time.{" "}
          {s.openSessions.map((o) => (
            <Link key={o.id} href={`/office/records/${o.id}`} className="underline">
              Fix {o.id}
            </Link>
          ))}
        </p>
      )}

      <Card title="Recorded sessions">
        <div className="-mx-5 -my-5 relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-subtle">
              <tr>
                <th className={th}>Day</th>
                <th className={th}>Job / activity</th>
                <th className={th}>Times</th>
                <th className={th}>Break</th>
                <th className={th}>Hours</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.days.map((d) => (
                <Fragment key={d.date}>
                  {d.lines.length === 0 ? (
                    <tr>
                      <td className={`${td} whitespace-nowrap font-bold`}>{formatDayKey(d.date, "short")}</td>
                      <td className={td} colSpan={5}>
                        {d.leave ? (
                          <Pill tone="violet">Approved leave{d.leave.portion !== "full" ? `: ${portionLabel[d.leave.portion].toLowerCase()}` : ""}</Pill>
                        ) : d.unavailable ? (
                          <Pill tone="grey">{d.unavailable}</Pill>
                        ) : (
                          <span className="text-muted">Nothing recorded</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    d.lines.map((line, i) => {
                      const job = l.job(line.session.jobId);
                      return (
                        <tr key={`${line.session.id}-${d.date}`}>
                          <td className={`${td} whitespace-nowrap font-bold`}>
                            {i === 0 && formatDayKey(d.date, "short")}
                            {i === 0 && d.leave && (
                              <span className="block">
                                <Pill tone="violet">Holiday {portionLabel[d.leave.portion].toLowerCase()}</Pill>
                              </span>
                            )}
                          </td>
                          <td className={td}>
                            {job ? `${job.ref} · ${job.title}` : `${activityLabel[line.session.activity]}${line.session.note ? `: ${line.session.note}` : ""}`}
                            {line.session.edited && <span className="ml-1"><Pill tone="grey">Corrected</Pill></span>}
                          </td>
                          <td className={`${td} tabular-nums whitespace-nowrap`}>
                            {formatClock(line.session.startedAt)}–{formatClock(line.session.finishedAt!)}
                            {dateKeyOf(line.session.startedAt) !== dateKeyOf(line.session.finishedAt!) && <span className="block font-sans text-xs text-muted">split at midnight</span>}
                          </td>
                          <td className={`${td} tabular-nums`}>{Math.round(line.breakMinutes)}m</td>
                          <td className={`${td} tabular-nums font-bold`}>{formatDuration(line.netMinutes)}</td>
                          <td className={td}>
                            <Link href={`/office/records/${line.session.id}`} className="font-bold text-primary hover:underline">
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Decision" className="mt-6">
        {sheet.status === "submitted" ? (
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton
              url="/api/office/timesheets"
              body={{ employeeId, weekStart: week, decision: "approve", version: sheet.version }}
              tone="dark"
              success="Approved. Final exports will include this week."
            >
              Approve {formatDuration(s.totalMinutes)}
            </ActionButton>
            <ReasonAction
              url="/api/office/timesheets"
              body={{ employeeId, weekStart: week, decision: "return", version: sheet.version }}
              label="Request changes"
              reasonLabel="What needs changing? (shown to the employee)"
            />
          </div>
        ) : sheet.status === "approved" ? (
          <p className="text-sm">
            Approved {sheet.approvedAt && formatWhen(sheet.approvedAt)} by {names.get(sheet.approvedBy ?? "") ?? "the office"} at {formatDuration(sheet.approvedMinutes ?? 0)}. Correcting any record in this week
            reopens it.
          </p>
        ) : (
          <p className="text-sm text-muted">
            {sheet.status === "draft" ? "Not submitted by the employee yet." : `Sent back to ${employee.name.split(" ")[0]}: “${sheet.returnReason}”`}
          </p>
        )}
        {sheet.history.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-sm font-bold">History</h3>
            <ol className="space-y-1 border-l-2 border-line pl-3 text-sm">
              {sheet.history.map((h, i) => (
                <li key={i}>
                  <span className="font-bold capitalize">{h.action.replace("_", " ")}</span> · revision {h.revision} · {names.get(h.by) ?? h.by} · {formatWhen(h.at)}
                  {h.reason && <span className="text-muted"> · “{h.reason}”</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>
    </>
  );
}
