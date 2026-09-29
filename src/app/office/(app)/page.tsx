import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Clock, Inbox, PlayCircle, X } from "lucide-react";
import { AvailabilitySummary } from "@/components/portal/AvailabilitySummary";
import { buttonClass } from "@/components/portal/button";
import { HolidayRequest } from "@/components/portal/HolidayRequest";
import { Card, EmptyState, PageHeading, SectionHeading, SummaryCount, td, th } from "@/components/portal/layout";
import { CrewStatusBadge } from "@/components/portal/status";
import { requireRole } from "@/lib/auth/session";
import { dayCount, formatClock, formatDateRange, formatDayKey, formatDuration, timeAgo, todayKey } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { leaveImpact } from "@/lib/we/planning";
import { holidayWording } from "@/lib/we/present";
import { readStore } from "@/lib/we/store";
import { exceptions, teamStatusMeta, teamToday, type TeamStatus } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today" };

const filters: Record<string, { label: string; statuses: TeamStatus[] }> = {
  working: { label: "Working", statuses: ["working", "on_break"] },
  due: { label: "Due to start", statuses: ["due_later"] },
  no_start: { label: "No start recorded", statuses: ["no_start"] },
  on_leave: { label: "On holiday", statuses: ["on_leave"] },
};

export default async function OfficeTodayPage(props: PageProps<"/office">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const store = await readStore();
  const now = new Date();
  const today = todayKey(now);
  const team = teamToday(store, now);
  const items = exceptions(store, now);
  const count = (...s: TeamStatus[]) => team.filter((t) => s.includes(t.status)).length;
  const pending = store.leave.filter((l) => l.status === "pending").sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  const cancellations = store.leave.filter((l) => l.status === "approved" && l.cancellation).length;
  const filterKey = typeof sp.show === "string" && sp.show in filters ? sp.show : null;
  const filter = filterKey ? filters[filterKey] : null;
  const shown = filter ? team.filter((m) => filter.statuses.includes(m.status)) : team;
  const name = (id: string) => store.employees.find((e) => e.id === id)?.name ?? id;

  const rows = shown.map((m) => {
    const plannedIds = m.planned.map((p) => p.job.id);
    const offPlan = !!(m.open && m.open.jobId && !plannedIds.includes(m.open.jobId));
    const where = m.open
      ? m.openJob
        ? { primary: `${m.openJob.title}`, secondary: `${m.openJob.ref} · ${m.openSite?.name ?? ""}` }
        : { primary: `${activityLabel[m.open.activity]}${m.open.note ? `: ${m.open.note}` : ""}`, secondary: "" }
      : m.planned[0]
        ? { primary: m.planned[0].job.title, secondary: `${m.planned[0].job.ref} · ${m.planned[0].site.name}${m.planned.length > 1 ? ` (+${m.planned.length - 1} more)` : ""}` }
        : null;
    const when = m.firstRecordedStart
      ? `Started ${formatClock(m.firstRecordedStart)}`
      : m.status === "on_leave"
        ? m.absences.map((a) => holidayWording(a.label)).join(", ")
        : m.planned[0]
          ? `Expected ${m.planned[0].assignment.start}`
          : "";
    return { m, offPlan, where, when };
  });

  return (
    <>
      <PageHeading eyebrow={formatDayKey(today, "full")} title="The crew today">
        Based on what employees have recorded on their phones. Refreshes every 20 seconds.
      </PageHeading>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCount
          label="Working"
          value={count("working", "on_break")}
          icon={PlayCircle}
          tone="success"
          href="/office?show=working#crew"
          note={count("on_break") ? `${count("on_break")} on a break` : "On a job now"}
        />
        <SummaryCount label="Due to start" value={count("due_later")} icon={Clock} tone="info" href="/office?show=due#crew" note="Planned later today" />
        <SummaryCount
          label="No start recorded"
          value={count("no_start")}
          icon={AlertTriangle}
          tone={count("no_start") ? "warning" : "neutral"}
          href="/office?show=no_start#crew"
          note="Missing information, not absence"
        />
        <SummaryCount label="On holiday" value={count("on_leave")} icon={CalendarDays} tone="info" href="/office?show=on_leave#crew" note="Approved holiday today" />
        <SummaryCount
          label="Holiday requests"
          value={pending.length}
          icon={Inbox}
          tone={pending.length ? "warning" : "neutral"}
          href="/office/leave#waiting"
          note={cancellations ? `Plus ${cancellations} cancellation ${cancellations === 1 ? "request" : "requests"}` : "Waiting for review"}
        />
      </div>

      <section id="crew" aria-labelledby="crew-heading" className="scroll-mt-28">
        <SectionHeading
          id="crew-heading"
          title={filter ? `Crew today: ${filter.label.toLowerCase()}` : "Crew today"}
          aside={
            filter ? (
              <Link href="/office#crew" className="inline-flex min-h-12 items-center gap-1 font-bold text-primary hover:underline">
                <X className="size-4" aria-hidden /> Show everyone ({team.length})
              </Link>
            ) : (
              `${team.length} employees`
            )
          }
        />
        {rows.length === 0 ? (
          <EmptyState title={`Nobody is ${filter?.label.toLowerCase() ?? "listed"} right now.`} />
        ) : (
          <div className="rounded-card border border-line bg-surface">
            <ul className="divide-y divide-line md:hidden">
              {rows.map(({ m, offPlan, where, when }) => (
                <li key={m.employee.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/office/history?employee=${m.employee.id}&from=${today}&to=${today}`} className="min-w-0 py-1 font-bold hover:underline">
                      {m.employee.name}
                      <span className="block text-label font-normal text-muted">{roleLabel[m.employee.role]}</span>
                    </Link>
                    <CrewStatusBadge status={m.status} label={teamStatusMeta[m.status].label} />
                  </div>
                  {where && (
                    <p className="mt-2 text-label">
                      <span className="font-semibold">{where.primary}</span>
                      {where.secondary && <span className="block text-muted">{where.secondary}</span>}
                    </p>
                  )}
                  <p className="mt-1 text-label text-muted tabular-nums">
                    {[when, m.workedToday ? `${formatDuration(m.workedToday)} worked` : ""].filter(Boolean).join(" · ")}
                  </p>
                  <RowNotes m={m} offPlan={offPlan} />
                </li>
              ))}
            </ul>
            <div className="hidden relative overflow-x-auto md:block">
              <table className="w-full text-body">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>Crew member</th>
                    <th className={th}>Status</th>
                    <th className={th}>Job / site</th>
                    <th className={th}>Start</th>
                    <th className={`${th} text-right`}>Worked</th>
                    <th className={`${th} hidden xl:table-cell`}>Last update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(({ m, offPlan, where, when }) => (
                    <tr key={m.employee.id}>
                      <td className={td}>
                        <Link href={`/office/history?employee=${m.employee.id}&from=${today}&to=${today}`} className="-my-3 inline-block py-3 font-bold hover:underline">
                          {m.employee.name}
                        </Link>
                        <span className="block text-label text-muted">{roleLabel[m.employee.role]}</span>
                      </td>
                      <td className={td}>
                        <CrewStatusBadge status={m.status} label={teamStatusMeta[m.status].label} />
                        <RowNotes m={m} offPlan={offPlan} />
                      </td>
                      <td className={td}>
                        {where ? (
                          <>
                            <span className="block">{where.primary}</span>
                            {where.secondary && <span className="block text-label text-muted">{where.secondary}</span>}
                          </>
                        ) : (
                          <span className="text-muted">Nothing planned</span>
                        )}
                      </td>
                      <td className={`${td} tabular-nums`}>{when || <span className="text-muted">None</span>}</td>
                      <td className={`${td} text-right tabular-nums`}>{m.workedToday ? formatDuration(m.workedToday) : <span className="text-muted">None</span>}</td>
                      <td className={`${td} hidden xl:table-cell`}>
                        {m.lastUpdate ? (
                          <>
                            <span className="block">{timeAgo(m.lastUpdate)}</span>
                            <span className="text-label text-muted tabular-nums">
                              {formatDayKey(m.lastUpdate.slice(0, 10), "dm")} {formatClock(m.lastUpdate)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">Never</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-3 text-label text-muted">
          “No start recorded” appears {store.settings.noStartGraceMinutes} minutes after a planned start with nothing received from the phone. It means we haven’t
          heard, not that the person is absent: they may have no signal or forgotten to tap Start.
        </p>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="requests-heading">
          <SectionHeading
            id="requests-heading"
            title="Holiday requests"
            aside={
              <Link href="/office/leave" className="inline-flex min-h-12 items-center font-bold text-primary hover:underline">
                All holiday
              </Link>
            }
          />
          {pending.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No holiday requests waiting." />
          ) : (
            <ul className="space-y-3">
              {pending.slice(0, 3).map((r) => {
                const impact = leaveImpact(store, r);
                const emp = impact.employee;
                return (
                  <li key={r.id}>
                    <HolidayRequest who={name(r.employeeId)} range={formatDateRange(r.firstDay, r.lastDay)} days={dayCount(r.totalDays)} reference={r.id} status={r.status}>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <AvailabilitySummary
                          compact
                          role={`${roleLabel[emp.role].toLowerCase()}s`}
                          days={impact.sameRoleOffByDate.map((d) => ({
                            date: d.date,
                            label: formatDayKey(d.date, "short"),
                            available: d.total - d.off,
                            total: d.total,
                          }))}
                        />
                        <Link href={`/office/leave/${r.id}`} className={buttonClass({ variant: "secondary" })}>
                          Review request <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </div>
                    </HolidayRequest>
                  </li>
                );
              })}
              {pending.length > 3 && (
                <li>
                  <Link href="/office/leave#waiting" className="inline-flex min-h-12 items-center font-bold text-primary hover:underline">
                    {pending.length - 3} more waiting
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="attention-heading">
          <SectionHeading
            id="attention-heading"
            title="Needs attention"
            aside={
              items.length > 0 && (
                <Link href="/office/exceptions" className="inline-flex min-h-12 items-center font-bold text-primary hover:underline">
                  See all {items.length}
                </Link>
              )
            }
          />
          {items.length === 0 ? (
            <EmptyState title="Nothing needs attention." />
          ) : (
            <Card flush>
              <ul className="divide-y divide-line">
                {items.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
                    <span className="min-w-0">
                      <span className="block font-semibold">{i.title}</span>
                      <span className="text-label text-muted">{i.detail}</span>
                    </span>
                    <Link href={i.href} className="inline-flex min-h-12 shrink-0 items-center gap-1 text-label font-bold text-primary hover:underline">
                      {i.action} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

function RowNotes({ m, offPlan }: { m: ReturnType<typeof teamToday>[number]; offPlan: boolean }) {
  const notes: string[] = [];
  if (m.openIsOld) notes.push("Open since an earlier day");
  if (offPlan) notes.push("Not the planned job");
  if (m.open?.source === "phone_offline") notes.push("Sent after reconnecting");
  const absences = m.status !== "on_leave" ? m.absences.map((a) => holidayWording(a.label)) : [];
  if (!notes.length && !absences.length) return null;
  return (
    <span className="mt-1 block space-y-0.5 text-label">
      {notes.map((n) => (
        <span key={n} className="flex items-center gap-1 font-semibold text-warning">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {n}
        </span>
      ))}
      {absences.length > 0 && (
        <span className="flex items-center gap-1 text-info">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          {absences.join(", ")}
        </span>
      )}
    </span>
  );
}
