"use client";

import { useState } from "react";
import { BigButton } from "@/components/field/BigButton";
import { Notice } from "@/components/field/ui";
import { useAction } from "@/components/useAction";

type Job = { id: string; ref: string; title: string; site: string };

export interface CorrectionInitial {
  sessionId?: string;
  date: string;
  start?: string;
  finish?: string;
  finishNextDay?: boolean;
  breakMinutes?: number;
  jobId?: string | null;
  activity?: string;
}

export function SubmitWeek({ weekStart, blocked }: { weekStart: string; blocked: boolean }) {
  const { run, busy, error, message } = useAction();
  return (
    <>
      <BigButton tone="white" busy={busy} disabled={blocked} onClick={() => run("/api/field/timesheet", { weekStart }, { success: "Week submitted to the office." })}>
        Submit this week
      </BigButton>
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="mt-2"><Notice tone="success">{message}</Notice></div>}
    </>
  );
}

export function CorrectionButton({ jobs, initial }: { jobs: Job[]; initial: CorrectionInitial }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-lg px-2 text-xs font-extrabold text-signal-700 hover:bg-ink-50">
        Fix
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Ask for a correction">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="mb-1 text-lg font-extrabold">Ask the office to correct this</h2>
        <p className="mb-3 text-sm text-ink-500">Change what’s wrong. The office sees the original and your change.</p>
        <CorrectionForm jobs={jobs} initial={initial} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </div>
    </div>
  );
}

export function CorrectionForm({
  jobs,
  initial,
  onDone,
  onCancel,
}: {
  jobs: Job[];
  initial: CorrectionInitial;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { run, busy, error, message } = useAction();
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start ?? "");
  const [finish, setFinish] = useState(initial.finish ?? "");
  const [nextDay, setNextDay] = useState(!!initial.finishNextDay);
  const [brk, setBrk] = useState(String(initial.breakMinutes ?? 30));
  const [target, setTarget] = useState(initial.activity && initial.activity !== "job" ? initial.activity : (initial.jobId ?? ""));
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const isActivity = ["travel", "other", "unassigned"].includes(target);

  return (
    <form
      className="grid grid-cols-2 gap-3 rounded-xl border border-ink-100 bg-white p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(
          "/api/field/corrections",
          {
            sessionId: initial.sessionId,
            date,
            start,
            finish,
            finishNextDay: nextDay,
            breakMinutes: Number(brk || 0),
            jobId: isActivity ? null : target,
            activity: isActivity ? target : "job",
            note,
            reason,
          },
          { success: "Sent to the office. You’ll get an update when they decide." },
        );
        if (ok) {
          setReason("");
          onDone?.();
        }
      }}
    >
      <label className="col-span-2 text-sm font-bold">
        Date
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
      </label>
      <label className="text-sm font-bold">
        Start
        <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
      </label>
      <label className="text-sm font-bold">
        Finish
        <input type="time" required value={finish} onChange={(e) => setFinish(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} className="h-5 w-5" />
        Finished after midnight
      </label>
      <label className="text-sm font-bold">
        Break (minutes)
        <input type="number" min={0} inputMode="numeric" value={brk} onChange={(e) => setBrk(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
      </label>
      <label className="col-span-2 text-sm font-bold">
        Job
        <select required value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 bg-white px-2 text-base">
          <option value="" disabled>
            Choose…
          </option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.ref} · {j.title} ({j.site})
            </option>
          ))}
          <option value="travel">Travel</option>
          <option value="other">Other work (yard, stores, training)</option>
          <option value="unassigned">Job not listed</option>
        </select>
      </label>
      {target === "unassigned" && (
        <label className="col-span-2 text-sm font-bold">
          Where and what was the work?
          <input required minLength={3} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
        </label>
      )}
      <label className="col-span-2 text-sm font-bold">
        What happened?
        <input
          required
          minLength={5}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Forgot to press Start when I arrived"
          className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base"
        />
      </label>
      {error && <div className="col-span-2"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="col-span-2"><Notice tone="success">{message}</Notice></div>}
      <div className={`col-span-2 grid gap-2 ${onCancel ? "grid-cols-2" : ""}`}>
        {onCancel && (
          <BigButton tone="outline" onClick={onCancel}>
            Cancel
          </BigButton>
        )}
        <BigButton tone="primary" type="submit" busy={busy}>
          Send to office
        </BigButton>
      </div>
    </form>
  );
}
