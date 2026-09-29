"use client";

import { useState } from "react";
import { Notice } from "@/components/field/ui";
import { btn, inputCls, labelCls } from "@/components/office/kit";
import { useAction } from "@/components/useAction";

export function RequirementForm({ jobId, defaultFrom, defaultTo }: { jobId: string; defaultFrom: string; defaultTo: string }) {
  const { run, busy, error, message } = useAction();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [role, setRole] = useState("electrician");
  const [count, setCount] = useState("1");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run<{ label: string; created: number; updated: number }>(
          "/api/office/planning",
          { action: "add_requirement", jobId, from, to, role, count: Number(count), start, end },
          { success: (d) => `Saved: ${d.label} (${d.created} new, ${d.updated} updated). Weekends and bank holidays skipped.` },
        );
      }}
    >
      <label className={labelCls}>
        From
        <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        To
        <input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} mt-1`}>
          <option value="electrician">Electrician</option>
          <option value="apprentice">Apprentice</option>
        </select>
      </label>
      <label className={labelCls}>
        How many
        <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        Start
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        End
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <div className="col-span-2 sm:col-span-3">
        <button type="submit" disabled={busy} className={btn.dark}>
          Save requirement
        </button>
        <p className="mt-1 text-xs text-ink-500">Same role and times on a day updates the number needed instead of adding a duplicate.</p>
      </div>
      {error && <div className="col-span-2 sm:col-span-3"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="col-span-2 sm:col-span-3"><Notice tone="success">{message}</Notice></div>}
    </form>
  );
}

export function AssignAcrossForm({
  jobId,
  employees,
  defaultFrom,
  defaultTo,
}: {
  jobId: string;
  employees: { id: string; name: string; role: string }[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const { run, busy, error, message } = useAction();
  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [skipped, setSkipped] = useState<{ date: string; reason: string }[]>([]);
  const role = employees.find((e) => e.id === employeeId)?.role ?? "electrician";
  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run<{ assigned: string[]; skipped: { date: string; reason: string }[] }>(
          "/api/office/planning",
          { action: "assign_across", jobId, role, employeeId, from, to },
          { success: (d) => `Assigned on ${d.assigned.length} day(s). ${d.skipped.length ? `${d.skipped.length} day(s) skipped, see below.` : ""}` },
        );
        setSkipped(res?.skipped ?? []);
      }}
    >
      <label className={`${labelCls} col-span-2`}>
        Person
        <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${inputCls} mt-1`}>
          <option value="" disabled>
            Choose…
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.role})
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        From
        <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        To
        <input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <div className="col-span-2">
        <button type="submit" disabled={busy} className={btn.dark}>
          Assign to open {role} slots
        </button>
        <p className="mt-1 text-xs text-ink-500">Each day is checked separately. Days with leave, other bookings or no open place are skipped with the reason.</p>
      </div>
      {error && <div className="col-span-2"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="col-span-2"><Notice tone="success">{message}</Notice></div>}
      {skipped.length > 0 && (
        <ul className="col-span-2 max-h-40 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-950">
          {skipped.map((s) => (
            <li key={s.date}>
              <span className="font-bold">{s.date}:</span> {s.reason}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
