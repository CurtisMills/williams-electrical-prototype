import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeading, SectionHeading } from "@/components/portal/layout";
import { Notice } from "@/components/portal/notice";
import { StatusBadge, TimesheetBadge } from "@/components/portal/status";
import { TimeRecord } from "@/components/portal/TimeRecord";
import { requireRole } from "@/lib/auth/session";
import { addDays, dateKeyOf, formatClock, formatDateRange, formatDayKey, formatDuration, formatWhen, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { portionLabel } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { weekSummary } from "@/lib/we/timesheets";
import { lookup, selectableJobs } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";
import { CorrectionButton, CorrectionForm, SubmitWeek } from "./HoursActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My time" };

const correctionStatus = {
  pending: { tone: "warning", label: "Waiting for the office" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "neutral", label: "Not approved" },
} as const;

export default async function MyTimePage(props: PageProps<"/field/hours">) {
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
  const weekName = week === current ? "This week" : week === addDays(current, -7) ? "Last week" : "Monday to Sunday";

  return (
    <section aria-labelledby="time-heading">
      <PageHeading id="time-heading" eyebrow="Time" title="My time" />

      <nav aria-label="Choose week" className="mb-4 flex items-center justify-between gap-2 rounded-card border border-line bg-surface p-1">
        <Link href={`/field/hours?week=${addDays(week, -7)}`} className="grid size-12 place-items-center rounded-control hover:bg-subtle" aria-label="Previous week">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="text-center">
          <p className="font-bold">{formatDateRange(week, summary.weekEnd)}</p>
          <p className="text-label text-muted">{weekName}</p>
        </div>
        {week < current ? (
          <Link href={`/field/hours?week=${addDays(week, 7)}`} className="grid size-12 place-items-center rounded-control hover:bg-subtle" aria-label="Next week">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-12" aria-hidden />
        )}
      </nav>

      <div className="mb-6 rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-label font-semibold text-muted">Total recorded</p>
            <p className="text-figure font-bold tabular-nums">{formatDuration(summary.totalMinutes)}</p>
            <p className="mt-1 text-label text-muted tabular-nums">
              {formatDuration(summary.jobMinutes)} on jobs · {formatDuration(summary.otherMinutes)} travel and other
              {summary.leaveDays > 0 && ` · ${summary.leaveDays} holiday ${summary.leaveDays === 1 ? "day" : "days"}`}
            </p>
          </div>
          <TimesheetBadge status={sheet.status} />
        </div>
        <div className="mt-4 space-y-3 empty:hidden">
          {sheet.status === "changes_requested" && sheet.returnReason && (
            <Notice tone="warning" title="The office asked for changes">
              {sheet.returnReason}
            </Notice>
          )}
          {sheet.reopenedReason && sheet.status === "submitted" && sheet.revision > 1 && <Notice tone="info">Reopened after a change: {sheet.reopenedReason}</Notice>}
          {sheet.status === "approved" && sheet.approvedAt && (
            <p className="text-label text-muted">Approved {formatWhen(sheet.approvedAt)}. Any correction sends it back to the office.</p>
          )}
          {sheet.status === "submitted" && <p className="text-label text-muted">With the office for approval.</p>}
          {canSubmit && <SubmitWeek weekStart={week} blocked={summary.openSessions.length > 0} />}
        </div>
      </div>

      {summary.openSessions.length > 0 && (
        <Notice tone="warning" icon={AlertTriangle} className="mb-4" title="A record this week has no finish time">
          Add it on Today, or ask for a correction below, before sending the week.
        </Notice>
      )}

      <ul className="space-y-3">
        {summary.days.map((d) => (
          <li key={d.date} className="rounded-card border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <h2 className="font-bold">{formatDayKey(d.date, "short")}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {d.leave && (
                  <StatusBadge tone="info" icon={CalendarDays}>
                    Holiday{d.leave.portion === "full" ? "" : `: ${portionLabel[d.leave.portion].toLowerCase()}`}
                  </StatusBadge>
                )}
                {d.unavailable && <StatusBadge tone="neutral">{d.unavailable}</StatusBadge>}
                <span className="font-bold tabular-nums">{d.netMinutes ? formatDuration(d.netMinutes) : <span className="text-muted">No time</span>}</span>
              </div>
            </div>
            {d.lines.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {d.lines.map((line) => {
                  const s = line.session;
                  const job = l.job(s.jobId);
                  const crossesMidnight = dateKeyOf(s.startedAt) !== dateKeyOf(s.finishedAt!);
                  const title = job ? `${job.ref} · ${job.title}` : `${activityLabel[s.activity]}${s.note ? `: ${s.note}` : ""}`;
                  const times = `${formatClock(s.startedAt)}–${formatClock(s.finishedAt!)}`;
                  return (
                    <TimeRecord
                      key={`${s.id}-${line.date}`}
                      title={title}
                      times={times}
                      detail={[crossesMidnight && "crosses midnight, split by day", line.breakMinutes > 0 && `${line.breakMinutes} min break`].filter(Boolean).join(" · ") || undefined}
                      duration={formatDuration(line.netMinutes)}
                      state={pendingFor.has(s.id) ? "change_requested" : s.edited ? "corrected" : "saved"}
                      action={
                        pendingFor.has(s.id) ? undefined : (
                          <CorrectionButton
                            jobs={jobs}
                            label={`${title}, ${times}`}
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
                        )
                      }
                    />
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div id="fix" className="mt-10 scroll-mt-24">
        <SectionHeading title="Forgot to record something?" />
        <p className="-mt-1 mb-4 text-label text-muted">Tell the office what you worked. They’ll check it and add it to your time.</p>
        <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <CorrectionForm jobs={jobs} initial={{ date: today }} />
        </div>
      </div>

      {corrections.length > 0 && (
        <div className="mt-10">
          <SectionHeading title="Your correction requests" />
          <ul className="space-y-3">
            {corrections.map((c) => {
              const m = correctionStatus[c.status];
              return (
                <li key={c.id} className="rounded-card border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold tabular-nums">
                      {formatDayKey(c.proposed.date, "short")} · {c.proposed.start}–{c.proposed.finish}
                    </p>
                    <StatusBadge tone={m.tone}>{m.label}</StatusBadge>
                  </div>
                  <p className="mt-1 text-label text-ink">{c.reason}</p>
                  {c.decisionNote && <p className="mt-1 text-label text-muted">Office: {c.decisionNote}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
