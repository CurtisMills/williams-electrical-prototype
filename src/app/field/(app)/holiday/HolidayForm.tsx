"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Notice } from "@/components/field/ui";
import { countWorkingDays, formatDateRange, plural } from "@/lib/field/dates";

export function HolidayForm({ today, maxWorkingDays }: { today: string; maxWorkingDays: number }) {
  const router = useRouter();
  const [firstDay, setFirstDay] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busy = sending || refreshing;

  const days = countWorkingDays(firstDay, lastDay);

  function localError(): string | null {
    if (!firstDay || !lastDay) return "Choose the first and last day off.";
    if (firstDay < today) return "Choose a first day from today onward.";
    if (lastDay < firstDay) return "The last day must be on or after the first day.";
    if (days === 0) return "Choose at least one working day (weekends are excluded).";
    if (days > maxWorkingDays) return `You can request up to ${maxWorkingDays} working days at a time.`;
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const problem = localError();
    if (problem) {
      setError(problem);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/field/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstDay, lastDay, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t send the request. Please try again.");
        return;
      }
      setMessage(`Request for ${formatDateRange(firstDay, lastDay)} sent to the office.`);
      setFirstDay("");
      setLastDay("");
      setNote("");
      startRefresh(() => router.refresh());
    } catch {
      setError("No connection. Your request hasn’t been sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base text-ink-950 outline-none focus-visible:border-signal-600 focus-visible:ring-3 focus-visible:ring-signal-400/40";

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-ink-100 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-extrabold">First day off</span>
          <input
            type="date"
            required
            min={today}
            value={firstDay}
            onChange={(e) => {
              const value = e.target.value;
              setFirstDay(value);
              if (!lastDay || lastDay < value) setLastDay(value);
              setError(null);
            }}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-extrabold">Last day off</span>
          <input
            type="date"
            required
            min={firstDay || today}
            value={lastDay}
            onChange={(e) => {
              setLastDay(e.target.value);
              setError(null);
            }}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-extrabold">
          Note for the office <span className="font-medium text-ink-400">(optional)</span>
        </span>
        <textarea
          rows={2}
          maxLength={160}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything they need to know?"
          className={`${inputClass} resize-y`}
        />
      </label>

      <div aria-live="polite" className="rounded-lg bg-ink-50 px-3 py-3 text-sm leading-snug text-ink-600">
        {!firstDay || !lastDay ? (
          "Choose your dates to see the working days requested."
        ) : lastDay < firstDay ? (
          "The last day needs to be on or after the first day."
        ) : (
          <>
            <strong className="block text-base text-ink-950">{plural(days, "working day")} requested</strong>
            {formatDateRange(firstDay, lastDay)} · weekends excluded. Sent to the office for approval.
          </>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal-600 px-4 text-base font-extrabold text-white active:bg-signal-800 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        Send holiday request
      </button>
    </form>
  );
}
