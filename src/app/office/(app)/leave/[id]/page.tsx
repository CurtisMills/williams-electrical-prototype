import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ReasonAction } from "@/components/office/actions";
import { Card, PageHeader, td, th } from "@/components/office/kit";
import { LeaveStatusPill, Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatDateRange, formatDayKey, formatDuration, formatWhen } from "@/lib/field/dates";
import { leaveBalance, leaveYearOf, portionLabel, roleLabel } from "@/lib/we/calc";
import { leaveImpact } from "@/lib/we/planning";
import { readStore } from "@/lib/we/store";
import type { Assignment } from "@/lib/we/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leave request" };

export default async function LeaveDetailPage(props: PageProps<"/office/leave/[id]">) {
  await requireRole("office");
  const { id } = await props.params;
  const store = await readStore();
  const r = store.leave.find((x) => x.id === id);
  if (!r) notFound();
  const impact = leaveImpact(store, r);
  const emp = impact.employee;
  const year = leaveYearOf(r.firstDay, store.settings);
  const balance = leaveBalance(emp, store.leave, year, store.settings, r.id);
  const pending = r.status === "pending";
  const gaps = impact.affected.filter((a) => a.unfilledAfter > 0);
  const names = new Map([...store.employees.map((e) => [e.id, e.name] as const), ["office-megan", "Megan Lloyd"], ["office-gareth", "Gareth Williams"]]);
  const replacements = store.audit.filter(
    (a) => a.entity === "assignment" && a.action.startsWith("replaced by") && (a.before as Assignment | null)?.statusReason === `Approved leave ${r.id}`,
  );

  return (
    <>
      <PageHeader
        overline={`LEAVE REQUEST ${r.id}`}
        title={`${emp.name}: ${formatDateRange(r.firstDay, r.lastDay)}`}
        aside={
          <Link href="/office/leave" className="text-sm font-bold text-signal-700">
            ← All leave
          </Link>
        }
      >
        <span className="inline-flex items-center gap-2">
          <LeaveStatusPill status={r.status} cancelling={!!r.cancellation} /> {roleLabel[emp.role]} · requested {formatWhen(r.createdAt)}
        </span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Request" className="lg:col-span-1">
          <ul className="mb-3 space-y-1 text-sm">
            {r.days.map((d) => (
              <li key={d.date} className="flex justify-between">
                <span>{formatDayKey(d.date, "short")}</span>
                <span className="text-ink-600">{portionLabel[d.portion]}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-50 pt-2 text-sm font-bold">{r.totalDays} days</p>
          {r.note && <p className="mt-2 text-sm text-ink-600">“{r.note}”</p>}
          <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm">
            <p className="font-bold">{year} allowance</p>
            <p>
              {balance.allowance} allowance · {balance.approved} approved · {balance.pending} other pending
            </p>
            <p className="font-bold">
              {pending ? `${balance.remaining - r.totalDays} left if approved` : `${balance.remaining - (r.status === "approved" ? r.totalDays : 0)} left`}
            </p>
          </div>
          {r.cancellation && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              <span className="font-bold">Cancellation requested</span> {formatWhen(r.cancellation.requestedAt)}: “{r.cancellation.reason}”. The leave stays booked until
              you decide.
            </p>
          )}
        </Card>

        <Card title="Staffing impact" className="lg:col-span-2" aside={pending ? "What approving would do" : undefined}>
          {impact.affected.length === 0 ? (
            <p className="text-sm text-ink-600">
              {replacements.length ? "Affected work has been covered." : `${emp.name} has no planned work on these days.`}
            </p>
          ) : (
            <ul className="space-y-3">
              {impact.affected.map((a) => (
                <li key={a.assignment.id} className={`rounded-xl border p-3 ${a.unfilledAfter > 0 ? "border-signal-600/40 bg-signal-600/5" : "border-ink-100"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {a.job.ref} · {a.job.title}
                      </p>
                      <p className="text-sm text-ink-600">
                        {formatDayKey(a.assignment.date, "short")}, {a.assignment.start}–{a.assignment.end} · needs {a.requirement.count} {roleLabel[a.requirement.role].toLowerCase()}
                        {a.requirement.count > 1 ? "s" : ""}
                      </p>
                    </div>
                    {a.unfilledAfter > 0 ? (
                      <Pill tone="red">{pending ? "Would be unfilled" : "Unfilled: needs replacement"}</Pill>
                    ) : (
                      <Pill tone="green">Still covered</Pill>
                    )}
                  </div>
                  {a.unfilledAfter > 0 && (
                    <div className="mt-2 text-sm">
                      {a.candidates.length === 0 ? (
                        <p className="font-bold text-signal-800">Nobody suitable is free. Consider moving the work or declining.</p>
                      ) : pending ? (
                        <p className="text-ink-700">
                          Free to replace: {a.candidates.map((c) => `${c.employee.name} (${formatDuration(c.remainingMinutes)} free)`).join(", ")}
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-700">Assign a replacement:</span>
                          {a.candidates.map((c) => (
                            <ActionButton
                              key={c.employee.id}
                              url="/api/office/planning"
                              body={{ action: "assign", requirementId: a.requirement.id, employeeId: c.employee.id }}
                              tone="dark"
                              success={`${c.employee.name} assigned and notified.`}
                            >
                              {c.employee.name}
                            </ActionButton>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {replacements.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-emerald-800">
              {replacements.map((a) => {
                const before = a.before as Assignment;
                return (
                  <li key={a.id}>
                    ✓ {store.jobs.find((j) => j.id === before.jobId)?.ref} on {formatDayKey(before.date, "short")}: {a.action} ({a.actorName}, {formatWhen(a.at)})
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="mt-5 mb-2 text-sm font-extrabold">Who else is off</h3>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-y border-ink-100 bg-ink-50/60">
                <tr>
                  <th className={th}>Day</th>
                  <th className={th}>{roleLabel[emp.role]}s off</th>
                  <th className={th}>Other absence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {impact.sameRoleOffByDate.map((d) => {
                  const others = impact.otherAbsence.filter((o) => o.date === d.date);
                  return (
                    <tr key={d.date}>
                      <td className={`${td} whitespace-nowrap`}>{formatDayKey(d.date, "short")}</td>
                      <td className={td}>
                        <span className={d.off / d.total >= 0.4 ? "font-bold text-signal-700" : undefined}>
                          {d.off} of {d.total}
                        </span>{" "}
                        <span className="text-xs text-ink-500">including this request</span>
                      </td>
                      <td className={td}>
                        {others.length === 0 ? (
                          <span className="text-ink-400">Nobody</span>
                        ) : (
                          others.map((o, i) => (
                            <span key={i} className="mr-2 inline-block">
                              {o.employee.name}: <span className={o.kind === "pending_leave" ? "text-amber-800" : "text-violet-800"}>{o.label}</span>
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Decision" className="mt-6">
        {pending ? (
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton
              url={`/api/office/leave/${r.id}`}
              body={{ action: "approve", version: r.version }}
              tone="dark"
              confirm={
                gaps.length
                  ? `Approving leaves ${gaps.length} planned slot${gaps.length > 1 ? "s" : ""} unfilled. They'll be flagged as needing a replacement. Approve anyway?`
                  : undefined
              }
              success="Approved. The employee has been notified."
            >
              {gaps.length ? "Approve anyway" : "Approve"}
            </ActionButton>
            <ReasonAction url={`/api/office/leave/${r.id}`} body={{ action: "decline", version: r.version }} label="Decline" reasonLabel="Reason (shown to the employee)" />
            {gaps.length > 0 && <p className="max-w-md text-sm text-signal-800">Warning: {gaps.length} slot(s) would be left without cover. You can assign replacements straight after approving.</p>}
          </div>
        ) : r.cancellation ? (
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton url={`/api/office/leave/${r.id}`} body={{ action: "approve_cancel", version: r.version }} tone="dark" success="Cancelled. Days returned to the allowance.">
              Approve cancellation
            </ActionButton>
            <ReasonAction url={`/api/office/leave/${r.id}`} body={{ action: "decline_cancel", version: r.version }} label="Keep leave booked" reasonLabel="Reason (shown to the employee)" />
          </div>
        ) : (
          <p className="text-sm text-ink-600">
            {r.status === "approved" ? "Approved" : r.status[0].toUpperCase() + r.status.slice(1)}
            {r.decidedBy && ` by ${names.get(r.decidedBy) ?? r.decidedBy}`}
            {r.decidedAt && `, ${formatWhen(r.decidedAt)}`}
            {r.decisionReason && `: “${r.decisionReason}”`}
          </p>
        )}

        <h3 className="mt-5 mb-2 text-sm font-extrabold">History</h3>
        <ol className="space-y-1 border-l-2 border-ink-100 pl-3 text-sm">
          {r.history.map((h, i) => (
            <li key={i}>
              <span className="font-bold capitalize">{h.action}</span> · {names.get(h.by) ?? h.by} · {formatWhen(h.at)}
              {h.reason && <span className="text-ink-600"> · “{h.reason}”</span>}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
