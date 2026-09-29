import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/office/actions";
import { Card, PageHeader, td, th } from "@/components/office/kit";
import { Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDayKey, isDateKey, todayKey } from "@/lib/field/dates";
import { roleLabel } from "@/lib/we/calc";
import { jobPlan, jobStatusLabel } from "@/lib/we/planning";
import { readStore } from "@/lib/we/store";
import { AssignAcrossForm, RequirementForm } from "./JobPlanForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Job staffing" };

export default async function JobPlanningPage(props: PageProps<"/office/planning/jobs/[id]">) {
  await requireRole("office");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const store = await readStore();
  if (!store.jobs.some((j) => j.id === id)) notFound();
  const today = todayKey();
  const focus = isDateKey(sp.date) ? sp.date : null;
  const showAll = sp.all === "1";
  const from = focus && !showAll ? addDays(focus, -3) : today;
  const plan = jobPlan(store, id, from);
  const rows = showAll ? plan.rows : plan.rows.filter((r) => r.coverage.requirement.date <= addDays(from, 27));
  const name = (eid: string) => store.employees.find((e) => e.id === eid)?.name ?? eid;
  const { job, site, customer } = plan;
  const locked = job.status === "cancelled" || job.status === "archived" || job.status === "completed";
  const openSlots = plan.rows.filter((r) => r.coverage.unfilled > 0).length;

  return (
    <>
      <PageHeader
        overline={`JOB ${job.ref}`}
        title={job.title}
        aside={
          <>
            <Link href="/office/planning" className="inline-flex min-h-12 items-center text-label font-bold text-primary hover:underline">
              Crew plan
            </Link>
            <Link href="/office/jobs" className="inline-flex min-h-12 items-center text-label font-bold text-primary hover:underline">
              Job details
            </Link>
          </>
        }
      >
        <span className="inline-flex flex-wrap items-center gap-2">
          <Pill tone={job.status === "confirmed" ? "green" : job.status === "tentative" ? "amber" : "grey"}>{jobStatusLabel[job.status]}</Pill>
          {customer.name} · {site.name}, {site.address} · {formatDayKey(job.startDate, "dm")} to {formatDayKey(job.endDate, "dm")}
        </span>
      </PageHeader>

      {job.status === "tentative" && (
        <p className="mb-4 rounded-card border border-dashed border-warning/40 bg-warning-surface p-3 text-sm text-warning">
          Tentative job: its staffing needs are shown in the planning preview only and don’t count as unfilled in the confirmed plan. Confirm it on the Jobs page
          when it’s won.
        </p>
      )}
      {locked && <p className="mb-4 rounded-card bg-subtle p-3 text-sm font-bold">This job is {job.status}. Reopen it on the Jobs page before changing staffing.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Add or change a staffing requirement">
          <RequirementForm jobId={job.id} defaultFrom={job.startDate > today ? job.startDate : today} defaultTo={job.endDate} />
        </Card>
        <Card title="Assign one person across several days">
          <AssignAcrossForm
            jobId={job.id}
            employees={store.employees.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name, role: e.role }))}
            defaultFrom={focus ?? today}
            defaultTo={job.endDate}
          />
        </Card>
      </div>

      <Card
        title={`Staffing by day (${openSlots} open slot${openSlots === 1 ? "" : "s"})`}
        className="mt-6"
        aside={
          <Link href={showAll ? `/office/planning/jobs/${id}` : `/office/planning/jobs/${id}?all=1`} className="font-bold text-primary">
            {showAll ? "Show next 4 weeks" : "Show every future day"}
          </Link>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No staffing requirements in this period. Add one above.</p>
        ) : (
          <div className="-mx-5 -my-5 relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-line bg-subtle">
                <tr>
                  <th className={th}>Day</th>
                  <th className={th}>Needs</th>
                  <th className={th}>Assigned</th>
                  <th className={th}>Fill the gap</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ coverage: c, candidates }) => {
                  const r = c.requirement;
                  const ok = candidates.filter((x) => x.ok);
                  const blocked = candidates.filter((x) => !x.ok);
                  const assignedHere = store.assignments.filter((a) => a.requirementId === r.id);
                  return (
                    <tr key={r.id} className={r.date === focus ? "bg-warning-surface" : c.unfilled ? "bg-warning-surface" : undefined}>
                      <td className={`${td} whitespace-nowrap`}>
                        <span className="font-bold">{formatDayKey(r.date, "short")}</span>
                        <span className="block text-xs text-muted">
                          {r.start}–{r.end}
                        </span>
                      </td>
                      <td className={td}>
                        {r.count} × {roleLabel[r.role].toLowerCase()}
                        <span className="block">
                          {c.unfilled > 0 ? <Pill tone="amber">{c.unfilled} unfilled</Pill> : <Pill tone="green">Covered</Pill>}
                        </span>
                      </td>
                      <td className={td}>
                        {assignedHere.length === 0 && <span className="text-muted">Nobody</span>}
                        {assignedHere.map((a) => (
                          <span key={a.id} className="mb-1 flex items-center gap-2">
                            <span className={a.status === "needs_replacement" ? "text-warning line-through" : "font-bold"}>{name(a.employeeId)}</span>
                            {a.status === "needs_replacement" && <span className="text-xs text-warning">{a.statusReason}</span>}
                            {c.atRisk.some((x) => x.id === a.id) && <Pill tone="amber">Pending holiday</Pill>}
                            {!locked && a.status === "confirmed" && (
                              <ActionButton url="/api/office/planning" body={{ action: "unassign", assignmentId: a.id, reason: "Removed in planning" }} tone="ghost" confirm={`Remove ${name(a.employeeId)} from ${job.ref} on ${formatDayKey(r.date)}?`}>
                                Remove
                              </ActionButton>
                            )}
                          </span>
                        ))}
                      </td>
                      <td className={td}>
                        {c.unfilled > 0 && !locked && (
                          <>
                            {ok.length === 0 ? (
                              <span className="font-bold text-warning">Nobody suitable is free</span>
                            ) : (
                              <span className="flex flex-wrap gap-1.5">
                                {ok.map((x) => (
                                  <ActionButton
                                    key={x.employee.id}
                                    url="/api/office/planning"
                                    body={{ action: "assign", requirementId: r.id, employeeId: x.employee.id }}
                                    tone="dark"
                                    success="Assigned and notified."
                                  >
                                    {x.employee.name}
                                    {x.warnings.length > 0 && " ⚠"}
                                  </ActionButton>
                                ))}
                              </span>
                            )}
                            {blocked.length > 0 && (
                              <details className="mt-1.5 text-xs text-muted">
                                <summary className="cursor-pointer font-bold">Why not others? ({blocked.length})</summary>
                                <ul className="mt-1 space-y-0.5">
                                  {blocked.map((x) => (
                                    <li key={x.employee.id}>
                                      <span className="font-bold">{x.employee.name}:</span> {x.problems[0]}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </>
                        )}
                      </td>
                      <td className={td}>
                        {assignedHere.length === 0 && !locked && (
                          <ActionButton url="/api/office/planning" body={{ action: "remove_requirement", requirementId: r.id }} tone="ghost" confirm="Remove this staffing requirement?">
                            Delete slot
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
