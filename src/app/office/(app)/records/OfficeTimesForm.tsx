"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/field/ui";
import { btn, inputCls, labelCls } from "@/components/office/kit";
import { useAction } from "@/components/useAction";

type Job = { id: string; ref: string; title: string; site: string };

export interface TimesInitial {
  date: string;
  start?: string;
  finish?: string;
  finishNextDay?: boolean;
  breakMinutes?: number;
  jobId?: string | null;
  activity?: string;
  note?: string;
  employeeId?: string;
}

/** Office entry or correction of a record. A reason is always required and kept in the audit history. */
export function OfficeTimesForm({
  mode,
  sessionId,
  version,
  jobs,
  employees,
  initial,
}: {
  mode: "create" | "correct";
  sessionId?: string;
  version?: number;
  jobs: Job[];
  employees?: { id: string; name: string }[];
  initial: TimesInitial;
}) {
  const router = useRouter();
  const { run, busy, error, message } = useAction();
  const [employeeId, setEmployeeId] = useState(initial.employeeId ?? "");
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start ?? "");
  const [finish, setFinish] = useState(initial.finish ?? "");
  const [nextDay, setNextDay] = useState(!!initial.finishNextDay);
  const [brk, setBrk] = useState(String(initial.breakMinutes ?? 30));
  const [target, setTarget] = useState(initial.activity && initial.activity !== "job" ? initial.activity : (initial.jobId ?? ""));
  const [note, setNote] = useState(initial.note ?? "");
  const [reason, setReason] = useState("");
  const isActivity = ["travel", "other", "unassigned"].includes(target);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const payload = {
          date,
          start,
          finish,
          finishNextDay: nextDay,
          breakMinutes: Number(brk || 0),
          jobId: isActivity ? null : target,
          activity: isActivity ? target : "job",
          note,
          reason,
        };
        const res =
          mode === "create"
            ? await run<{ id: string }>("/api/office/sessions", { ...payload, employeeId }, { success: "Record added." })
            : await run(`/api/office/sessions/${sessionId}`, { ...payload, action: "correct", version }, { success: "Correction saved. The original values and your reason are in the history." });
        if (res) {
          setReason("");
          if (mode === "create" && "id" in res) router.push(`/office/records/${res.id}`);
        }
      }}
    >
      {mode === "create" && employees && (
        <label className={labelCls}>
          Employee
          <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="" disabled>
              Choose…
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={labelCls}>
        Date started
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        Start
        <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        Finish
        <input type="time" required value={finish} onChange={(e) => setFinish(e.target.value)} className={`${inputCls} mt-1`} />
        <span className="mt-1 flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} className="h-4 w-4" /> Next day (after midnight)
        </span>
      </label>
      <label className={labelCls}>
        Break (minutes)
        <input type="number" min={0} value={brk} onChange={(e) => setBrk(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        Job or activity
        <select required value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} mt-1`}>
          <option value="" disabled>
            Choose…
          </option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.ref} · {j.title} ({j.site})
            </option>
          ))}
          <option value="travel">Travel</option>
          <option value="other">Other work</option>
          <option value="unassigned">Job not found (needs resolving)</option>
        </select>
      </label>
      {isActivity && (
        <label className={`${labelCls} sm:col-span-2`}>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
      )}
      <label className={`${labelCls} sm:col-span-2 lg:col-span-3`}>
        Reason for this {mode === "create" ? "entry" : "correction"} (kept in the history)
        <input
          required
          minLength={5}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === "create" ? "e.g. Phone broken, times from the site diary" : "e.g. Rhys phoned: finished at 16:10, forgot to tap Finish"}
          className={`${inputCls} mt-1`}
        />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
          {mode === "create" ? "Add record" : "Save correction"}
        </button>
      </div>
      {error && <div className="sm:col-span-2 lg:col-span-4"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="sm:col-span-2 lg:col-span-4"><Notice tone="success">{message}</Notice></div>}
    </form>
  );
}
