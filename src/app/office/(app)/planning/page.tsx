import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader, Stat, td, th } from "@/components/office/kit";
import { Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDayKey, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { planningView } from "@/lib/we/planning";
import { readStore } from "@/lib/we/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crew" };

const h = (m: number) => {
  const v = m / 60;
  return Number.isInteger(v) ? `${v}h` : `${v.toFixed(1)}h`;
};

export default async function PlanningPage(props: PageProps<"/office/planning">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const today = todayKey();
  const from = weekStartOf(isDateKey(sp.from) ? sp.from : today);
  const focus = isDateKey(sp.from) && sp.from !== from ? sp.from : null;
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
        overline="Office"        title="Crew plan"
        aside={
          <Link href="/office/jobs" className="inline-flex min-h-12 items-center gap-1 text-label font-bold text-primary hover:underline">
            Jobs and staffing requirements <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      >
        Confirmed work and approved absence by person and day. Capacity is each person’s working pattern less holiday and other unavailability.
        {preview ? " Preview is on: tentative jobs and pending holiday are included, marked with dashed outlines." : " Tentative jobs and pending holiday are left out unless you turn on the preview."}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center rounded-control border border-line bg-surface">
          <Link href={qs({ from: addDays(from, -7) })} className="grid size-12 place-items-center" aria-label="Earlier week">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <span className="px-2 text-label font-bold tabular-nums">
            {formatDayKey(from, "dm")} – {formatDayKey(addDays(from, 41), "dm")}
          </span>
          <Link href={qs({ from: addDays(from, 7) })} className="grid size-12 place-items-center" aria-label="Later week">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        {from !== weekStartOf(today) && (
          <Link href={qs({ from: weekStartOf(today) })} className="inline-flex min-h-12 items-center rounded-control px-3 text-label font-bold text-primary hover:underline">
            This week
          </Link>
        )}
        <div className="flex rounded-control border border-line bg-surface p-0.5">
          {(["daily", "weekly"] as const).map((v) => (
            <Link key={v} href={qs({ view: v })} aria-current={view === v ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 text-label font-bold ${view === v ? "bg-ink text-white" : "text-ink hover:bg-subtle"}`}>
              {v === "daily" ? "Daily" : "Weekly"}
            </Link>
          ))}
        </div>
        <Link
          href={qs({ preview: preview ? "0" : "1" })}
          className={`inline-flex min-h-12 items-center rounded-control border px-3 text-label font-bold ${preview ? "border-warning/40 bg-warning-surface text-warning" : "border-line bg-surface"}`}
          aria-pressed={preview}
        >
          {preview ? "Preview on: " : ""}Tentative jobs and pending holiday
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Unfilled confirmed places"
          value={confirmedGaps.reduce((n, g) => n + g.unfilled, 0)}
          tone={confirmedGaps.length ? "warn" : "good"}
          icon={confirmedGaps.length ? AlertTriangle : CheckCircle2}
          href="#unfilled"
          note={`Across ${new Set(confirmedGaps.map((g) => g.requirement.date)).size} days`}
        />
        <Stat label="Tentative demand" value={plan.days.reduce((n, d) => n + d.tentativeRequired, 0)} note="Person-days if tentative jobs go ahead. Not in the plan." />
        <Stat
          label="At risk from pending holiday"
          value={plan.days.reduce((n, d) => n + d.unfilledIfPending - d.unfilled, 0)}
          tone="warn"
          note="Extra places unfilled if all pending holiday is approved"
          href="/office/leave#waiting"
        />
      </div>

      <Card title={view === "daily" ? "By person and day" : "By person and week"} aside="Hours shown are free capacity after assignments">
        <div className="-mx-5 -my-5 relative overflow-x-auto">
          {view === "daily" ? (
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-40 border-b border-line bg-surface px-3 py-2 text-left">Person</th>
                  {plan.dates.map((d) => (
                    <th
                      key={d}
                      className={`min-w-[74px] border-b border-line px-1 py-2 text-center font-bold ${d === today ? "bg-info-surface" : ""} ${d === focus ? "ring-2 ring-focus ring-inset" : ""} ${d === weekStartOf(d) ? "border-l-2 border-l-line" : ""}`}
                    >
                      <span className="block text-muted">{formatDayKey(d, "dow")}</span>
                      {formatDayKey(d, "dm")}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-line bg-subtle px-3 py-1.5 text-left font-bold">Places filled</th>
                  {plan.days.map((d) => (
                    <th key={d.date} className={`border-b border-line bg-subtle px-1 py-1.5 text-center ${d.date === weekStartOf(d.date) ? "border-l-2 border-l-line" : ""}`}>
                      {d.holiday ? (
                        <span className="text-muted">Bank hol.</span>
                      ) : d.required ? (
                        <span className={d.unfilled ? "font-bold text-warning" : "text-success"}>
                          {d.filled}/{d.required}
                          {d.unfilled > 0 && <span className="block">{d.unfilled} short</span>}
                        </span>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                      {preview && d.tentativeRequired > 0 && <span className="block text-muted">+{d.tentativeRequired} tent.</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.employee.id}>
                    <th className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-2 text-left align-top">
                      <span className="block text-sm font-bold">{row.employee.name}</span>
                      <span className="font-normal text-muted">
                        {roleLabel[row.employee.role]}
                        {row.employee.pattern.days.length < 5 && " · Mon–Thu"}
                      </span>
                    </th>
                    {row.days.map((d) => {
                      const off = d.patternMinutes === 0;
                      return (
                        <td
                          key={d.date}
                          className={`border-b border-line px-1 py-1 align-top ${off ? "bg-subtle" : ""} ${d.date === weekStartOf(d.date) ? "border-l-2 border-l-line" : ""}`}
                        >
                          {off ? (
                            <span className="block text-center text-muted">off</span>
                          ) : (
                            <div className="space-y-0.5">
                              {d.absences
                                .filter((a) => a.kind !== "pending_leave" || preview)
                                .map((a) => (
                                  <span
                                    key={a.sourceId + a.label}
                                    title={a.label}
                                    className={`block truncate rounded px-1 py-0.5 font-bold ${
                                      a.kind === "leave" ? "bg-info-surface text-info" : a.kind === "pending_leave" ? "border border-dashed border-warning/40 bg-warning-surface text-warning" : "bg-subtle text-muted"
                                    }`}
                                  >
                                    {a.kind === "leave" ? "Holiday" : a.kind === "pending_leave" ? "Pending" : a.label}
                                    {a.label.includes("(") && ` ${a.label.includes("morning") ? "AM" : "PM"}`}
                                  </span>
                                ))}
                              {d.chips.map((c, i) => (
                                <Link
                                  key={i}
                                  href={`/office/planning/jobs/${c.jobId}?date=${d.date}`}
                                  title={`${c.ref} ${c.start}–${c.end}${c.status === "needs_replacement" ? " (needs replacement)" : ""}`}
                                  className={`block truncate rounded px-1 py-0.5 tabular-nums font-bold ${
                                    c.status === "needs_replacement"
                                      ? "bg-warning-surface text-warning line-through"
                                      : c.tentative
                                        ? "border border-dashed border-control text-muted"
                                        : "bg-ink text-white"
                                  }`}
                                >
                                  {c.ref.replace("WE-", "")}
                                  {c.start !== row.employee.pattern.start || c.end !== row.employee.pattern.end ? (c.start < "12:00" && c.end <= "12:00" ? " AM" : c.start >= "12:00" ? " PM" : "") : ""}
                                </Link>
                              ))}
                              <span className={`block text-center ${d.remainingMinutes ? "text-success" : "text-muted"}`}>{d.remainingMinutes ? `${h(d.remainingMinutes)} free` : d.usableMinutes ? "full" : ""}</span>
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
              <thead className="border-b border-line bg-subtle">
                <tr>
                  <th className={th}>Person</th>
                  {weekStarts.map((w) => (
                    <th key={w} className={th}>
                      w/c {formatDayKey(w, "dm")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr className="bg-subtle">
                  <td className={`${td} font-bold`}>Places filled</td>
                  {weekStarts.map((w) => {
                    const ds = plan.days.filter((d) => weekStartOf(d.date) === w);
                    const req = ds.reduce((n, d) => n + d.required, 0);
                    const fill = ds.reduce((n, d) => n + d.filled, 0);
                    const short = ds.reduce((n, d) => n + d.unfilled, 0);
                    return (
                      <td key={w} className={td}>
                        <span className={short ? "font-bold text-warning" : "text-success"}>
                          {fill}/{req}
                        </span>
                        {short > 0 && <span className="block text-xs font-bold text-warning">{short} short</span>}
                      </td>
                    );
                  })}
                </tr>
                {plan.rows.map((row) => (
                  <tr key={row.employee.id}>
                    <td className={td}>
                      <span className="font-bold">{row.employee.name}</span>
                      <span className="block text-xs text-muted">{roleLabel[row.employee.role]}</span>
                    </td>
                    {row.weeks.map((w) => (
                      <td key={w.weekStart} className={td}>
                        <span className="block tabular-nums">
                          {h(w.assigned)} / {h(w.usable)}
                        </span>
                        <span className={`text-xs ${w.remaining ? "text-success" : "text-muted"}`}>{h(w.remaining)} free</span>
                        {w.leave > 0 && <span className="block text-xs text-info">{h(w.leave)} holiday</span>}
                        {w.other > 0 && <span className="block text-xs text-muted">{h(w.other)} unavailable</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span className="rounded bg-ink px-1.5 py-0.5 tabular-nums font-bold text-white">2041</span> confirmed assignment
        <span className="rounded bg-warning-surface px-1.5 py-0.5 tabular-nums font-bold text-warning line-through">2041</span> needs replacement
        <span className="rounded border border-dashed border-control px-1.5 py-0.5 tabular-nums font-bold">2053</span> tentative job
        <span className="rounded bg-info-surface px-1.5 py-0.5 font-bold text-info">Holiday</span> approved holiday
        <span className="rounded border border-dashed border-warning/40 bg-warning-surface px-1.5 py-0.5 font-bold text-warning">Pending</span> pending holiday (preview)
        <span className="rounded bg-subtle px-1.5 py-0.5 font-bold">College</span> other unavailability
      </div>

      <Card id="unfilled" title={`Unfilled places (${confirmedGaps.length})`} className="mt-6" aside="Confirmed jobs in these six weeks">
        {confirmedGaps.length === 0 ? (
          <p className="text-sm text-success">Every confirmed place is filled.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {confirmedGaps.slice(0, 40).map((g) => (
              <li key={g.requirement.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-bold">{formatDayKey(g.requirement.date, "short")}</span> · {g.job.ref} {g.job.title} · {g.requirement.start}–{g.requirement.end} ·{" "}
                  <span className="font-bold text-warning">
                    {g.unfilled} {roleLabel[g.requirement.role].toLowerCase()} short
                  </span>
                  {g.needsReplacement.length > 0 && <Pill tone="amber">Needs replacement</Pill>}
                </span>
                <Link href={`/office/planning/jobs/${g.job.id}?date=${g.requirement.date}`} className="inline-flex min-h-12 items-center font-bold text-primary hover:underline">
                  Staff it
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
                  <Link href={`/office/planning/jobs/${jobId}`} className="font-bold text-primary">
                    Plan it
                  </Link>
                </li>
              );
            })}
            {pendingRisk.map((c) => (
              <li key={c.requirement.id}>
                <Pill tone="amber">Pending holiday</Pill> {formatDayKey(c.requirement.date, "short")} {c.job.ref}: {c.atRisk.map((a) => store.employees.find((e) => e.id === a.employeeId)?.name).join(", ")} has pending holiday.
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
