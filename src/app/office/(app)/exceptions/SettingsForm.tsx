"use client";

import { useState } from "react";
import { Notice } from "@/components/field/ui";
import { btn, inputCls, labelCls } from "@/components/office/kit";
import { useAction } from "@/components/useAction";

export function SettingsForm({ longSessionHours, noStartGraceMinutes }: { longSessionHours: number; noStartGraceMinutes: number }) {
  const { run, busy, error, message } = useAction();
  const [hours, setHours] = useState(String(longSessionHours));
  const [grace, setGrace] = useState(String(noStartGraceMinutes));
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/office/settings", { longSessionHours: Number(hours), noStartGraceMinutes: Number(grace) }, { success: "Saved." });
      }}
    >
      <label className={labelCls}>
        Flag sessions longer than (hours)
        <input type="number" min={6} max={16} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className={`${inputCls} w-40`} />
      </label>
      <label className={labelCls}>
        “No start recorded” after (minutes past planned start)
        <input type="number" min={0} max={180} value={grace} onChange={(e) => setGrace(e.target.value)} className={`${inputCls} w-40`} />
      </label>
      <button type="submit" disabled={busy} className={btn.dark}>
        Save settings
      </button>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
    </form>
  );
}
