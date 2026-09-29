"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { Button } from "@/components/portal/button";
import { FieldError, TextField } from "@/components/portal/field";
import { HolidayRequest } from "@/components/portal/HolidayRequest";
import { EmptyState, SectionHeading } from "@/components/portal/layout";
import { FeedbackRegion, Notice } from "@/components/portal/notice";
import { useAction } from "@/components/useAction";
import { addDays, daysBetween, formatDateRange, formatDayKey } from "@/lib/field/dates";
import { bankHolidayName, buildLeaveDays, leaveBalance, leaveYearOf, sumDays, type LeaveBalance } from "@/lib/we/calc";
import { formatBalance } from "@/lib/we/present";
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

const dayWord = (n: number) => `${formatBalance(n)} ${n === 1 ? "day" : "days"}`;

export function LeaveScreen({
  today,
  employee,
  settings,
  requests,
  balance,
  items,
  startOpen = false,
}: {
  today: string;
  employee: Employee;
  settings: Settings;
  requests: LeaveRequest[];
  balance: LeaveBalance;
  items: LeaveItem[];
  startOpen?: boolean;
}) {
  const [showForm, setShowForm] = useState(startOpen);
  const [confirmation, setConfirmation] = useState<{ id: string; range: string; days: number } | null>(null);
  const upcoming = items.filter((i) => i.upcoming && (i.status === "pending" || i.status === "approved"));
  const past = items.filter((i) => !upcoming.includes(i));

  return (
    <>
      <section aria-labelledby="balance-heading" className="mb-6 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 id="balance-heading" className="text-label font-semibold text-muted">
          {balance.year} holiday balance
        </h2>
        <p className="mt-1 text-figure font-bold tabular-nums">
          {formatBalance(balance.remaining)} <span className="text-body font-semibold text-muted">days left to book</span>
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-label">
          <div>
            <dt className="text-muted">Allowance</dt>
            <dd className="font-bold tabular-nums">{formatBalance(balance.allowance)}</dd>
          </div>
          <div>
            <dt className="text-muted">Approved</dt>
            <dd className="font-bold tabular-nums">{formatBalance(balance.approved)}</dd>
          </div>
          <div>
            <dt className="text-muted">Pending</dt>
            <dd className="font-bold tabular-nums">{formatBalance(balance.pending)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-label text-muted">
          January to December
          {employee.pattern.days.length < 5 && `, for your ${employee.pattern.days.length}-day week`}. Bank holidays are extra.
          {balance.pending > 0 && ` If everything pending is approved you’ll have ${formatBalance(balance.remainingIfPendingApproved)} left.`}
        </p>
      </section>

      <div role="status" aria-live="polite" aria-atomic="true" className="[&:not(:empty)]:mb-4">
        {confirmation && (
          <Notice tone="success" live={false} title="Holiday requested: pending approval">
            {confirmation.range}, {dayWord(confirmation.days)}. Reference {confirmation.id}. It isn’t booked until the office approves it. You’ll get an
            update here.
          </Notice>
        )}
      </div>

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
        <Button
          variant="primary"
          size="lg"
          full
          onClick={() => {
            setShowForm(true);
            setConfirmation(null);
          }}
          icon={<CalendarPlus className="size-5" aria-hidden />}
        >
          Request holiday
        </Button>
      )}

      <div className="mt-10">
        <SectionHeading title="Upcoming" />
        {upcoming.length ? (
          <ul className="space-y-3">
            {upcoming.map((i) => (
              <LeaveCard key={i.id} item={i} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No holiday approved or waiting." />
        )}
      </div>

      {past.length > 0 && (
        <div className="mt-10">
          <SectionHeading title="History" />
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

const portionName: Record<LeavePortion, string> = { full: "Full day", am: "Morning", pm: "Afternoon" };

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
  const [tried, setTried] = useState(false);

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
  const firstError = tried && !first ? "Choose the first day of your holiday." : null;
  const noWorkingDays = !!first && days.length === 0;

  return (
    <form
      noValidate
      aria-labelledby="request-heading"
      className="rounded-card border border-line bg-surface p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (!first || !days.length || over || tooLong) return;
        const res = await run<{ id: string }>("/api/field/leave", { firstDay: first, lastDay, portions, note });
        if (res) onDone({ id: res.id, range: formatDateRange(days[0].date, days[days.length - 1].date), days: total });
      }}
    >
      <h2 id="request-heading" className="mb-4 text-section font-bold">
        Request holiday
      </h2>
      <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
        <TextField
          label="First day"
          type="date"
          required
          min={today}
          value={first}
          error={firstError}
          onChange={(e) => {
            setFirst(e.target.value);
            if (!last || last < e.target.value) setLast(e.target.value);
          }}
        />
        <TextField
          label="Last day"
          type="date"
          required
          min={first || today}
          max={first ? addDays(first, 60) : undefined}
          value={last}
          onChange={(e) => setLast(e.target.value)}
        />
      </div>

      {noWorkingDays && <FieldError>Those dates don’t include any of your working days.</FieldError>}

      {days.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-label font-semibold">Your working days in this range</p>
          <ul className="divide-y divide-line rounded-card border border-line">
            {days.map((d) => (
              <li key={d.date} className="px-4 py-3">
                <fieldset className="flex flex-wrap items-center justify-between gap-2">
                  <legend className="float-left text-label font-semibold">{formatDayKey(d.date, "short")}</legend>
                  <span className="inline-flex rounded-control border border-control p-0.5">
                    {(["full", "am", "pm"] as LeavePortion[]).map((p) => (
                      <label
                        key={p}
                        className={`flex min-h-11 cursor-pointer items-center rounded-[6px] px-3 text-label font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                          d.portion === p ? "bg-ink text-white" : "text-ink hover:bg-subtle"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`portion-${d.date}`}
                          checked={d.portion === p}
                          onChange={() => setPortions((prev) => ({ ...prev, [d.date]: p }))}
                        />
                        {portionName[p]}
                      </label>
                    ))}
                  </span>
                </fieldset>
              </li>
            ))}
          </ul>
          {skipped.length > 0 && <p className="mt-2 text-label text-muted">Not counted: {skipped.join(", ")}.</p>}

          <div aria-live="polite" className={`mt-4 rounded-control p-4 text-label ${over || tooLong ? "border border-error/30 bg-error-surface" : "bg-subtle"}`}>
            <p className="text-body font-bold tabular-nums">{dayWord(total)} requested</p>
            {previews.map((p) => (
              <p key={p.year} className="tabular-nums">
                {previews.length > 1 && `${p.year}: ${dayWord(p.requested)}. `}
                {formatBalance(p.b.remaining)} left now, <strong>{formatBalance(p.after)} left</strong> if approved
                {p.b.pending > 0 && ` (${formatBalance(p.afterAll)} after your other pending requests)`}.
              </p>
            ))}
            {over && <FieldError>This is more than you have left for {over.year}. Change the dates or speak to the office.</FieldError>}
            {tooLong && <FieldError>Request up to 31 working days at a time.</FieldError>}
          </div>
        </div>
      )}

      <TextField className="mt-5" label="Note for the office" optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />

      <FeedbackRegion className="mt-4" error={error} />
      <div className="mt-5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" type="submit" busy={busy} busyLabel="Sending…" disabled={noWorkingDays || !!over || tooLong}>
          Request holiday
        </Button>
      </div>
    </form>
  );
}

function LeaveCard({ item }: { item: LeaveItem }) {
  const { run, busy, error, message } = useAction();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const reasonError = tried && reason.trim().length < 3 ? "Say why you want to cancel." : null;

  return (
    <li>
      <HolidayRequest range={item.range} days={dayWord(item.totalDays)} reference={item.id} status={item.status} cancelling={item.cancelling}>
        {item.decisionReason && item.status !== "pending" && (
          <p className="text-label">
            <span className="font-semibold">Office note:</span> {item.decisionReason}
          </p>
        )}
        {item.cancelling && <p className="text-label">You’ve asked to cancel. The holiday stays booked until the office approves.</p>}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 inline-flex min-h-12 items-center gap-1 text-label font-bold text-ink"
          aria-expanded={open}
        >
          Details <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {open && (
          <div className="space-y-2 text-label">
            <p>{item.days.join(", ")}</p>
            {item.note && <p className="text-muted">Your note: {item.note}</p>}
            <ol className="border-l-2 border-line pl-3">
              {item.history.map((h, i) => (
                <li key={i} className="mb-1">
                  <span className="font-semibold capitalize">{h.action}</span> · {h.who} · {h.when}
                  {h.reason && <span className="block text-muted">{h.reason}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {item.status === "pending" && (
          <div className="mt-3">
            <Button variant="secondary" full busy={busy} busyLabel="Withdrawing…" onClick={() => run(`/api/field/leave/${item.id}`, { action: "withdraw" }, { success: "Request withdrawn." })}>
              Withdraw request
            </Button>
          </div>
        )}
        {item.status === "approved" && item.upcoming && !item.cancelling && (
          <div className="mt-3">
            {cancelling ? (
              <form
                noValidate
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setTried(true);
                  if (reason.trim().length < 3) return;
                  void run(`/api/field/leave/${item.id}`, { action: "cancel", reason }, { success: "Cancellation sent. Your holiday stays booked until the office approves." });
                }}
              >
                <TextField label="Why do you want to cancel?" required value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError} autoFocus />
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  <Button variant="secondary" onClick={() => setCancelling(false)}>
                    Keep holiday
                  </Button>
                  <Button variant="danger" type="submit" busy={busy} busyLabel="Sending…">
                    Ask to cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="secondary" full onClick={() => setCancelling(true)}>
                Ask to cancel this holiday
              </Button>
            )}
          </div>
        )}
        <FeedbackRegion className="mt-3" error={error} message={message} />
      </HolidayRequest>
    </li>
  );
}
