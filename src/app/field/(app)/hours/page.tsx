import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Overline, Pill, TimesheetPill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, dateKeyOf, formatClock, formatDateRange, formatDayKey, formatDuration, formatWhen, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { portionLabel } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { weekSummary } from "@/lib/we/timesheets";
import { lookup, selectableJobs } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";
import { CorrectionButton, CorrectionForm, SubmitWeek } from "./HoursActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My hours" };

export default async function MyHoursPage(props: PageProps<"/field/hours">) {
  const { user } = await requireRole("engineer");
  const sp = await props.searchParams;
  const today = todayKey();
  const current = weekStartOf(today);
  const requested = typeof sp.week === "string" && isDateKey(sp.week) ? weekStartOf(sp.week) : current;
  const week = requested > current ? current : requested;
  const store = await readStore();
  const l = lookup(store);
  const summary = weekSummary(store, user.id, week);
  const jobs = selectableJobs(store);
  const corrections = store.corrections
    .filter((c) => c.employeeId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const pendingFor = new Set(store.corrections.filter((c) => c.status === "pending" && c.sessionId).map((c) => c.sessionId));
  const sheet = summary.sheet;
  const canSubmit = sheet.status === "draft" || sheet.status === "changes_requested";

  return (
    <section aria-labelledby="hours-heading">
      <Overline>TIMESHEET</Overline>
      <h1 id="hours-heading" className="mb-4 text-2xl font-extrabold tracking-tight">
        My hours
      </h1>

      <nav aria-label="Choose week" className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-ink-100 bg-white p-1.5">
        <Link href={`/field/hours?week=${addDays(week, -7)}`} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-ink-50" aria-label="Previous week">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="text-sm font-extrabold">{formatDateRange(week, summary.weekEnd)}</p>
          <p className="text-xs text-ink-500">{week === current ? "This week" : week === addDays(current, -7) ? "Last week" : "Monday to Sunday"}</p>
        </div>
        {week < current ? (
          <Link href={`/field/hours?week=${addDays(week, 7)}`} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-ink-50" aria-label="Next week">
            <ChevronRight className="h-5 w-5" />
          </Link>
        ) : (
          <span className="h-11 w-11" />
        )}
      </nav>

      <div className="mb-5 rounded-2xl bg-ink-900 p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-ink-300">Total recorded</p>
            <p className="text-3xl font-extrabold">{formatDuration(summary.totalMinutes)}</p>
            <p className="text-xs text-ink-300">
              {formatDuration(summary.jobMinutes)} on jobs · {formatDuration(summary.otherMinutes)} travel and other
              {summary.leaveDays > 0 && ` · ${summary.leaveDays} leave ${summary.leaveDays === 1 ? "day" : "days"}`}
            </p>
          </div>
          <TimesheetPill status={sheet.status} />
        </div>
        {sheet.status === "changes_requested" && sheet.returnReason && (
          <p className="mt-3 rounded-lg bg-amber-300 p-2.5 text-sm font-bold text-ink-950">Office: {sheet.returnReason}</p>
        )}
        {sheet.reopenedReason && sheet.status === "submitted" && sheet.revision > 1 && (
          <p className="mt-3 rounded-lg bg-white/10 p-2.5 text-sm">Reopened after a change: {sheet.reopenedReason}</p>
        )}
        {sheet.status === "approved" && sheet.approvedAt && (
          <p className="mt-3 text-sm text-ink-200">Approved {formatWhen(sheet.approvedAt)}. Any correction will send it back to the office.</p>
        )}
        {sheet.status === "submitted" && <p className="mt-3 text-sm text-ink-200">With the office for approval.</p>}
        {canSubmit && (
          <div className="mt-4">
            <SubmitWeek weekStart={week} blocked={summary.openSessions.length > 0} />
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {summary.days.map((d) => (
          <li key={d.date} className="rounded-xl border border-ink-100 bg-white">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5">
              <p className="text-sm font-extrabold">{formatDayKey(d.date, "short")}</p>
              <div className="flex items-center gap-2">
                {d.leave && <Pill tone="violet">Leave{d.leave.portion === "full" ? "" : `: ${portionLabel[d.leave.portion].toLowerCase()}`}</Pill>}
                {d.unavailable && <Pill tone="grey">{d.unavailable}</Pill>}
                <span className="font-mono text-sm font-bold">{d.netMinutes ? formatDuration(d.netMinutes) : "–"}</span>
              </div>
            </div>
            {d.lines.length > 0 && (
              <ul className="divide-y divide-ink-50 border-t border-ink-50">
                {d.lines.map((line) => {
                  const s = line.session;
                  const job = l.job(s.jobId);
                  const crossesMidnight = dateKeyOf(s.startedAt) !== dateKeyOf(s.finishedAt!);
                  return (
                    <li key={`${s.id}-${line.date}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{job ? `${job.ref} · ${job.title}` : `${activityLabel[s.activity]}${s.note ? `: ${s.note}` : ""}`}</p>
                        <p className="text-xs text-ink-500">
                          {formatClock(s.startedAt)}–{formatClock(s.finishedAt!)}
                          {crossesMidnight && " (crosses midnight, split by day)"}
                          {line.breakMinutes > 0 && ` · ${line.breakMinutes} min break`}
                          {s.edited && " · corrected"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono font-bold">{formatDuration(line.netMinutes)}</span>
                        {pendingFor.has(s.id) ? (
                          <Pill tone="amber">Change asked</Pill>
                        ) : (
                          <CorrectionButton
                            jobs={jobs}
                            initial={{
                              sessionId: s.id,
                              date: dateKeyOf(s.startedAt),
                              start: formatClock(s.startedAt),
                              finish: formatClock(s.finishedAt!),
                              finishNextDay: crossesMidnight,
                              breakMinutes: line.breakMinutes,
                              jobId: s.jobId,
                              activity: s.activity,
                            }}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {summary.openSessions.length > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">
          A record in this week has no finish time. Add it on the Today screen, or below, before submitting.
        </p>
      )}

      <div id="fix" className="mt-8 scroll-mt-24">
        <h2 className="mb-1 text-base font-extrabold">Forgot to record something?</h2>
        <p className="mb-3 text-sm text-ink-500">Tell the office what you worked. They’ll check it and add it to your hours.</p>
        <CorrectionForm jobs={jobs} initial={{ date: today }} />
      </div>

      {corrections.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-extrabold">Your change requests</h2>
          <ul className="space-y-2">
            {corrections.map((c) => (
              <li key={c.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">
                    {formatDayKey(c.proposed.date, "short")} · {c.proposed.start}–{c.proposed.finish}
                  </p>
                  <Pill tone={c.status === "pending" ? "amber" : c.status === "approved" ? "green" : "red"}>
                    {c.status === "pending" ? "Waiting for office" : c.status === "approved" ? "Approved" : "Not approved"}
                  </Pill>
                </div>
                <p className="text-ink-600">{c.reason}</p>
                {c.decisionNote && <p className="mt-1 text-ink-700">Office: {c.decisionNote}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
