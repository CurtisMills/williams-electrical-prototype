"use client";

import { useState } from "react";
import { Notice } from "@/components/field/ui";
import { btn, inputCls, labelCls } from "@/components/office/kit";
import { useAction } from "@/components/useAction";

export function RecordLeaveForm({ employees }: { employees: { id: string; name: string }[] }) {
  const { run, busy, error, message } = useAction();
  const [employeeId, setEmployeeId] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [half, setHalf] = useState<"full" | "am" | "pm">("full");
  const [note, setNote] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const lastDay = last || first;
        const portions = first === lastDay && half !== "full" ? { [first]: half } : {};
        const ok = await run("/api/office/leave", { employeeId, firstDay: first, lastDay, portions, note }, { success: "Leave recorded and approved." });
        if (ok) {
          setFirst("");
          setLast("");
          setNote("");
        }
      }}
    >
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
      <label className={labelCls}>
        First day
        <input type="date" required value={first} onChange={(e) => setFirst(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        Last day
        <input type="date" value={last} min={first} onChange={(e) => setLast(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className={labelCls}>
        Single day amount
        <select value={half} onChange={(e) => setHalf(e.target.value as "full" | "am" | "pm")} className={`${inputCls} mt-1`} disabled={!!last && last !== first}>
          <option value="full">Full day</option>
          <option value="am">Morning</option>
          <option value="pm">Afternoon</option>
        </select>
      </label>
      <label className={labelCls}>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-1`} placeholder="e.g. Phoned in" />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={busy} className={`${btn.dark} w-full`}>
          Record leave
        </button>
      </div>
      {error && <div className="sm:col-span-2 lg:col-span-6"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="sm:col-span-2 lg:col-span-6"><Notice tone="success">{message}</Notice></div>}
    </form>
  );
}
