"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronDown,
  Coffee,
  KeyRound,
  MapPin,
  Play,
  Search,
  Square,
  WifiOff,
  X,
} from "lucide-react";
import { BigButton } from "@/components/field/BigButton";
import { useOffline, type WorkAction } from "@/components/field/OfflineQueue";
import { FieldSectionHeading, Notice, Overline, Pill } from "@/components/field/ui";
import { useAction } from "@/components/useAction";
import { formatClock, formatDuration } from "@/lib/field/dates";

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
  sessions: { id: string; title: string; site: string; start: string; finish: string | null; breakMinutes: number; netMinutes: number }[];
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

function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

const mapsHref = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export function TodayScreen({ data }: { data: TodayData }) {
  const { queue, online, syncing, lastSyncMessage, send } = useOffline();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [picker, setPicker] = useState<null | "start" | "switch">(null);
  const [confirmFinish, setConfirmFinish] = useState(false);

  // Server state with anything still waiting on the phone applied on top, so the screen shows
  // what the employee did even before it reaches the office.
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

  async function act(action: WorkAction, target?: Target) {
    setBusy(true);
    setFeedback(null);
    const label = target ? `${target.title}${target.site ? ` @ ${target.site}` : ""}` : `${effective.title}${effective.site ? ` @ ${effective.site}` : ""}`;
    const result = await send({
      action,
      jobId: target?.jobId ?? undefined,
      activity: target?.activity,
      note: target?.note,
      label: action === "start" || action === "switch" ? label : `${action[0].toUpperCase()}${action.slice(1)} · ${label}`,
    });
    setBusy(false);
    setPicker(null);
    setConfirmFinish(false);
    setFeedback({ tone: result.status === "error" ? "error" : result.status === "queued" ? "info" : "success", text: result.message });
  }

  const worked = effective.startedAt
    ? Math.max(
        0,
        (now - Date.parse(effective.startedAt)) / 60000 -
          effective.completedBreakMinutes -
          (effective.breakStartedAt ? (now - Date.parse(effective.breakStartedAt)) / 60000 : 0),
      )
    : 0;

  return (
    <section aria-labelledby="today-heading">
      <div className="mb-4">
        <Overline>{data.dateLabel.toUpperCase()}</Overline>
        <h1 id="today-heading" className="text-2xl leading-tight font-extrabold tracking-tight">
          {data.greeting}, {data.firstName}
        </h1>
      </div>

      {(!online || queue.length > 0) && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-extrabold">{online ? (syncing ? "Sending saved times…" : "Waiting to send") : "No signal"}</p>
            <p>
              {queue.length
                ? `${queue.length} ${queue.length === 1 ? "tap is" : "taps are"} saved on this phone with the time you pressed. They will send automatically; you can close the app.`
                : "You can still start, break and finish. Times are saved on this phone and sent when you're back online."}
            </p>
          </div>
        </div>
      )}
      {lastSyncMessage && !queue.length && <Notice tone="success">{lastSyncMessage}</Notice>}

      {oldOpen && <MissingFinish open={oldOpen} />}

      {/* Active job banner: always the first thing on screen while recording. */}
      {effective.state !== "idle" && !oldOpen && (
        <div
          className={`mb-6 rounded-2xl p-5 text-white shadow-[0_10px_22px_#1426281b] ${effective.state === "break" ? "bg-sky-900" : "bg-emerald-800"}`}
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-extrabold tracking-[0.13em] uppercase">
              <span className={`h-2.5 w-2.5 rounded-full ${effective.state === "break" ? "bg-sky-300" : "animate-pulse bg-emerald-300"}`} />
              {effective.state === "break" ? "On a break" : "Recording work"}
            </span>
            {effective.savedOnPhone && <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-bold">Saved on this phone</span>}
          </div>
          <h2 className="mt-2 text-xl leading-snug font-extrabold">{effective.title}</h2>
          {effective.site && <p className="text-sm text-white/80">{effective.site}</p>}
          <p className="mt-3 text-sm text-white/90">
            Started {formatClock(effective.startedAt!)} · <strong>{formatDuration(Math.round(worked))}</strong> worked
            {effective.state === "break" && effective.breakStartedAt && <> · break since {formatClock(effective.breakStartedAt)}</>}
          </p>

          {confirmFinish ? (
            <div className="mt-4 rounded-xl bg-white/10 p-3">
              <p className="mb-3 text-sm font-bold">Finish work now ({formatClock(new Date(now).toISOString())})?</p>
              <div className="grid grid-cols-2 gap-2">
                <BigButton tone="white" busy={busy} onClick={() => act("finish")}>
                  Yes, finish
                </BigButton>
                <BigButton tone="ghost" onClick={() => setConfirmFinish(false)}>
                  Not yet
                </BigButton>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {effective.state === "break" ? (
                <BigButton tone="white" busy={busy} onClick={() => act("resume")} icon={<Play className="h-5 w-5" />}>
                  Resume
                </BigButton>
              ) : (
                <BigButton tone="ghost" busy={busy} onClick={() => act("break")} icon={<Coffee className="h-5 w-5" />}>
                  Break
                </BigButton>
              )}
              <BigButton tone="ghost" onClick={() => setPicker("switch")} icon={<ArrowRightLeft className="h-5 w-5" />}>
                Change job
              </BigButton>
              <BigButton tone="white" onClick={() => setConfirmFinish(true)} icon={<Square className="h-5 w-5" />}>
                Finish
              </BigButton>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div className="-mt-2 mb-5">
          {feedback.tone === "info" ? (
            <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">
              {feedback.text}
            </p>
          ) : (
            <Notice tone={feedback.tone}>{feedback.text}</Notice>
          )}
        </div>
      )}

      {data.absencesToday.length > 0 && (
        <p className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-bold text-violet-900">
          Today: {data.absencesToday.join(", ")}
        </p>
      )}

      <FieldSectionHeading title="Today’s jobs" aside={data.planned.length ? `${data.planned.length} planned` : undefined} />
      {data.planned.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed border-ink-200 bg-white p-4 text-sm text-ink-500">
          Nothing planned for you today. If you’re working, use <strong>Start other work</strong> below.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.planned.map((job) => {
            const isCurrent = !oldOpen && effective.state !== "idle" && effective.jobId === job.jobId;
            return (
              <li
                key={job.key}
                className={`overflow-hidden rounded-2xl border bg-white shadow-[0_3px_14px_#17252a07] ${
                  isCurrent ? "border-emerald-600 ring-2 ring-emerald-600" : "border-ink-100"
                }`}
              >
                <JobDetails job={job} />
                <div className="border-t border-ink-50 px-4 py-3">
                  {job.recorded.length > 0 && (
                    <p className="mb-2 text-xs font-bold text-ink-500">Recorded today: {job.recorded.join(", ")}</p>
                  )}
                  {isCurrent ? (
                    <p className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-50 text-sm font-extrabold text-emerald-800">
                      You’re recording this job
                    </p>
                  ) : oldOpen ? (
                    <p className="text-center text-sm font-bold text-ink-500">Save your earlier finish time above to start.</p>
                  ) : (
                    <BigButton
                      tone={effective.state === "idle" ? "primary" : "outline"}
                      busy={busy}
                      onClick={() =>
                        act(effective.state === "idle" ? "start" : "switch", {
                          jobId: job.jobId,
                          activity: "job",
                          title: `${job.ref} · ${job.title}`,
                          site: job.site,
                        })
                      }
                      icon={effective.state === "idle" ? <Play className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
                    >
                      {effective.state === "idle" ? "Start work" : "Change to this job"}
                    </BigButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!oldOpen && effective.state === "idle" && (
        <button
          type="button"
          onClick={() => setPicker("start")}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 bg-white text-sm font-extrabold text-ink-700 hover:border-ink-400"
        >
          <Search className="h-4 w-4" /> Start other work (another job, travel, not listed)
        </button>
      )}

      {data.sessions.length > 0 && (
        <div className="mt-7">
          <FieldSectionHeading
            title="Recorded today"
            aside={formatDuration(data.sessions.reduce((n, s) => n + s.netMinutes, 0))}
          />
          <ul className="divide-y divide-ink-50 rounded-2xl border border-ink-100 bg-white">
            {data.sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{s.title}</span>
                  <span className="text-xs text-ink-500">
                    {s.start}–{s.finish ?? "now"}
                    {s.breakMinutes > 0 && ` · ${s.breakMinutes} min break`}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm font-bold">{formatDuration(s.netMinutes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-ink-500">
        Forgot to press a button or got a time wrong?{" "}
        <Link href="/field/hours#fix" className="font-bold text-signal-700 underline">
          Ask the office to fix it
        </Link>
        {data.pendingCorrections > 0 && ` (${data.pendingCorrections} waiting)`}
      </p>

      <div className="mt-8">
        <FieldSectionHeading title="Next 7 days" />
        <ul className="space-y-2">
          {data.upcoming.map((d) => (
            <UpcomingDay key={d.date} day={d} />
          ))}
        </ul>
      </div>

      {picker && (
        <JobPicker
          mode={picker}
          jobs={data.jobs}
          plannedIds={data.planned.map((p) => p.jobId)}
          currentJobId={effective.state === "idle" ? null : effective.jobId}
          busy={busy}
          onClose={() => setPicker(null)}
          onPick={(t) => act(picker === "switch" ? "switch" : "start", t)}
        />
      )}
    </section>
  );
}

function JobDetails({ job }: { job: PlannedJob }) {
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-signal-700">
          {job.start}–{job.end}
        </span>
        <span className="font-mono text-xs font-bold text-ink-500">{job.ref}</span>
      </div>
      <p className="text-base leading-snug font-extrabold">{job.title}</p>
      <p className="text-sm font-semibold text-ink-700">{job.customer}</p>
      <a
        href={mapsHref(job.address)}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-600 underline decoration-ink-200 underline-offset-2"
      >
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{job.address}</span>
      </a>
      {job.access && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-ink-50 p-2.5 text-sm text-ink-700">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
          <span>
            <span className="font-bold">Access: </span>
            {job.access}
          </span>
        </p>
      )}
    </div>
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
  return (
    <li className="rounded-xl border border-ink-100 bg-white">
      <button
        type="button"
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!day.items.length}
      >
        <span className="w-16 shrink-0">
          <span className="block text-sm font-extrabold">{day.label.slice(0, 3)}</span>
          <span className="block text-xs text-ink-500">{day.short}</span>
        </span>
        <span className="min-w-0 flex-1 text-sm">
          {status && <span className="text-ink-400">{status}</span>}
          {day.absences.map((a) => (
            <span key={a} className="mr-1 inline-block">
              <Pill tone={a.startsWith("Pending") ? "amber" : "violet"}>{a}</Pill>
            </span>
          ))}
          {day.items.map((i) => (
            <span key={i.key} className="block truncate">
              <span className="font-bold">{i.start}</span> {i.ref} · {i.site}
            </span>
          ))}
        </span>
        {day.items.length > 0 && <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-ink-50 pb-2">
          {day.items.map((i) => (
            <JobDetails key={i.key} job={i} />
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h2 id="picker-title" className="text-lg font-extrabold">
            {mode === "switch" ? "Change to…" : "What are you starting?"}
          </h2>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-ink-50" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {mode === "switch" && (
            <p className="mb-3 text-sm text-ink-600">The current record finishes now and the new one starts at the same time.</p>
          )}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <BigButton tone="outline" busy={busy} onClick={() => onPick({ jobId: null, activity: "travel", title: "Travel", site: "" })}>
              Travel
            </BigButton>
            <BigButton tone="outline" busy={busy} onClick={() => onPick({ jobId: null, activity: "other", title: "Other work", site: "Yard, stores or training" })}>
              Other work
            </BigButton>
          </div>
          <label htmlFor="job-search" className="mb-1 block text-sm font-bold">
            Find a job
          </label>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="job-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Job number, site, customer or postcode"
              className="min-h-12 w-full rounded-xl border border-ink-200 pr-3 pl-9 text-base"
            />
          </div>
          <ul className="space-y-2">
            {list.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick({ jobId: j.id, activity: "job", title: `${j.ref} · ${j.title}`, site: j.site })}
                  className="w-full rounded-xl border border-ink-100 p-3 text-left hover:border-signal-600 disabled:opacity-50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-signal-700">{j.ref}</span>
                    {plannedIds.includes(j.id) && <Pill tone="green">Planned today</Pill>}
                  </span>
                  <span className="block font-extrabold">{j.title}</span>
                  <span className="block text-sm text-ink-500">
                    {j.customer} · {j.site}, {j.address}
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="rounded-xl bg-ink-50 p-3 text-sm text-ink-600">No jobs match “{q}”.</li>}
          </ul>
          <div className="mt-4 rounded-xl border border-dashed border-ink-300 p-3">
            {notListed ? (
              <>
                <label htmlFor="not-listed" className="mb-1 block text-sm font-bold">
                  Where are you and what’s the work?
                </label>
                <textarea
                  id="not-listed"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mb-2 w-full rounded-lg border border-ink-200 p-2 text-base"
                  placeholder="e.g. Emergency call-out, Spar Llandeilo, tripping RCD"
                />
                <BigButton
                  tone="primary"
                  busy={busy}
                  disabled={note.trim().length < 3}
                  onClick={() => onPick({ jobId: null, activity: "unassigned", note: note.trim(), title: "Job not found", site: note.trim() })}
                >
                  Start and let the office sort the job
                </BigButton>
              </>
            ) : (
              <button type="button" onClick={() => setNotListed(true)} className="min-h-11 w-full text-sm font-extrabold text-signal-700">
                Can’t find the job?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MissingFinish({ open }: { open: NonNullable<TodayData["open"]> }) {
  const { run, busy, error, message } = useAction();
  const [finish, setFinish] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [brk, setBrk] = useState(String(Math.round(open.completedBreakMinutes) || 30));
  const [reason, setReason] = useState("Forgot to press Finish");
  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4" role="alert">
      <p className="flex items-center gap-2 text-base font-extrabold text-amber-950">
        <CalendarClock className="h-5 w-5" /> You didn’t finish on {open.startDateLabel}
      </p>
      <p className="mt-1 text-sm text-amber-950">
        {open.title} started at {open.startTime}. Enter when you actually finished. The office will check it, and you can then start today.
      </p>
      <form
        className="mt-3 grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
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
            { success: "Thanks. Finish time saved and sent to the office to check." },
          );
        }}
      >
        <label className="text-sm font-bold">
          Finish time
          <input type="time" required value={finish} onChange={(e) => setFinish(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 bg-white px-2 text-base" />
        </label>
        <label className="text-sm font-bold">
          Break (minutes)
          <input type="number" min={0} inputMode="numeric" value={brk} onChange={(e) => setBrk(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 bg-white px-2 text-base" />
        </label>
        <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} className="h-5 w-5" />
          Finished after midnight
        </label>
        <label className="col-span-2 text-sm font-bold">
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 bg-white px-2 text-base" />
        </label>
        <div className="col-span-2">
          <BigButton tone="primary" busy={busy} type="submit">
            Save finish time
          </BigButton>
        </div>
      </form>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="mt-3"><Notice tone="success">{message}</Notice></div>}
    </div>
  );
}