"use client";

import { useState } from "react";
import { PencilLine, Send } from "lucide-react";
import { Button } from "@/components/portal/button";
import { Dialog } from "@/components/portal/Dialog";
import { CheckboxField, SelectField, TextField } from "@/components/portal/field";
import { FeedbackRegion } from "@/components/portal/notice";
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
    <div className="space-y-3">
      <Button
        variant="primary"
        size="lg"
        full
        busy={busy}
        busyLabel="Sending…"
        disabled={blocked}
        onClick={() => run("/api/field/timesheet", { weekStart }, { success: "Week sent to the office for approval." })}
        icon={<Send className="size-5" aria-hidden />}
      >
        Send this week to the office
      </Button>
      {blocked && <p className="text-label text-muted">Add the missing finish time first.</p>}
      <FeedbackRegion error={error} message={message} />
    </div>
  );
}

export function CorrectionButton({ jobs, initial, label }: { jobs: Job[]; initial: CorrectionInitial; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center gap-1.5 rounded-control px-2 text-label font-bold text-primary hover:bg-primary-soft"
      >
        <PencilLine className="size-4" aria-hidden />
        Correct <span className="sr-only">{label}</span>
      </button>
      {open && (
        <Dialog title="Ask for a correction" description="Change what’s wrong. The office sees the original and your change before it’s applied." onClose={() => setOpen(false)}>
          <CorrectionForm jobs={jobs} initial={initial} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Dialog>
      )}
    </>
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
  const [tried, setTried] = useState(false);
  const isActivity = ["travel", "other", "unassigned"].includes(target);

  const errors = {
    date: !date ? "Choose the date." : null,
    start: !start ? "Enter a start time." : null,
    finish: !finish ? "Enter a finish time." : null,
    target: !target ? "Choose the job or type of work." : null,
    note: target === "unassigned" && note.trim().length < 3 ? "Say where you were and what the work was." : null,
    reason: reason.trim().length < 5 ? "Tell the office what happened (at least 5 characters)." : null,
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : null);

  return (
    <form
      noValidate
      className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (Object.values(errors).some(Boolean)) return;
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
          setTried(false);
          onDone?.();
        }
      }}
    >
      <TextField className="min-[380px]:col-span-2" label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={show("date")} />
      <TextField label="Start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} error={show("start")} />
      <TextField label="Finish" type="time" required value={finish} onChange={(e) => setFinish(e.target.value)} error={show("finish")} />
      <TextField label="Break (minutes)" type="number" min={0} inputMode="numeric" value={brk} onChange={(e) => setBrk(e.target.value)} />
      <CheckboxField className="self-end" label="Finished after midnight" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} />
      <SelectField className="min-[380px]:col-span-2" label="Job" required value={target} onChange={(e) => setTarget(e.target.value)} error={show("target")}>
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
      </SelectField>
      {target === "unassigned" && (
        <TextField className="min-[380px]:col-span-2" label="Where and what was the work?" required value={note} onChange={(e) => setNote(e.target.value)} error={show("note")} />
      )}
      <TextField
        className="min-[380px]:col-span-2"
        label="What happened?"
        hint="For example: forgot to press Start when I arrived"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={show("reason")}
      />
      <FeedbackRegion className="min-[380px]:col-span-2" error={error} message={message} />
      <div className={`grid gap-2 min-[380px]:col-span-2 ${onCancel ? "min-[380px]:grid-cols-2" : ""}`}>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" size="lg" type="submit" busy={busy} busyLabel="Sending…">
          Send to the office
        </Button>
      </div>
    </form>
  );
}
