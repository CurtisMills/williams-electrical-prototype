import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, Stat, td, th } from "@/components/office/kit";
import { Avatar } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatClock, formatDayKey, formatDuration, timeAgo, todayKey, ukHour } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { exceptions, teamStatusMeta, teamToday, type TeamStatus } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today" };

export default async function OfficeTodayPage() {
  const { user } = await requireRole("office");
  const store = await readStore();
  const now = new Date();
  const today = todayKey(now);
  const team = teamToday(store, now);
  const items = exceptions(store, now);
  const count = (s: TeamStatus) => team.filter((t) => t.status === s).length;
  const pendingLeave = store.leave.filter((l) => l.status === "pending" || (l.status === "approved" && l.cancellation)).length;
  const staffingGaps = items.filter((i) => i.kind === "needs_replacement" || i.kind === "unfilled").length;
  const timeIssues = items.filter((i) => !["needs_replacement", "unfilled", "timesheet_review"].includes(i.kind)).length;

  return (
    <>
      <PageHeader overline={formatDayKey(today, "full").toUpperCase()} title={`Good ${ukHour() < 12 ? "morning" : ukHour() < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`}>
        Who is working where right now, based on what employees have recorded on their phones. Updates every 20 seconds.
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Working" value={count("working")} tone={count("working") ? "good" : "plain"} />
        <Stat label="On a recorded break" value={count("on_break")} />
        <Stat label="No start recorded" value={count("no_start")} tone={count("no_start") ? "warn" : "plain"} note="Information gap, not absence" />
        <Stat label="On approved leave" value={count("on_leave")} />
        <Stat label="Time issues to review" value={timeIssues} tone={timeIssues ? "warn" : "plain"} href="/office/exceptions" />
        <Stat label="Leave requests waiting" value={pendingLeave} tone={pendingLeave ? "warn" : "plain"} href="/office/leave" note={staffingGaps ? `${staffingGaps} staffing gaps ahead` : undefined} />
      </div>

      <Card title="Team today" aside={`${team.length} employees`}>
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60">
              <tr>
                <th className={th}>Employee</th>
                <th className={th}>Status</th>
                <th className={th}>Planned</th>
                <th className={th}>Recorded now</th>
                <th className={th}>First start</th>
                <th className={th}>Worked today</th>
                <th className={th}>Last update received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {team.map((m) => {
                const meta = teamStatusMeta[m.status];
                const plannedIds = m.planned.map((p) => p.job.id);
                const offPlan = m.open && m.open.jobId && !plannedIds.includes(m.open.jobId);
                return (
                  <tr key={m.employee.id} className={m.status === "no_start" ? "bg-amber-50/50" : undefined}>
                    <td className={td}>
                      <Link href={`/office/history?employee=${m.employee.id}&from=${today}&to=${today}`} className="flex items-center gap-2.5 font-bold hover:underline">
                        <Avatar initials={m.employee.initials} className="h-8 w-8" />
                        <span>
                          {m.employee.name}
                          <span className="block text-xs font-normal text-ink-500">{roleLabel[m.employee.role]}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={td}>
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-extrabold whitespace-nowrap ring-1 ring-inset ${meta.tone}`}>{meta.label}</span>
                      {m.openIsOld && <span className="mt-1 block text-xs font-bold text-signal-700">Open since an earlier day</span>}
                      {m.absences.length > 0 && m.status !== "on_leave" && (
                        <span className="mt-1 block text-xs text-violet-800">{m.absences.map((a) => a.label).join(", ")}</span>
                      )}
                    </td>
                    <td className={td}>
                      {m.planned.length === 0 && m.replaced.length === 0 && <span className="text-ink-400">Nothing planned</span>}
                      {m.planned.map((p) => (
                        <span key={p.assignment.id} className="block">
                          <span className="font-mono text-xs font-bold">{p.assignment.start}</span> {p.job.ref} · {p.site.name}
                        </span>
                      ))}
                      {m.replaced.map((a) => (
                        <span key={a.id} className="block text-xs text-ink-400 line-through">
                          {a.start} {store.jobs.find((j) => j.id === a.jobId)?.ref} (replaced)
                        </span>
                      ))}
                    </td>
                    <td className={td}>
                      {m.open ? (
                        <>
                          <span className="block font-bold">
                            {m.openJob ? `${m.openJob.ref} · ${m.openSite?.name ?? ""}` : `${activityLabel[m.open.activity]}${m.open.note ? `: ${m.open.note}` : ""}`}
                          </span>
                          {offPlan && <span className="text-xs font-bold text-amber-800">Not the planned job</span>}
                          {m.open.source === "phone_offline" && <span className="block text-xs text-ink-500">Sent after reconnecting</span>}
                        </>
                      ) : (
                        <span className="text-ink-400">–</span>
                      )}
                    </td>
                    <td className={td}>{m.firstRecordedStart ? formatClock(m.firstRecordedStart) : <span className="text-ink-400">–</span>}</td>
                    <td className={`${td} font-mono`}>{m.workedToday ? formatDuration(m.workedToday) : "–"}</td>
                    <td className={td}>
                      {m.lastUpdate ? (
                        <>
                          <span className="block">{timeAgo(m.lastUpdate)}</span>
                          <span className="text-xs text-ink-500">{formatDayKey(m.lastUpdate.slice(0, 10), "dm")} {formatClock(m.lastUpdate)}</span>
                        </>
                      ) : (
                        <span className="text-ink-400">Never</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-ink-500">
        “No start recorded” appears {store.settings.noStartGraceMinutes} minutes after a planned start with nothing received from the phone. It means we
        haven’t heard, not that the person is absent: they may have no signal or forgotten to tap Start.
      </p>

      {items.length > 0 && (
        <Card title="Needs attention" aside={<Link href="/office/exceptions" className="font-bold text-signal-700">See all {items.length}</Link>} className="mt-6">
          <ul className="divide-y divide-ink-50">
            {items.slice(0, 6).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block font-bold">{i.title}</span>
                  <span className="text-sm text-ink-600">{i.detail}</span>
                </span>
                <Link href={i.href} className="shrink-0 text-sm font-extrabold text-signal-700 hover:underline">
                  {i.action} →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
