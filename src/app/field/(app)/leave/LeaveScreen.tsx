"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { BigButton } from "@/components/field/BigButton";
import { FieldSectionHeading, LeaveStatusPill, Notice } from "@/components/field/ui";
import { useAction } from "@/components/useAction";
import { addDays, daysBetween, formatDateRange, formatDayKey } from "@/lib/field/dates";
import { bankHolidayName, buildLeaveDays, leaveBalance, leaveYearOf, sumDays, type LeaveBalance } from "@/lib/we/calc";
import type { Employee, LeavePortion, LeaveRequest, LeaveStatus, Settings } from "@/lib/we/types";

export interface LeaveItem {
  id: string;
  range: string;
  firstDay: string;
  lastDay: string;
  totalDays: number;
  status: LeaveStatus;
  cancelling: boolean;
  note: string;
  decisionReason: string;
  days: string[];
  history: { when: string; who: string; action: string; reason: string }[];
  upcoming: boolean;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const dayWord = (n: number) => `${fmt(n)} ${n === 1 ? "day" : "days"}`;

export function LeaveScreen({
  today,
  employee,
  settings,
  requests,
  balance,
  items,
}: {
  today: string;
  employee: Employee;
  settings: Settings;
  requests: LeaveRequest[];
  balance: LeaveBalance;
  items: LeaveItem[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string; range: string; days: number } | null>(null);
  const upcoming = items.filter((i) => i.upcoming && (i.status === "pending" || i.status === "approved"));
  const past = items.filter((i) => !upcoming.includes(i));

  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-2">
        <Stat label="Left to book" value={fmt(balance.remaining)} strong />
        <Stat label="Approved" value={fmt(balance.approved)} />
        <Stat label="Pending" value={fmt(balance.pending)} note={balance.pending ? "not approved yet" : undefined} />
      </div>
      <p className="-mt-3 mb-6 text-xs text-ink-500">
        {balance.year} leave year (January to December): {fmt(balance.allowance)} days allowance
        {employee.pattern.days.length < 5 && ` for your ${employee.pattern.days.length}-day week`}. Bank holidays are extra and never taken
        from your allowance.
        {balance.pending > 0 && ` If everything pending is approved you’ll have ${fmt(balance.remainingIfPendingApproved)} left.`}
      </p>

      {confirmation && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4" role="status">
          <p className="flex items-center gap-2 font-extrabold text-emerald-900">
            <CheckCircle2 className="h-5 w-5" /> Request sent, reference {confirmation.id}
          </p>
          <p className="mt-1 text-sm text-emerald-950">
            {confirmation.range}, {dayWord(confirmation.days)}. It is <strong>pending</strong>, not approved yet. You’ll get an update
            here when the office decides.
          </p>
        </div>
      )}

      {showForm ? (
        <RequestForm
          today={today}
          employee={employee}
          settings={settings}
          requests={requests}
          onCancel={() => setShowForm(false)}
          onDone={(c) => {
            setConfirmation(c);
            setShowForm(false);
          }}
        />
      ) : (
        <BigButton tone="primary" onClick={() => { setShowForm(true); setConfirmation(null); }}>
          Request leave
        </BigButton>
      )}

      <div className="mt-8">
        <FieldSectionHeading title="Upcoming" />
        {upcoming.length ? (
          <ul className="space-y-3">
            {upcoming.map((i) => (
              <LeaveCard key={i.id} item={i} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">No leave booked or waiting.</p>
        )}
      </div>

      {past.length > 0 && (
        <div className="mt-8">
          <FieldSectionHeading title="History" />
          <ul className="space-y-3">
            {past.map((i) => (
              <LeaveCard key={i.id} item={i} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, note, strong = false }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? "bg-ink-900 text-white" : "border border-ink-100 bg-white"}`}>
      <p className={`text-xs font-bold ${strong ? "text-ink-200" : "text-ink-500"}`}>{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
      {note && <p className="text-[11px] font-bold text-amber-700">{note}</p>}
    </div>
  );
}

function RequestForm({
  today,
  employee,
  settings,
  requests,
  onCancel,
  onDone,
}: {
  today: string;
  employee: Employee;
  settings: Settings;
  requests: LeaveRequest[];
  onCancel: () => void;
  onDone: (c: { id: string; range: string; days: number }) => void;
}) {
  const { run, busy, error } = useAction();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [portions, setPortions] = useState<Record<string, LeavePortion>>({});
  const [note, setNote] = useState("");

  const lastDay = last && last >= first ? last : first;
  const days = useMemo(
    () => (first ? buildLeaveDays(employee, first, lastDay, portions, settings) : []),
    [employee, first, lastDay, portions, settings],
  );
  const skipped = first
    ? daysBetween(first, lastDay)
        .filter((d) => !days.some((x) => x.date === d))
        .map((d) => `${formatDayKey(d, "short")} (${bankHolidayName(d, settings) ?? "not a working day"})`)
    : [];
  const total = sumDays(days);
  const years = [...new Set(days.map((d) => leaveYearOf(d.date, settings)))];
  const previews = years.map((year) => {
    const b = leaveBalance(employee, requests, year, settings);
    const requested = sumDays(days.filter((d) => leaveYearOf(d.date, settings) === year));
    return { year, requested, b, after: b.remaining - requested, afterAll: b.remainingIfPendingApproved - requested };
  });
  const over = previews.find((p) => p.afterAll < 0);
  const tooLong = days.length > 31;

  return (
    <form
      className="rounded-2xl border border-ink-100 bg-white p-4 shadow-[0_3px_14px_#17252a07]"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run<{ id: string }>("/api/field/leave", { firstDay: first, lastDay, portions, note });
        if (res) onDone({ id: res.id, range: formatDateRange(days[0].date, days[days.length - 1].date), days: total });
      }}
    >
      <h2 className="mb-3 text-lg font-extrabold">Request leave</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">
          First day
          <input
            type="date"
            required
            min={today}
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              if (!last || last < e.target.value) setLast(e.target.value);
            }}
            className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base"
          />
        </label>
        <label className="text-sm font-bold">
          Last day
          <input
            type="date"
            required
            min={first || today}
            max={first ? addDays(first, 60) : undefined}
            value={last}
            onChange={(e) => setLast(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base"
          />
        </label>
      </div>

      {first && (
        <div className="mt-4">
          {days.length === 0 ? (
            <Notice tone="error">Those dates don’t include any of your working days.</Notice>
          ) : (
            <>
              <p className="mb-2 text-sm font-bold">Your working days in this range</p>
              <ul className="divide-y divide-ink-50 rounded-xl border border-ink-100">
                {days.map((d) => (
                  <li key={d.date} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm font-semibold">{formatDayKey(d.date, "short")}</span>
                    <span className="inline-flex rounded-lg bg-ink-50 p-0.5" role="radiogroup" aria-label={`Amount for ${formatDayKey(d.date, "long")}`}>
                      {(["full", "am", "pm"] as LeavePortion[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={d.portion === p}
                          onClick={() => setPortions((prev) => ({ ...prev, [d.date]: p }))}
                          className={`min-h-10 rounded-md px-3 text-xs font-extrabold ${d.portion === p ? "bg-ink-900 text-white" : "text-ink-600"}`}
                        >
                          {p === "full" ? "Full day" : p === "am" ? "Morning" : "Afternoon"}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              {skipped.length > 0 && <p className="mt-2 text-xs text-ink-500">Not counted: {skipped.join(", ")}.</p>}

              <div className={`mt-4 rounded-xl p-3 text-sm ${over ? "bg-signal-600/10 text-signal-900" : "bg-ink-50 text-ink-800"}`} aria-live="polite">
                <p className="font-extrabold">
                  {dayWord(total)} requested
                </p>
                {previews.map((p) => (
                  <p key={p.year}>
                    {previews.length > 1 && `${p.year}: ${dayWord(p.requested)}. `}
                    {p.b.remaining} left now → <strong>{fmt(p.after)} left</strong> if approved
                    {p.b.pending > 0 && ` (${fmt(p.afterAll)} after your other pending requests)`}.
                  </p>
                ))}
                {over && <p className="mt-1 font-bold">This is more than you have left for {over.year}. Change the dates or speak to the office.</p>}
                {tooLong && <p className="mt-1 font-bold">Request up to 31 working days at a time.</p>}
              </div>
            </>
          )}
        </div>
      )}

      <label className="mt-4 block text-sm font-bold">
        Note for the office <span className="font-normal text-ink-500">(optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="mt-1 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
      </label>

      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <BigButton tone="outline" onClick={onCancel}>
          Cancel
        </BigButton>
        <BigButton tone="primary" type="submit" busy={busy} disabled={!days.length || !!over || tooLong}>
          Send request
        </BigButton>
      </div>
    </form>
  );
}

function LeaveCard({ item }: { item: LeaveItem }) {
  const { run, busy, error, message } = useAction();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <li className={`rounded-2xl border bg-white p-4 ${item.status === "pending" ? "border-dashed border-amber-400" : "border-ink-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-extrabold">{item.range}</p>
          <p className="text-sm text-ink-500">
            {dayWord(item.totalDays)} · {item.id}
          </p>
        </div>
        <LeaveStatusPill status={item.status} cancelling={item.cancelling} />
      </div>
      {item.status === "pending" && <p className="mt-2 text-sm text-amber-900">Waiting for the office. Not approved yet.</p>}
      {item.decisionReason && item.status !== "pending" && (
        <p className="mt-2 text-sm text-ink-700">
          <span className="font-bold">Office note:</span> {item.decisionReason}
        </p>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 flex min-h-10 items-center gap-1 text-sm font-bold text-ink-600" aria-expanded={open}>
        Details <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 space-y-2 text-sm">
          <p className="text-ink-700">{item.days.join(", ")}</p>
          {item.note && <p className="text-ink-600">Your note: {item.note}</p>}
          <ol className="border-l-2 border-ink-100 pl-3">
            {item.history.map((h, i) => (
              <li key={i} className="mb-1">
                <span className="font-bold capitalize">{h.action}</span> · {h.who} · {h.when}
                {h.reason && <span className="block text-ink-500">{h.reason}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {item.status === "pending" && (
        <div className="mt-3">
          <BigButton tone="outline" busy={busy} onClick={() => run(`/api/field/leave/${item.id}`, { action: "withdraw" }, { success: "Request withdrawn." })}>
            Withdraw request
          </BigButton>
        </div>
      )}
      {item.status === "approved" && item.upcoming && !item.cancelling && (
        <div className="mt-3">
          {cancelling ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(`/api/field/leave/${item.id}`, { action: "cancel", reason }, { success: "Cancellation sent. Your leave stays booked until the office approves." });
              }}
            >
              <label className="text-sm font-bold">
                Why do you want to cancel?
                <input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 mb-2 min-h-12 w-full rounded-lg border border-ink-200 px-2 text-base" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <BigButton tone="outline" onClick={() => setCancelling(false)}>
                  Keep leave
                </BigButton>
                <BigButton tone="primary" type="submit" busy={busy}>
                  Ask to cancel
                </BigButton>
              </div>
            </form>
          ) : (
            <BigButton tone="outline" onClick={() => setCancelling(true)}>
              Ask to cancel this leave
            </BigButton>
          )}
        </div>
      )}
      {item.cancelling && <p className="mt-2 text-sm text-amber-900">You’ve asked to cancel. The leave stays booked until the office approves.</p>}
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="mt-3"><Notice tone="success">{message}</Notice></div>}
    </li>
  );
}
