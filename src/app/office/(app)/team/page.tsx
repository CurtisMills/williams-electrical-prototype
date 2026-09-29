import type { Metadata } from "next";
import { Avatar } from "@/components/field/ui";
import { formatClock, formatDayKey, formatDuration, minutesBetween, todayKey } from "@/lib/field/dates";
import { getTeamDay, type EngineerDayStatus } from "@/lib/field/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team today" };

const statusMeta: Record<EngineerDayStatus, { label: string; className: string; order: number }> = {
  on_site: { label: "On site", className: "bg-emerald-50 text-emerald-800", order: 0 },
  between_jobs: { label: "Between jobs", className: "bg-sky-50 text-sky-800", order: 1 },
  not_started: { label: "Not started", className: "bg-ink-50 text-ink-600", order: 2 },
  finished: { label: "Finished", className: "bg-ink-800 text-white", order: 3 },
  on_leave: { label: "On leave", className: "bg-amber-50 text-amber-800", order: 4 },
  no_jobs: { label: "No jobs", className: "bg-ink-50 text-ink-500", order: 5 },
};

export default async function TeamTodayPage() {
  const today = todayKey();
  const team = (await getTeamDay(today)).sort(
    (a, b) => statusMeta[a.status].order - statusMeta[b.status].order || a.engineer.name.localeCompare(b.engineer.name),
  );
  const count = (s: EngineerDayStatus) => team.filter((m) => m.status === s).length;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-semibold text-ink-500">{formatDayKey(today, "full")}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Team today</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["on_site", "between_jobs", "not_started", "finished", "on_leave"] as const).map((s) => (
          <span key={s} className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusMeta[s].className}`}>
            {statusMeta[s].label} · {count(s)}
          </span>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {team.map(({ engineer, status, jobs, activeLog }) => {
          const done = jobs.filter((j) => j.log?.finishedAt).length;
          return (
            <li key={engineer.id} className="rounded-2xl border border-ink-100 bg-white p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar initials={engineer.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{engineer.name}</p>
                  <p className="text-xs text-ink-500">
                    {activeLog
                      ? `On ${activeLog.jobReference} since ${formatClock(activeLog.startedAt)}`
                      : jobs.length
                        ? `${done} of ${jobs.length} jobs finished`
                        : status === "on_leave"
                          ? "Approved leave"
                          : "Nothing scheduled"}
                  </p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-extrabold whitespace-nowrap ${statusMeta[status].className}`}>
                  {statusMeta[status].label}
                </span>
              </div>

              {jobs.length > 0 && (
                <ol className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
                  {jobs.map(({ job, log }) => (
                    <li key={job.id} className="flex gap-3 py-3 text-sm">
                      <span className="w-24 shrink-0 text-xs font-extrabold text-signal-700">
                        {job.plannedStart}–{job.plannedEnd}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{job.name}</p>
                        <p className="truncate text-xs text-ink-500">
                          <span className="font-mono">{job.reference}</span> · {job.location}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-xs">
                        {log?.finishedAt ? (
                          <>
                            <span className="block font-bold text-ink-800">
                              {formatClock(log.startedAt)}–{formatClock(log.finishedAt)}
                            </span>
                            <span className="text-ink-500">{formatDuration(minutesBetween(log.startedAt, log.finishedAt))}</span>
                          </>
                        ) : log ? (
                          <span className="font-bold text-emerald-700">Started {formatClock(log.startedAt)}</span>
                        ) : (
                          <span className="text-ink-400">Not started</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
