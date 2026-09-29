import type { Metadata } from "next";
import Link from "next/link";
import { FieldSectionHeading, HolidayStatusPill } from "@/components/field/ui";
import { formatDateRange, formatDayKey, plural, todayKey } from "@/lib/field/dates";
import { countActiveJobs, getAvailability, getEngineer, listEngineers, listHolidayRequests } from "@/lib/field/store";
import { DecisionButtons } from "./OfficeActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

export default async function OfficeOverviewPage() {
  const today = todayKey();
  const [requests, availability, activeJobs] = await Promise.all([
    listHolidayRequests(),
    getAvailability({ workingDays: 10 }),
    countActiveJobs(),
  ]);
  const crew = listEngineers();
  const pending = requests.filter((r) => r.status === "pending").sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  const decided = requests
    .filter((r) => r.status !== "pending" && r.decidedAt)
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, 5);
  const todayRow = availability.find((d) => d.date === today);
  const nameOf = (id: string) => getEngineer(id)?.name ?? "Unknown engineer";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-500">{formatDayKey(today, "full")}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">People & availability</h1>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Field team" value={crew.length} hint="Engineers" />
        <Stat
          label="Available today"
          value={todayRow?.available ?? crew.length}
          hint={todayRow ? `${todayRow.approvedLeave.length} on leave` : "Weekend"}
        />
        <Stat label="On site now" value={activeJobs} hint="View team" href="/office/team" />
        <Stat label="Pending requests" value={pending.length} hint="Holiday" accent={pending.length > 0} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-ink-100 bg-white p-4 sm:p-6">
          <FieldSectionHeading title="Holiday requests" aside={`${pending.length} pending`} />
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">You’re all caught up.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {pending.map((r) => (
                <li key={r.id} className="py-4 first:pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{nameOf(r.engineerId)}</strong>
                    <HolidayStatusPill status={r.status} />
                  </div>
                  <p className="mt-1.5 mb-3 text-sm text-ink-600">
                    {formatDateRange(r.firstDay, r.lastDay)} · {plural(r.workingDays, "working day")}
                    {r.note && <span className="mt-1 block text-ink-500">“{r.note}”</span>}
                  </p>
                  <DecisionButtons id={r.id} name={nameOf(r.engineerId)} />
                </li>
              ))}
            </ul>
          )}

          {decided.length > 0 && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <h3 className="mb-2 text-xs font-extrabold tracking-wider text-ink-400">RECENT DECISIONS</h3>
              <ul className="space-y-2">
                {decided.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <strong>{nameOf(r.engineerId)}</strong>{" "}
                      <span className="text-ink-500">· {formatDateRange(r.firstDay, r.lastDay)}</span>
                    </span>
                    <HolidayStatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-4 sm:p-6">
          <FieldSectionHeading title="Availability" aside="Working days" />
          <div className="mb-1 flex gap-4 text-xs text-ink-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#4a8b69]" aria-hidden /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#f0b44c]" aria-hidden /> Pending leave
            </span>
          </div>
          <ul className="divide-y divide-ink-100">
            {availability.map((day) => (
              <li key={day.date} className="py-3.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <strong>
                    {formatDayKey(day.date)}
                    {day.date === today && <span className="ml-1.5 text-xs font-bold text-signal-700">Today</span>}
                  </strong>
                  <span className="text-ink-600">
                    <strong className="text-ink-950">{day.available}</strong> of {day.totalCrew} available
                  </span>
                </div>
                <div
                  className="mt-2 mb-1.5 flex h-2 overflow-hidden rounded-full bg-ink-100"
                  role="img"
                  aria-label={`${day.available} of ${day.totalCrew} available${
                    day.pendingLeave.length ? `, ${day.availableIfApproved} if pending requests are approved` : ""
                  }`}
                >
                  <span className="bg-[#4a8b69]" style={{ width: `${(day.availableIfApproved / day.totalCrew) * 100}%` }} />
                  <span
                    className="bg-[repeating-linear-gradient(45deg,#f0b44c_0_4px,#f8d99a_4px_8px)]"
                    style={{ width: `${((day.available - day.availableIfApproved) / day.totalCrew) * 100}%` }}
                  />
                </div>
                <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-500">
                  <div>
                    <dt className="inline">Crew </dt>
                    <dd className="inline font-bold text-ink-700">{day.totalCrew}</dd>
                  </div>
                  <div>
                    <dt className="inline">Approved leave </dt>
                    <dd className="inline font-bold text-ink-700">{day.approvedLeave.length}</dd>
                  </div>
                  <div>
                    <dt className="inline">Available </dt>
                    <dd className="inline font-bold text-ink-700">{day.available}</dd>
                  </div>
                </dl>
                {day.approvedLeave.length > 0 && (
                  <p className="mt-1 text-xs text-ink-500">On leave: {day.approvedLeave.join(", ")}</p>
                )}
                {day.pendingLeave.length > 0 && (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Pending: {day.pendingLeave.join(", ")} · would leave {day.availableIfApproved} of {day.totalCrew}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
  accent = false,
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <>
      <span className="block text-xs text-ink-500 sm:text-sm">{label}</span>
      <strong className={`my-1 block text-3xl font-extrabold ${accent ? "text-signal-600" : ""}`}>{value}</strong>
      <small className={`block text-xs ${href ? "font-bold text-signal-700" : "text-ink-500"}`}>{hint}</small>
    </>
  );
  const className = "block rounded-xl border border-ink-100 bg-white p-4";
  return href ? (
    <Link href={href} className={`${className} hover:border-ink-200`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
