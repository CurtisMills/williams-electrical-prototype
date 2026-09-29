import type { Metadata } from "next";
import { Clock3 } from "lucide-react";
import { FieldSectionHeading, Overline } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatDayKey, plural, ukHour } from "@/lib/field/dates";
import { getEngineerDay } from "@/lib/field/store";
import { TodayBoard } from "./TodayBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today" };

export default async function EngineerTodayPage() {
  const { user } = await requireRole("engineer");
  const { date, jobs, logs, activeLog } = await getEngineerDay(user.id);
  const hour = ukHour();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const finished = logs.filter((l) => l.finishedAt).length;

  return (
    <section aria-labelledby="today-heading">
      <div className="mb-6">
        <Overline>{formatDayKey(date, "full").toUpperCase()}</Overline>
        <h1 id="today-heading" className="text-2xl leading-tight font-extrabold tracking-tight">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
      </div>

      <div className="mb-7 flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#dce8e2] text-[#245641]">
          <Clock3 className="h-5 w-5" />
        </span>
        <span>
          <strong className="block text-sm">Your day</strong>
          <small className="block text-sm text-ink-500">
            {plural(jobs.length, "job")} · {finished} finished
            {activeLog ? " · 1 in progress" : ""}
          </small>
        </span>
      </div>

      <FieldSectionHeading title="Today’s jobs" aside={formatDayKey(date, "weekday")} />
      <TodayBoard jobs={jobs} logs={logs} activeLog={activeLog} />
    </section>
  );
}
