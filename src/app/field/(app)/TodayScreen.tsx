"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CloudOff,
  Coffee,
  Play,
  PlayCircle,
  Search,
  Square,
  WifiOff,
} from "lucide-react";
import { useOffline, type WorkAction } from "@/components/field/OfflineQueue";
import { Button, buttonClass } from "@/components/portal/button";
import { Dialog } from "@/components/portal/Dialog";
import { CheckboxField, TextAreaField, TextField } from "@/components/portal/field";
import { JobCard } from "@/components/portal/JobCard";
import { EmptyState, SectionHeading } from "@/components/portal/layout";
import { FeedbackRegion, Notice, type NoticeTone } from "@/components/portal/notice";
import { StatusBadge } from "@/components/portal/status";
import { TimeRecord } from "@/components/portal/TimeRecord";
import { useAction } from "@/components/useAction";
import { formatClock, formatDuration } from "@/lib/field/dates";
import { holidayWording, pickFocusJob } from "@/lib/we/present";

export interface PlannedJob {
  key: string;
  jobId?: string;
  ref: string;
  title: string;
  customer: string;
  site: string;
  address: string;
  access: string;
  start: string;
  end: string;
  planned: string;
  recorded?: string[];
}

export interface TodayData {
  firstName: string;
  greeting: string;
  dateLabel: string;
  today: string;
  open: {
    id: string;
    jobId: string | null;
    activity: string;
    ref: string;
    jobTitle: string;
    title: string;
    site: string;
    startedAt: string;
    breakStartedAt: string | null;
    completedBreakMinutes: number;
    isOld: boolean;
    startDate: string;
    startDateLabel: string;
    startTime: string;
    note: string;
  } | null;
  planned: (PlannedJob & { jobId: string; recorded: string[] })[];
  absencesToday: string[];
  sessions: {
    id: string;
    title: string;
    site: string;
    start: string;
    finish: string | null;
    breakMinutes: number;
    netMinutes: number;
    edited: boolean;
    changeRequested: boolean;
  }[];
  upcoming: { date: string; label: string; short: string; working: boolean; holiday: string | null; absences: string[]; items: PlannedJob[] }[];
  jobs: { id: string; ref: string; title: string; site: string; address: string; customer: string }[];
  pendingCorrections: number;
}

type Target = { jobId: string | null; activity: "job" | "travel" | "other" | "unassigned"; note?: string; title: string; site: string };

interface Effective {
  state: "idle" | "working" | "break";
  title: string;
  site: string;
  jobId: string | null;
  activity: string;
  startedAt: string | null;
  breakStartedAt: string | null;
  completedBreakMinutes: number;
  savedOnPhone: boolean;
}

type Feedback = { tone: NoticeTone; title: string; text?: string };

function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Changes whenever the server's record of the open session changes. */
const openSignature = (open: TodayData["open"]) => (open ? `${open.id}|${open.breakStartedAt ?? ""}|${open.completedBreakMinutes}` : "none");

const pendingLabel: Record<WorkAction, string> = {
  start: "Starting…",
  switch: "Changing job…",
  break: "Starting break…",
  resume: "Resuming…",
  finish: "Finishing…",
};

export function TodayScreen({ data }: { data: TodayData }) {
  const { queue, online, syncing, lastSyncMessage, send } = useOffline();
  const now = useNow();
  const [pending, setPending] = useState<{ action: WorkAction; before: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [picker, setPicker] = useState<null | "start" | "switch">(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const signature = openSignature(data.open);

  // Stay pending until the refreshed server record arrives, so the screen never shows a stale
  // state with the buttons re-enabled. The timeout covers "already recorded" replies that change nothing.
  useEffect(() => {
    if (!pending) return;
    if (signature !== pending.before) {
      const t = window.setTimeout(() => setPending(null), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setPending(null), 6000);
    return () => window.clearTimeout(t);
  }, [pending, signature]);

  // Server state with anything still waiting on the phone applied on top.
  const effective = useMemo<Effective>(() => {
    const o = data.open;
    let e: Effective = o
      ? {
          state: o.breakStartedAt ? "break" : "working",
          title: o.title,
          site: o.site,
          jobId: o.jobId,
          activity: o.activity,
          startedAt: o.startedAt,
          breakStartedAt: o.breakStartedAt,
          completedBreakMinutes: o.completedBreakMinutes,
          savedOnPhone: false,
        }
      : { state: "idle", title: "", site: "", jobId: null, activity: "", startedAt: null, breakStartedAt: null, completedBreakMinutes: 0, savedOnPhone: false };
    for (const q of queue) {
      const [title, site = ""] = q.label.split(" @ ");
      if (q.action === "start" || q.action === "switch") {
        e = { state: "working", title, site, jobId: q.jobId ?? null, activity: q.activity ?? "job", startedAt: q.occurredAt, breakStartedAt: null, completedBreakMinutes: 0, savedOnPhone: true };
      } else if (q.action === "break" && e.state === "working") {
        e = { ...e, state: "break", breakStartedAt: q.occurredAt, savedOnPhone: true };
      } else if (q.action === "resume" && e.state === "break") {
        e = {
          ...e,
          state: "working",
          completedBreakMinutes: e.completedBreakMinutes + (Date.parse(q.occurredAt) - Date.parse(e.breakStartedAt!)) / 60000,
          breakStartedAt: null,
          savedOnPhone: true,
        };
      } else if (q.action === "finish") {
        e = { ...e, state: "idle", startedAt: null, breakStartedAt: null, savedOnPhone: true };
      }
    }
    return e;
  }, [data.open, queue]);

  const oldOpen = data.open?.isOld && !queue.length ? data.open : null;
  const busy = pending !== null;

  async function act(action: WorkAction, target?: Target) {
    if (pending) return;
    setPending({ action, before: signature });
    setFeedback(null);
    const label = target ? `${target.title}${target.site ? ` @ ${target.site}` : ""}` : `${effective.title}${effective.site ? ` @ ${effective.site}` : ""}`;
    const result = await send({
      action,
      jobId: target?.jobId ?? undefined,
      activity: target?.activity,
      note: target?.note,
      label: action === "start" || action === "switch" ? label : `${action[0].toUpperCase()}${action.slice(1)} · ${label}`,
    });
    setPicker(null);
    setConfirmFinish(false);
    if (result.status === "error") {
      setPending(null);
      setFeedback({ tone: "error", title: "Couldn’t save", text: result.message });
    } else if (result.status === "queued") {
      setPending(null);
      setFeedback({
        tone: "warning",
        title: "Saved on this phone, waiting to send",
        text: "It keeps the time you tapped and sends automatically when you have signal.",
      });
    } else {
      setFeedback({ tone: "success", title: result.message });
    }
  }

  const worked = effective.startedAt
    ? Math.max(
        0,
        (now - Date.parse(effective.startedAt)) / 60000 -
          effective.completedBreakMinutes -
          (effective.breakStartedAt ? (now - Date.parse(effective.breakStartedAt)) / 60000 : 0),
      )
    : 0;

  const recording = effective.state !== "idle" && !oldOpen;
  const activePlanned = recording ? data.planned.find((p) => p.jobId === effective.jobId) ?? null : null;
  const focus = recording || oldOpen ? null : pickFocusJob(data.planned, null);
  const otherJobs = data.planned.filter((p) => p !== focus && p !== activePlanned);
  const allRecorded = data.planned.length > 0 && !focus && !recording;

  const feedbackRegion = (
    <div role="status" aria-live="polite" aria-atomic="true" className="empty:hidden">
      {feedback && feedback.tone !== "error" && (
        <Notice tone={feedback.tone} title={feedback.title} live={false} icon={feedback.tone === "warning" ? CloudOff : undefined}>
          {feedback.text}
        </Notice>
      )}
    </div>
  );
  const errorRegion = (
    <div role="alert" aria-atomic="true" className="empty:hidden">
      {feedback?.tone === "error" && (
        <Notice tone="error" title={feedback.title} live={false}>
          {feedback.text}
        </Notice>
      )}
    </div>
  );

  return (
    <section aria-labelledby="today-heading">
      <div className="mb-5">
        <p className="mb-1 text-label font-semibold text-muted">{data.dateLabel}</p>
        <h1 id="today-heading" className="text-page-mobile font-bold tracking-[-0.02em] sm:text-page">
          {data.greeting}, {data.firstName}.
        </h1>
      </div>

      {(!online || queue.length > 0) && (
        <Notice
          tone="warning"
          icon={online ? CloudOff : WifiOff}
          className="mb-4"
          title={online ? (syncing ? "Sending saved times…" : "Saved on this phone, waiting to send") : "No signal"}
        >
          {queue.length ? (
            <>
              <p>
                {queue.length === 1 ? "1 tap is" : `${queue.length} taps are`} saved on this phone with the time you pressed. They send automatically; you can
                close the app.
              </p>
              <ul className="mt-2 space-y-0.5 tabular-nums">
                {queue.map((q) => (
                  <li key={q.clientEventId}>
                    {formatClock(q.occurredAt)} · {q.label.replace(" @ ", ", ")}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>You can still start, break and finish. Times are saved on this phone and sent when you’re back online.</p>
          )}
        </Notice>
      )}
      {lastSyncMessage && !queue.length && (
        <Notice tone={/not saved|clashes/.test(lastSyncMessage) ? "warning" : "success"} className="mb-4">
          {lastSyncMessage}
        </Notice>
      )}

      {oldOpen && <MissingFinish open={oldOpen} />}

      {data.absencesToday.length > 0 && (
        <Notice tone="info" icon={CalendarDays} className="mb-4" title={`Today: ${data.absencesToday.map(holidayWording).join(", ")}`} />
      )}

      <div className="space-y-3">
        {feedbackRegion}
        {errorRegion}

        {recording && (
          <JobCard
            headingId="active-job"
            active
            refCode={activePlanned?.ref ?? (data.open && !effective.savedOnPhone ? data.open.ref : undefined)}
            title={activePlanned?.title ?? (data.open && !effective.savedOnPhone ? data.open.jobTitle : effective.title)}
            customer={activePlanned?.customer}
            site={activePlanned?.site ?? effective.site}
            address={activePlanned?.address}
            planned={activePlanned?.planned}
            badge={
              <span className="flex flex-wrap gap-1">
                {effective.state === "break" ? (
                  <StatusBadge tone="neutral" icon={Coffee}>
                    On a break
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="success" icon={PlayCircle}>
                    On job
                  </StatusBadge>
                )}
                {effective.savedOnPhone && (
                  <StatusBadge tone="warning" icon={CloudOff}>
                    Waiting to send
                  </StatusBadge>
                )}
              </span>
            }
            state={
              <div className="rounded-control bg-success-surface px-4 py-3">
                <p className="font-bold text-success tabular-nums">
                  {effective.savedOnPhone ? `Tapped at ${formatClock(effective.startedAt!)}, saved on this phone` : `Started at ${formatClock(effective.startedAt!)}`}
                </p>
                <p className="text-label text-ink tabular-nums">
                  {formatDuration(Math.round(worked))} worked
                  {effective.state === "break" && effective.breakStartedAt && ` · on a break since ${formatClock(effective.breakStartedAt)}`}
                </p>
              </div>
            }
          >
            {confirmFinish ? (
              <div className="rounded-control border border-line p-4">
                <p className="mb-3 font-semibold">Finish {effective.activity === "job" ? "this job" : "now"} at {formatClock(new Date(now).toISOString())}?</p>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  <Button variant="primary" size="lg" busy={busy} busyLabel={pendingLabel.finish} onClick={() => act("finish")} autoFocus>
                    Yes, finish
                  </Button>
                  <Button variant="secondary" size="lg" disabled={busy} onClick={() => setConfirmFinish(false)}>
                    Not yet
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {effective.state === "break" ? (
                  <Button variant="primary" size="lg" full busy={pending?.action === "resume"} busyLabel={pendingLabel.resume} disabled={busy} onClick={() => act("resume")} icon={<Play className="size-5" aria-hidden />}>
                    Resume work
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" full disabled={busy} onClick={() => setConfirmFinish(true)} icon={<Square className="size-5" aria-hidden />}>
                    {effective.activity === "job" ? "Finish job" : "Finish"}
                  </Button>
                )}
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {effective.state === "break" ? (
                    <Button variant="secondary" size="lg" disabled={busy} onClick={() => setConfirmFinish(true)} icon={<Square className="size-5" aria-hidden />}>
                      Finish job
                    </Button>
                  ) : (
                    <Button variant="secondary" size="lg" busy={pending?.action === "break"} busyLabel={pendingLabel.break} disabled={busy} onClick={() => act("break")} icon={<Coffee className="size-5" aria-hidden />}>
                      Start break
                    </Button>
                  )}
                  <Button variant="secondary" size="lg" disabled={busy} onClick={() => setPicker("switch")} icon={<ArrowRightLeft className="size-5" aria-hidden />}>
                    Change job
                  </Button>
                </div>
              </>
            )}
          </JobCard>
        )}

        {focus && (
          <JobCard
            headingId="next-job"
            refCode={focus.ref}
            title={focus.title}
            customer={focus.customer}
            site={focus.site}
            address={focus.address}
            access={focus.access}
            planned={focus.planned}
            badge={
              <StatusBadge tone="info" icon={CalendarClock}>
                {data.planned.indexOf(focus) === 0 ? "Scheduled" : "Next"}
              </StatusBadge>
            }
          >
            <Button
              variant="primary"
              size="lg"
              full
              busy={pending?.action === "start"}
              busyLabel={pendingLabel.start}
              disabled={busy}
              onClick={() => act("start", { jobId: focus.jobId, activity: "job", title: `${focus.ref} · ${focus.title}`, site: focus.site })}
              icon={<Play className="size-5" aria-hidden />}
            >
              Start job
            </Button>
            <p className="text-center text-label text-muted">Record your time when you get on site.</p>
          </JobCard>
        )}

        {!oldOpen && !recording && data.planned.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="No jobs assigned for today."
            action={
              <>
                <Button variant="primary" size="lg" onClick={() => setPicker("start")} icon={<Search className="size-5" aria-hidden />}>
                  Start other work
                </Button>
                <Link href="/field/notifications" className={buttonClass({ variant: "secondary", size: "lg" })}>
                  Check office updates
                </Link>
              </>
            }
          >
            If you’re working today, start other work and choose the job or site. If you’re not sure where you should be, check with the office.
          </EmptyState>
        )}

        {allRecorded && (
          <Notice tone="success" title="Every planned job today has time recorded.">
            Working somewhere else? Use Start other work below.
          </Notice>
        )}
      </div>

      {otherJobs.length > 0 && (
        <div className="mt-8">
          <SectionHeading title={recording || focus ? "Also planned today" : "Planned today"} aside={`${data.planned.length} planned`} />
          <ul className="space-y-3">
            {otherJobs.map((job) => (
              <li key={job.key}>
                <JobCard
                  as="h3"
                  refCode={job.ref}
                  title={job.title}
                  customer={job.customer}
                  site={job.site}
                  address={job.address}
                  access={job.access}
                  planned={job.planned}
                  state={job.recorded.length > 0 ? <p className="text-label text-muted tabular-nums">Recorded today: {job.recorded.join(", ")}</p> : undefined}
                >
                  {oldOpen ? (
                    <p className="text-label text-muted">Add your earlier finish time above before starting.</p>
                  ) : (
                    <Button
                      variant="secondary"
                      full
                      disabled={busy}
                      onClick={() =>
                        act(recording ? "switch" : "start", { jobId: job.jobId, activity: "job", title: `${job.ref} · ${job.title}`, site: job.site })
                      }
                      icon={recording ? <ArrowRightLeft className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
                    >
                      {recording ? "Change to this job" : "Start job"}
                    </Button>
                  )}
                </JobCard>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!oldOpen && !recording && data.planned.length > 0 && (
        <Button variant="secondary" full className="mt-3" disabled={busy} onClick={() => setPicker("start")} icon={<Search className="size-5" aria-hidden />}>
          Start other work
        </Button>
      )}

      {data.sessions.length > 0 && (
        <div className="mt-8">
          <SectionHeading title="Recorded today" aside={<span className="tabular-nums">{formatDuration(data.sessions.reduce((n, s) => n + s.netMinutes, 0))}</span>} />
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {data.sessions.map((s) => (
              <TimeRecord
                key={s.id}
                title={s.title}
                times={`${s.start}–${s.finish ?? "now"}`}
                detail={s.breakMinutes > 0 ? `${s.breakMinutes} min break` : undefined}
                duration={formatDuration(s.netMinutes)}
                state={!s.finish ? "recording" : s.changeRequested ? "change_requested" : s.edited ? "corrected" : "saved"}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-label text-muted">
        Time wrong or forgot to tap?{" "}
        <Link href="/field/hours#fix" className="font-bold text-primary underline underline-offset-4">
          Ask for a correction
        </Link>
        {data.pendingCorrections > 0 && ` (${data.pendingCorrections} waiting for the office)`}
      </p>

      <div className="mt-8">
        <SectionHeading title="Next 7 days" />
        <ul className="space-y-2">
          {data.upcoming.map((d) => (
            <UpcomingDay key={d.date} day={d} />
          ))}
        </ul>
      </div>

      <Link
        href="/field/leave?new=1"
        className="mt-8 flex min-h-14 items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 text-label font-semibold text-ink hover:border-control"
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="size-5 text-muted" aria-hidden />
          Need a day off?
        </span>
        <span className="flex items-center gap-1 font-bold text-primary">
          Request holiday <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>

      {picker && (
        <JobPicker
          mode={picker}
          jobs={data.jobs}
          plannedIds={data.planned.map((p) => p.jobId)}
          currentJobId={recording ? effective.jobId : null}
          busy={busy}
          onClose={() => setPicker(null)}
          onPick={(t) => act(picker === "switch" ? "switch" : "start", t)}
        />
      )}
    </section>
  );
}

function UpcomingDay({ day }: { day: TodayData["upcoming"][number] }) {
  const [open, setOpen] = useState(false);
  const status = day.holiday
    ? `Bank holiday: ${day.holiday}`
    : !day.working
      ? "Not a working day"
      : day.items.length === 0 && !day.absences.length
        ? "Nothing planned yet"
        : null;
  const content = (
    <>
      <span className="w-14 shrink-0">
        <span className="block font-bold">{day.label.slice(0, 3)}</span>
        <span className="block text-label text-muted tabular-nums">{day.short}</span>
      </span>
      <span className="min-w-0 flex-1 text-label">
        {status && <span className="text-muted">{status}</span>}
        {day.absences.map((a) => (
          <span key={a} className="mr-1 inline-block">
            <StatusBadge tone={a.startsWith("Pending") ? "warning" : "info"} icon={CalendarDays}>
              {holidayWording(a)}
            </StatusBadge>
          </span>
        ))}
        {day.items.map((i) => (
          <span key={i.key} className="block truncate">
            <span className="font-semibold tabular-nums">{i.start}</span> {i.ref} · {i.site}
          </span>
        ))}
      </span>
    </>
  );
  if (!day.items.length) {
    return <li className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-4 py-2.5">{content}</li>;
  }
  return (
    <li className="rounded-card border border-line bg-surface">
      <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-card px-4 py-2.5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {content}
        <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        <span className="sr-only">{open ? "Hide" : "Show"} job details</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3">
          {day.items.map((i) => (
            <JobCard key={i.key} as="h3" refCode={i.ref} title={i.title} customer={i.customer} site={i.site} address={i.address} access={i.access} planned={i.planned} />
          ))}
        </div>
      )}
    </li>
  );
}

function JobPicker({
  mode,
  jobs,
  plannedIds,
  currentJobId,
  busy,
  onClose,
  onPick,
}: {
  mode: "start" | "switch";
  jobs: TodayData["jobs"];
  plannedIds: string[];
  currentJobId: string | null;
  busy: boolean;
  onClose: () => void;
  onPick: (t: Target) => void;
}) {
  const [q, setQ] = useState("");
  const [notListed, setNotListed] = useState(false);
  const [note, setNote] = useState("");
  const list = jobs
    .filter((j) => j.id !== currentJobId)
    .filter((j) => !q || `${j.ref} ${j.title} ${j.site} ${j.address} ${j.customer}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(plannedIds.includes(b.id)) - Number(plannedIds.includes(a.id)));

  return (
    <Dialog
      title={mode === "switch" ? "Change job" : "What are you starting?"}
      description={mode === "switch" ? "Your current record finishes now and the new one starts at the same time." : undefined}
      onClose={onClose}
    >
      <div className="mb-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => onPick({ jobId: null, activity: "travel", title: "Travel", site: "" })}>
          Travel
        </Button>
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => onPick({ jobId: null, activity: "other", title: "Other work", site: "Yard, stores or training" })}>
          Other work
        </Button>
      </div>
      <TextField
        label="Find a job"
        hint="Job number, site, customer or postcode"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-autofocus
      />
      <ul className="mt-3 space-y-2">
        {list.map((j) => (
          <li key={j.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick({ jobId: j.id, activity: "job", title: `${j.ref} · ${j.title}`, site: j.site })}
              className="block min-h-12 w-full rounded-control border border-line p-3 text-left transition-colors hover:border-control disabled:opacity-60"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label font-semibold text-muted tabular-nums">{j.ref}</span>
                {plannedIds.includes(j.id) && (
                  <StatusBadge tone="info" icon={CalendarClock}>
                    Planned today
                  </StatusBadge>
                )}
              </span>
              <span className="block font-bold">{j.title}</span>
              <span className="block text-label text-muted">
                {j.customer} · {j.site}, {j.address}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="rounded-control bg-subtle p-3 text-label">No jobs match “{q}”.</li>}
      </ul>
      <div className="mt-4 rounded-card border border-dashed border-control p-4">
        {notListed ? (
          <div className="space-y-3">
            <TextAreaField
              label="Where are you and what’s the work?"
              hint="For example: emergency call-out, Spar Llandeilo, tripping RCD"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <Button
              variant="primary"
              size="lg"
              full
              busy={busy}
              busyLabel="Starting…"
              disabled={note.trim().length < 3}
              onClick={() => onPick({ jobId: null, activity: "unassigned", note: note.trim(), title: "Job not found", site: note.trim() })}
            >
              Start and let the office sort the job
            </Button>
          </div>
        ) : (
          <Button variant="quiet" full onClick={() => setNotListed(true)}>
            Can’t find the job?
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function MissingFinish({ open }: { open: NonNullable<TodayData["open"]> }) {
  const { run, busy, error, message } = useAction();
  const [finish, setFinish] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [brk, setBrk] = useState(String(Math.round(open.completedBreakMinutes) || 30));
  const [reason, setReason] = useState("Forgot to press Finish");
  const [touched, setTouched] = useState(false);
  const finishError = touched && !finish ? "Enter the time you finished." : null;

  return (
    <section aria-labelledby="missing-finish" className="mb-6 rounded-card border border-warning/40 bg-warning-surface p-5">
      <h2 id="missing-finish" className="flex items-center gap-2 text-section font-bold text-ink">
        <CalendarClock className="size-5 shrink-0 text-warning" aria-hidden /> You didn’t finish on {open.startDateLabel}
      </h2>
      <p className="mt-1 text-label text-ink">
        {open.title} started at {open.startTime}. Enter when you actually finished. The office will check it, and you can then start today.
      </p>
      <form
        noValidate
        className="mt-4 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!finish) return;
          void run(
            "/api/field/corrections",
            {
              sessionId: open.id,
              date: open.startDate,
              start: open.startTime,
              finish,
              finishNextDay: nextDay,
              breakMinutes: Number(brk || 0),
              jobId: open.jobId,
              activity: open.activity,
              note: open.note,
              reason,
            },
            { success: "Finish time saved and sent to the office to check." },
          );
        }}
      >
        <TextField label="Finish time" type="time" required value={finish} onChange={(e) => setFinish(e.target.value)} error={finishError} />
        <TextField label="Break (minutes)" type="number" min={0} inputMode="numeric" value={brk} onChange={(e) => setBrk(e.target.value)} />
        <CheckboxField className="min-[380px]:col-span-2" label="Finished after midnight" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} />
        <TextField className="min-[380px]:col-span-2" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="min-[380px]:col-span-2">
          <Button variant="primary" size="lg" full type="submit" busy={busy} busyLabel="Saving…">
            Save finish time
          </Button>
        </div>
      </form>
      <FeedbackRegion className="mt-3" error={error} message={message} />
    </section>
  );
}
