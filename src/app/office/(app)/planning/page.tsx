import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader, td, th } from "@/components/office/kit";
import { Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDayKey, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { planningView } from "@/lib/we/planning";
import { readStore } from "@/lib/we/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Planning" };

const h = (m: number) => {
  const v = m / 60;
  return Number.isInteger(v) ? `${v}h` : `${v.toFixed(1)}h`;
};

export default async function PlanningPage(props: PageProps<"/office/planning">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const today = todayKey();
  const from = weekStartOf(isDateKey(sp.from) ? sp.from : today);
  const view = sp.view === "weekly" ? "weekly" : "daily";
  const preview = sp.preview === "1";
  const store = await readStore();
  const plan = planningView(store, from, 6, preview);
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ from, view, ...(preview ? { preview: "1" } : {}), ...over });
    if (over.preview === "0") p.delete("preview");
    return `/office/planning?${p}`;
  };
  const weekStarts = [...new Set(plan.dates.map(weekStartOf))];
  const confirmedGaps = plan.gaps.filter((g) => g.job.status !== "tentative");
  const tentativeGaps = plan.gaps.filter((g) => g.job.status === "tentative");
  const pendingRisk = plan.coverage.filter((c) => c.atRisk.length > 0);

  return (
    <>
      <PageHeader
        overline="OFFICE"
        title="Six-week plan"
        aside={
          <Link href="/office/jobs" className="text-sm font-bold text-signal-700">
            Jobs and staffing requirements →
          </Link>
        }
      >
        Confirmed work and approved absence by person and day. Capacity is each person’s working pattern less leave and other unavailability.
        {preview ? " Preview is on: tentative jobs and pending leave are included, marked with dashed outlines." : " Tentative jobs and pending leave are left out unless you turn on the preview."}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center rounded-lg border border-ink-200 bg-white">
          <Link href={qs({ from: addDays(from, -7) })} className="grid h-10 w-10 place-items-center" aria-label="Earlier week">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-sm font-bold">
            {formatDayKey(from, "dm")} – {formatDayKey(addDays(from, 41), "dm")}
          </span>
          <Link href={qs({ from: addDays(from, 7) })} className="grid h-10 w-10 place-items-center" aria-label="Later week">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {from !== weekStartOf(today) && (
          <Link href={qs({ from: weekStartOf(today) })} className="rounded-lg px-3 py-2 text-sm font-bold text-signal-700">
            This week
          </Link>
        )}
        <div className="flex rounded-lg border border-ink-200 bg-white p-0.5">
          {(["daily", "weekly"] as const).map((v) => (
            <Link key={v} href={qs({ view: v })} className={`rounded-md px-3 py-1.5 text-sm font-bold ${view === v ? "bg-ink-900 text-white" : ""}`}>
              {v === "daily" ? "Daily" : "Weekly"}
            </Link>
          ))}
        </div>
        <Link
          href={qs({ preview: preview ? "0" : "1" })}
          className={`rounded-lg border px-3 py-2 text-sm font-bold ${preview ? "border-amber-400 bg-amber-50 text-amber-900" : "border-ink-200 bg-white"}`}
          aria-pressed={preview}
        >
          {preview ? "✓ " : ""}Preview tentative jobs and pending leave
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-xl border p-4 ${confirmedGaps.length ? "border-signal-600/40 bg-signal-600/5" : "border-emerald-200 bg-emerald-50"}`}>
          <p className="text-xs font-bold text-ink-500">Unfilled confirmed places</p>
          <p className="text-2xl font-extrabold">{confirmedGaps.reduce((n, g) => n + g.unfilled, 0)}</p>
          <p className="text-xs text-ink-600">across {new Set(confirmedGaps.map((g) => g.requirement.date)).size} days</p>
        </div>
        <div className="rounded-xl border border-dashed border-ink-300 bg-white p-4">
          <p className="text-xs font-bold text-ink-500">Tentative demand (not in the plan)</p>
          <p className="text-2xl font-extrabold">{plan.days.reduce((n, d) => n + d.tentativeRequired, 0)}</p>
          <p className="text-xs text-ink-600">person-days if tentative jobs go ahead</p>
        </div>
        <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50/60 p-4">
          <p className="text-xs font-bold text-ink-500">At risk from pending leave</p>
          <p className="text-2xl font-extrabold">{plan.days.reduce((n, d) => n + d.unfilledIfPending - d.unfilled, 0)}</p>
          <p className="text-xs text-ink-600">extra places unfilled if all pending leave is approved</p>
        </div>
      </div>

      <Card title={view === "daily" ? "By person and day" : "By person and week"} aside="Hours shown are free capacity after assignments">
        <div className="-mx-5 -my-5 overflow-x-auto">
          {view === "daily" ? (
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-40 border-b border-ink-100 bg-white px-3 py-2 text-left">Person</th>
                  {plan.dates.map((d) => (
                    <th
                      key={d}
                      className={`min-w-[74px] border-b border-ink-100 px-1 py-2 text-center font-bold ${d === today ? "bg-signal-600/10" : ""} ${d === weekStartOf(d) ? "border-l-2 border-l-ink-200" : ""}`}
                    >
                      <span className="block text-ink-500">{formatDayKey(d, "dow")}</span>
                      {formatDayKey(d, "dm")}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-ink-100 bg-ink-50 px-3 py-1.5 text-left font-bold">Places filled</th>
                  {plan.days.map((d) => (
                    <th key={d.date} className={`border-b border-ink-100 bg-ink-50 px-1 py-1.5 text-center ${d.date === weekStartOf(d.date) ? "border-l-2 border-l-ink-200" : ""}`}>
                      {d.holiday ? (
                        <span className="text-ink-400">Bank hol.</span>
                      ) : d.required ? (
                        <span className={d.unfilled ? "font-extrabold text-signal-700" : "text-emerald-700"}>
                          {d.filled}/{d.required}
                          {d.unfilled > 0 && <span className="block">{d.unfilled} short</span>}
                        </span>
                      ) : (
                        <span className="text-ink-300">–</span>
                      )}
                      {preview && d.tentativeRequired > 0 && <span className="block text-ink-500">+{d.tentativeRequired} tent.</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.employee.id}>
                    <th className="sticky left-0 z-10 border-b border-ink-50 bg-white px-3 py-2 text-left align-top">
                      <span className="block text-sm font-bold">{row.employee.name}</span>
                      <span className="font-normal text-ink-500">
                        {roleLabel[row.employee.role]}
                        {row.employee.pattern.days.length < 5 && " · Mon–Thu"}
                      </span>
                    </th>
                    {row.days.map((d) => {
                      const off = d.patternMinutes === 0;
                      return (
                        <td
                          key={d.date}
                          className={`border-b border-ink-50 px-1 py-1 align-top ${off ? "bg-ink-50" : ""} ${d.date === weekStartOf(d.date) ? "border-l-2 border-l-ink-200" : ""}`}
                        >
                          {off ? (
                            <span className="block text-center text-ink-300">off</span>
                          ) : (
                            <div className="space-y-0.5">
                              {d.absences
                                .filter((a) => a.kind !== "pending_leave" || preview)
                                .map((a) => (
                                  <span
                                    key={a.sourceId + a.label}
                                    title={a.label}
                                    className={`block truncate rounded px-1 py-0.5 font-bold ${
                                      a.kind === "leave" ? "bg-violet-100 text-violet-900" : a.kind === "pending_leave" ? "border border-dashed border-amber-500 bg-amber-50 text-amber-900" : "bg-ink-100 text-ink-700"
                                    }`}
                                  >
                                    {a.kind === "leave" ? "Leave" : a.kind === "pending_leave" ? "Pending" : a.label}
                                    {a.label.includes("(") && ` ${a.label.includes("morning") ? "AM" : "PM"}`}
                                  </span>
                                ))}
                              {d.chips.map((c, i) => (
                                <Link
                                  key={i}
                                  href={`/office/planning/jobs/${c.jobId}?date=${d.date}`}
                                  title={`${c.ref} ${c.start}–${c.end}${c.status === "needs_replacement" ? " (needs replacement)" : ""}`}
                                  className={`block truncate rounded px-1 py-0.5 font-mono font-bold ${
                                    c.status === "needs_replacement"
                                      ? "bg-signal-600/15 text-signal-800 line-through"
                                      : c.tentative
                                        ? "border border-dashed border-ink-400 text-ink-600"
                                        : "bg-ink-800 text-white"
                                  }`}
                                >
                                  {c.ref.replace("WE-", "")}
                                  {c.start !== row.employee.pattern.start || c.end !== row.employee.pattern.end ? (c.start < "12:00" && c.end <= "12:00" ? " AM" : c.start >= "12:00" ? " PM" : "") : ""}
                                </Link>
                              ))}
                              <span className={`block text-center ${d.remainingMinutes ? "text-emerald-700" : "text-ink-400"}`}>{d.remainingMinutes ? `${h(d.remainingMinutes)} free` : d.usableMinutes ? "full" : ""}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60">
                <tr>
                  <th className={th}>Person</th>
                  {weekStarts.map((w) => (
                    <th key={w} className={th}>
                      w/c {formatDayKey(w, "dm")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                <tr className="bg-ink-50/40">
                  <td className={`${td} font-bold`}>Places filled</td>
                  {weekStarts.map((w) => {
                    const ds = plan.days.filter((d) => weekStartOf(d.date) === w);
                    const req = ds.reduce((n, d) => n + d.required, 0);
                    const fill = ds.reduce((n, d) => n + d.filled, 0);
                    const short = ds.reduce((n, d) => n + d.unfilled, 0);
                    return (
                      <td key={w} className={td}>
                        <span className={short ? "font-extrabold text-signal-700" : "text-emerald-700"}>
                          {fill}/{req}
                        </span>
                        {short > 0 && <span className="block text-xs font-bold text-signal-700">{short} short</span>}
                      </td>
                    );
                  })}
                </tr>
                {plan.rows.map((row) => (
                  <tr key={row.employee.id}>
                    <td className={td}>
                      <span className="font-bold">{row.employee.name}</span>
                      <span className="block text-xs text-ink-500">{roleLabel[row.employee.role]}</span>
                    </td>
                    {row.weeks.map((w) => (
                      <td key={w.weekStart} className={td}>
                        <span className="block font-mono">
                          {h(w.assigned)} / {h(w.usable)}
                        </span>
                        <span className={`text-xs ${w.remaining ? "text-emerald-700" : "text-ink-400"}`}>{h(w.remaining)} free</span>
                        {w.leave > 0 && <span className="block text-xs text-violet-800">{h(w.leave)} leave</span>}
                        {w.other > 0 && <span className="block text-xs text-ink-500">{h(w.other)} unavailable</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-600">
        <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono font-bold text-white">2041</span> confirmed assignment
        <span className="rounded bg-signal-600/15 px-1.5 py-0.5 font-mono font-bold text-signal-800 line-through">2041</span> needs replacement
        <span className="rounded border border-dashed border-ink-400 px-1.5 py-0.5 font-mono font-bold">2053</span> tentative job
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-900">Leave</span> approved leave
        <span className="rounded border border-dashed border-amber-500 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-900">Pending</span> pending leave (preview)
        <span className="rounded bg-ink-100 px-1.5 py-0.5 font-bold">College</span> other unavailability
      </div>

      <Card title={`Unfilled places (${confirmedGaps.length})`} className="mt-6" aside="Confirmed jobs in these six weeks">
        {confirmedGaps.length === 0 ? (
          <p className="text-sm text-emerald-700">Every confirmed place is filled.</p>
        ) : (
          <ul className="divide-y divide-ink-50 text-sm">
            {confirmedGaps.slice(0, 40).map((g) => (
              <li key={g.requirement.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-bold">{formatDayKey(g.requirement.date, "short")}</span> · {g.job.ref} {g.job.title} · {g.requirement.start}–{g.requirement.end} ·{" "}
                  <span className="font-bold text-signal-700">
                    {g.unfilled} {roleLabel[g.requirement.role].toLowerCase()} short
                  </span>
                  {g.needsReplacement.length > 0 && <Pill tone="red">Needs replacement</Pill>}
                </span>
                <Link href={`/office/planning/jobs/${g.job.id}?date=${g.requirement.date}`} className="font-extrabold text-signal-700 hover:underline">
                  Staff it →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {preview && (tentativeGaps.length > 0 || pendingRisk.length > 0) && (
        <Card title="Preview only" className="mt-6 border-dashed" aside="Not part of the confirmed plan">
          <ul className="space-y-1 text-sm">
            {[...new Set(tentativeGaps.map((g) => g.job.id))].map((jobId) => {
              const list = tentativeGaps.filter((g) => g.job.id === jobId);
              return (
                <li key={jobId}>
                  <Pill tone="grey">Tentative</Pill> {list[0].job.ref} {list[0].job.title}: {list.reduce((n, g) => n + g.unfilled, 0)} places across {list.length} slots.{" "}
                  <Link href={`/office/planning/jobs/${jobId}`} className="font-bold text-signal-700">
                    Plan it
                  </Link>
                </li>
              );
            })}
            {pendingRisk.map((c) => (
              <li key={c.requirement.id}>
                <Pill tone="amber">Pending leave</Pill> {formatDayKey(c.requirement.date, "short")} {c.job.ref}: {c.atRisk.map((a) => store.employees.find((e) => e.id === a.employeeId)?.name).join(", ")} has
                pending leave.
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
