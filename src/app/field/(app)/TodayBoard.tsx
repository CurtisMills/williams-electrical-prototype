"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Notice } from "@/components/field/ui";
import { formatClock, formatDuration, minutesBetween } from "@/lib/field/dates";
import type { AssignedJob, TimeLog } from "@/lib/field/types";

export function TodayBoard({
  jobs,
  logs,
  activeLog,
}: {
  jobs: AssignedJob[];
  logs: TimeLog[];
  activeLog: TimeLog | null;
}) {
  const router = useRouter();
  const logFor = (jobId: string) => logs.find((l) => l.jobId === jobId);
  const [selectedId, setSelectedId] = useState(
    () =>
      (activeLog && jobs.some((j) => j.id === activeLog.jobId) ? activeLog.jobId : undefined) ??
      jobs.find((j) => !logFor(j.id)?.finishedAt)?.id ??
      jobs[0]?.id,
  );
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busy = sending || refreshing;
  const timeCardRef = useRef<HTMLDivElement>(null);

  const selected = jobs.find((j) => j.id === selectedId);
  const selectedLog = selected ? logFor(selected.id) : undefined;
  const otherActive = activeLog && activeLog.jobId !== selectedId ? activeLog : null;

  async function record(action: "start" | "finish", jobId: string) {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/field/jobs/${encodeURIComponent(jobId)}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t record the time. Please try again.");
      } else {
        const time = formatClock(action === "start" ? data.startedAt : data.finishedAt);
        setMessage(`${action === "start" ? "Start" : "Finish"} time recorded at ${time}.`);
      }
      // Refresh either way so the screen reflects what the server actually holds.
      startRefresh(() => router.refresh());
    } catch {
      setError("No connection. Your time hasn’t been recorded yet. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (jobs.length === 0) {
    return <p className="py-3 text-sm text-ink-500">No jobs assigned for today.</p>;
  }

  return (
    <>
      <ul className="space-y-3">
        {jobs.map((job) => {
          const log = logFor(job.id);
          const isSelected = job.id === selectedId;
          const footer = log
            ? log.finishedAt
              ? `Finished · ${formatClock(log.startedAt)}–${formatClock(log.finishedAt)}`
              : `On site since ${formatClock(log.startedAt)}`
            : isSelected
              ? "Selected"
              : "Tap to select";
          return (
            <li
              key={job.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-[0_3px_14px_#17252a07] ${
                isSelected ? "border-signal-600 ring-1 ring-signal-600" : "border-ink-100"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedId(job.id);
                  setError(null);
                  setMessage(null);
                  requestAnimationFrame(() =>
                    timeCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                  );
                }}
                aria-pressed={isSelected}
                className="block w-full px-4 pt-4 pb-3.5 text-left"
              >
                <span className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold tracking-wide text-signal-700">
                    {job.plannedStart}–{job.plannedEnd}
                  </span>
                  <span className="rounded-md bg-ink-50 px-2 py-1 text-[11px] font-bold text-ink-500">{job.jobType}</span>
                </span>
                <span className="block text-base leading-snug font-extrabold">{job.name}</span>
                <span className="mt-1 flex items-start gap-1 text-sm text-ink-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {job.location}
                </span>
              </button>
              <div
                className={`flex justify-between gap-2 border-t border-ink-50 px-4 py-2.5 text-xs font-bold ${
                  isSelected ? "text-signal-700" : log?.finishedAt ? "text-emerald-700" : "text-ink-500"
                }`}
              >
                <span className="font-mono">{job.reference}</span>
                <span>{footer}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div
          ref={timeCardRef}
          className="mt-6 scroll-mb-20 rounded-2xl bg-ink-800 p-5 text-white shadow-[0_10px_22px_#1426281b]"
          aria-live="polite"
        >
          <span className="text-[11px] font-extrabold tracking-[0.13em] text-[#a7bdc0]">JOB TIME · {selected.reference}</span>
          <h3 className="mt-1.5 mb-1 text-lg font-extrabold tracking-tight">{selected.name}</h3>

          {selectedLog?.finishedAt ? (
            <>
              <p className="text-sm text-[#bfd0d0]">Your time has been recorded for this job.</p>
              <TimeLines
                rows={[
                  ["Started", formatClock(selectedLog.startedAt)],
                  ["Finished", formatClock(selectedLog.finishedAt)],
                  ["Time on job", formatDuration(minutesBetween(selectedLog.startedAt, selectedLog.finishedAt))],
                ]}
              />
            </>
          ) : selectedLog ? (
            <>
              <p className="text-sm text-[#bfd0d0]">You’re logged on this job. Finish when you leave site.</p>
              <TimeLines rows={[["Started", formatClock(selectedLog.startedAt)]]} />
              <ActionButton busy={busy} onClick={() => record("finish", selected.id)}>
                Finish job
              </ActionButton>
            </>
          ) : otherActive ? (
            <>
              <p className="text-sm text-[#bfd0d0]">
                Finish your current job before starting another. Only one job can be active at a time.
              </p>
              <TimeLines
                rows={[
                  ["Currently on", `${otherActive.jobReference} · ${otherActive.jobName}`],
                  ["Started", formatClock(otherActive.startedAt)],
                ]}
              />
              <ActionButton busy={busy} onClick={() => record("finish", otherActive.jobId)} tone="light">
                Finish {otherActive.jobReference}
              </ActionButton>
            </>
          ) : (
            <>
              <p className="mb-5 text-sm text-[#bfd0d0]">
                Tap when you arrive on site. Your start time is recorded automatically.
              </p>
              <ActionButton busy={busy} onClick={() => record("start", selected.id)}>
                Start job
              </ActionButton>
            </>
          )}

          {(error || message) && (
            <div className="mt-4">
              <Notice tone={error ? "error" : "success"}>{error ?? message}</Notice>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TimeLines({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="my-4 divide-y divide-ink-700 border-y border-ink-700 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3">
          <dt className="text-[#b8c8c9]">{label}</dt>
          <dd className="text-right font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionButton({
  busy,
  onClick,
  tone = "red",
  children,
}: {
  busy: boolean;
  onClick: () => void;
  tone?: "red" | "light";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-extrabold disabled:opacity-60 ${
        tone === "red" ? "bg-signal-400 text-white active:bg-signal-600" : "bg-white text-ink-950 active:bg-ink-100"
      }`}
    >
      {busy && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}
