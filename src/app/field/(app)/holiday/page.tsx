import type { Metadata } from "next";
import { Sun } from "lucide-react";
import { FieldSectionHeading, HolidayStatusPill, Overline } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatDateRange, formatDayKey, plural, todayKey } from "@/lib/field/dates";
import { MAX_HOLIDAY_WORKING_DAYS, listHolidayRequests } from "@/lib/field/store";
import { HolidayForm } from "./HolidayForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Holiday" };

// SAMPLE: real allowances would come from HR/payroll.
const ANNUAL_ALLOWANCE = 25;

export default async function HolidayPage() {
  const { user } = await requireRole("engineer");
  const today = todayKey();
  const requests = await listHolidayRequests({ engineerId: user.id });
  const year = today.slice(0, 4);
  const thisYear = requests.filter((r) => r.firstDay.startsWith(year));
  const approvedDays = thisYear.filter((r) => r.status === "approved").reduce((n, r) => n + r.workingDays, 0);
  const pendingDays = thisYear.filter((r) => r.status === "pending").reduce((n, r) => n + r.workingDays, 0);

  return (
    <section aria-labelledby="holiday-heading">
      <div className="mb-6">
        <Overline>TIME OFF</Overline>
        <h1 id="holiday-heading" className="text-2xl leading-tight font-extrabold tracking-tight">
          Holiday
        </h1>
      </div>

      <div className="mb-7 flex items-center justify-between rounded-2xl bg-ink-800 px-5 py-4 text-white">
        <div>
          <span className="block text-sm text-[#bacbcc]">Allowance left ({year})</span>
          <strong className="mt-1 block text-3xl font-extrabold">
            {plural(Math.max(0, ANNUAL_ALLOWANCE - approvedDays), "day")}
          </strong>
          {pendingDays > 0 && (
            <span className="text-xs text-[#bacbcc]">{plural(pendingDays, "day")} awaiting approval</span>
          )}
        </div>
        <Sun className="h-8 w-8 text-[#ffb75e]" aria-hidden />
      </div>

      <FieldSectionHeading title="Request time off" />
      <HolidayForm today={today} maxWorkingDays={MAX_HOLIDAY_WORKING_DAYS} />

      <div className="mt-7">
        <FieldSectionHeading title="Your requests" aside={requests.length ? `${requests.length} total` : undefined} />
        {requests.length === 0 ? (
          <p className="py-3 text-sm text-ink-500">No holiday requests yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3.5"
              >
                <div className="min-w-0">
                  <strong className="block text-sm">{formatDateRange(r.firstDay, r.lastDay)}</strong>
                  <small className="mt-1 block text-xs text-ink-500">
                    {plural(r.workingDays, "working day")}
                    {r.decidedAt && r.status !== "pending"
                      ? ` · ${r.status} ${formatDayKey(todayKey(new Date(r.decidedAt)))}`
                      : " · sent to the office"}
                  </small>
                  {r.note && <small className="mt-1 block truncate text-xs text-ink-400">“{r.note}”</small>}
                </div>
                <HolidayStatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
