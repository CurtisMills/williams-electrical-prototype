import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ActionButton, ReasonAction } from "@/components/office/actions";
import { AvailabilitySummary } from "@/components/portal/AvailabilitySummary";
import { Card, PageHeading, td, th } from "@/components/portal/layout";
import { Notice } from "@/components/portal/notice";
import { HolidayStatusBadge, StatusBadge } from "@/components/portal/status";
import { requireRole } from "@/lib/auth/session";
import { dayCount, formatDateRange, formatDayKey, formatDuration, formatWhen } from "@/lib/field/dates";
import { leaveBalance, leaveYearOf, portionLabel, roleLabel } from "@/lib/we/calc";
import { leaveImpact } from "@/lib/we/planning";
import { formatBalance, holidayWording } from "@/lib/we/present";
import { readStore } from "@/lib/we/store";
import type { Assignment } from "@/lib/we/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Holiday request" };

const statusWord = { pending: "Pending", approved: "Approved", declined: "Declined", withdrawn: "Withdrawn", cancelled: "Cancelled" } as const;

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
  const roleName = `${roleLabel[emp.role].toLowerCase()}s`;
  const leftAfter = pending ? balance.remaining - r.totalDays : balance.remaining - (r.status === "approved" ? r.totalDays : 0);
  const showAvailability = pending || r.status === "approved";

  return (
    <>
      <Link href="/office/leave" className="mb-2 inline-flex min-h-12 items-center gap-1 text-label font-bold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All holiday
      </Link>
      <PageHeading eyebrow={`Holiday request · Ref ${r.id}`} title={`${emp.name}: ${formatDateRange(r.firstDay, r.lastDay)}`}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <HolidayStatusBadge status={r.status} cancelling={!!r.cancellation} />
          <span>
            {roleLabel[emp.role]} · {dayCount(r.totalDays)} · requested {formatWhen(r.createdAt)}
          </span>
        </span>
      </PageHeading>

      {r.cancellation && (
        <Notice tone="warning" title="Cancellation requested" className="mb-6" live={false}>
          {formatWhen(r.cancellation.requestedAt)}: “{r.cancellation.reason}”. The holiday stays booked until you decide.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6">
          <Card title="Requested days">
            <ul className="divide-y divide-line">
              {r.days.map((d) => (
                <li key={d.date} className="flex justify-between gap-3 py-2 first:pt-0">
                  <span>{formatDayKey(d.date, "short")}</span>
                  <span className="text-muted">{portionLabel[d.portion]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-line pt-3 font-bold tabular-nums">Total {dayCount(r.totalDays)}</p>
            {r.note && <p className="mt-2 text-label text-muted">“{r.note}”</p>}
          </Card>

          <Card title={`${year} balance`}>
            <dl className="space-y-2 text-body">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Allowance</dt>
                <dd className="tabular-nums">{dayCount(balance.allowance)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Already approved</dt>
                <dd className="tabular-nums">{dayCount(balance.approved)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Other pending</dt>
                <dd className="tabular-nums">{dayCount(balance.pending)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-bold">
                <dt>{pending ? "Left if approved" : "Left"}</dt>
                <dd className="tabular-nums">{Number.isFinite(leftAfter) ? dayCount(leftAfter) : formatBalance(null)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {showAvailability && (
            <Card title="Crew availability" aside={pending ? "If you approve" : "With this holiday booked"}>
              <AvailabilitySummary
                role={roleName}
                condition={pending ? "If approved" : "Booked"}
                inspectHref={(date) => `/office/planning?from=${date}`}
                days={impact.sameRoleOffByDate.map((d) => ({ date: d.date, label: formatDayKey(d.date, "short"), available: d.total - d.off, total: d.total }))}
              />
            </Card>
          )}

          <Card title="Planned work affected" aside={pending ? "What approving would do" : undefined}>
            {impact.affected.length === 0 ? (
              <p className="text-muted">{replacements.length ? "Affected work has been covered." : `${emp.name} has no planned work on these days.`}</p>
            ) : (
              <ul className="space-y-3">
                {impact.affected.map((a) => (
                  <li key={a.assignment.id} className={`rounded-card border p-4 ${a.unfilledAfter > 0 ? "border-warning/40 bg-warning-surface" : "border-line"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold">
                          {a.job.ref} · {a.job.title}
                        </p>
                        <p className="text-label text-muted tabular-nums">
                          {formatDayKey(a.assignment.date, "short")}, {a.assignment.start}–{a.assignment.end} · needs {a.requirement.count}{" "}
                          {roleLabel[a.requirement.role].toLowerCase()}
                          {a.requirement.count > 1 ? "s" : ""}
                        </p>
                      </div>
                      {a.unfilledAfter > 0 ? (
                        <StatusBadge tone="warning" icon={AlertTriangle}>
                          {pending ? "Would be unfilled" : "Needs a replacement"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="success" icon={CheckCircle2}>
                          Still covered
                        </StatusBadge>
                      )}
                    </div>
                    {a.unfilledAfter > 0 && (
                      <div className="mt-3 text-label">
                        {a.candidates.length === 0 ? (
                          <p className="font-semibold text-ink">Nobody suitable is free. Consider moving the work or declining.</p>
                        ) : pending ? (
                          <p>Free to replace: {a.candidates.map((c) => `${c.employee.name} (${formatDuration(c.remainingMinutes)} free)`).join(", ")}</p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>Assign a replacement:</span>
                            {a.candidates.map((c) => (
                              <ActionButton
                                key={c.employee.id}
                                url="/api/office/planning"
                                body={{ action: "assign", requirementId: a.requirement.id, employeeId: c.employee.id }}
                                tone="outline"
                                size="sm"
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
              <ul className="mt-3 space-y-1 text-label">
                {replacements.map((a) => {
                  const before = a.before as Assignment;
                  return (
                    <li key={a.id} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>
                        {store.jobs.find((j) => j.id === before.jobId)?.ref} on {formatDayKey(before.date, "short")}: {a.action} ({a.actorName}, {formatWhen(a.at)})
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Who else is off" flush>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[480px] text-body">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>Day</th>
                    <th className={th}>Other absence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {impact.sameRoleOffByDate.map((d) => {
                    const others = impact.otherAbsence.filter((o) => o.date === d.date);
                    return (
                      <tr key={d.date}>
                        <td className={`${td} whitespace-nowrap`}>{formatDayKey(d.date, "short")}</td>
                        <td className={td}>
                          {others.length === 0 ? (
                            <span className="text-muted">Nobody</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {others.map((o, i) => (
                                <li key={i}>
                                  {o.employee.name}: <span className="text-muted">{holidayWording(o.label)}</span>
                                  {o.kind === "pending_leave" && <span className="text-label text-muted"> (not booked)</span>}
                                </li>
                              ))}
                            </ul>
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
      </div>

      <Card title="Decision" className="mt-6" id="decision">
        {pending ? (
          <div className="space-y-4">
            {gaps.length > 0 && (
              <p className="flex max-w-prose items-start gap-2 text-label">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-bold text-warning">Warning, not a block.</span> Approving leaves {gaps.length} planned {gaps.length === 1 ? "slot" : "slots"} without
                  cover. You can assign replacements straight after approving.
                </span>
              </p>
            )}
            <div className="flex flex-wrap items-start gap-3">
              <ActionButton
                url={`/api/office/leave/${r.id}`}
                body={{ action: "approve", version: r.version }}
                tone="primary"
                busyLabel="Approving…"
                confirm={
                  gaps.length
                    ? `Approving leaves ${gaps.length} planned slot${gaps.length > 1 ? "s" : ""} unfilled. They'll be flagged as needing a replacement. Approve anyway?`
                    : undefined
                }
                success="Holiday approved. The employee has been notified."
              >
                Approve holiday
              </ActionButton>
              <ReasonAction
                url={`/api/office/leave/${r.id}`}
                body={{ action: "decline", version: r.version }}
                label="Decline"
                submitLabel="Decline request"
                submitTone="danger"
                reasonLabel="Reason (shown to the employee)"
              />
            </div>
          </div>
        ) : r.cancellation ? (
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton
              url={`/api/office/leave/${r.id}`}
              body={{ action: "approve_cancel", version: r.version }}
              tone="primary"
              success="Cancelled. The days went back to the allowance."
            >
              Approve cancellation
            </ActionButton>
            <ReasonAction
              url={`/api/office/leave/${r.id}`}
              body={{ action: "decline_cancel", version: r.version }}
              label="Keep holiday booked"
              reasonLabel="Reason (shown to the employee)"
            />
          </div>
        ) : (
          <p>
            {statusWord[r.status]}
            {r.decidedBy && ` by ${names.get(r.decidedBy) ?? r.decidedBy}`}
            {r.decidedAt && `, ${formatWhen(r.decidedAt)}`}
            {r.decisionReason && `: “${r.decisionReason}”`}
          </p>
        )}

        <h3 className="mt-6 mb-2 text-label font-bold">History</h3>
        <ol className="space-y-1 border-l-2 border-line pl-3 text-label">
          {r.history.map((h, i) => (
            <li key={i}>
              <span className="font-bold">{h.action[0].toUpperCase() + h.action.slice(1)}</span> · {names.get(h.by) ?? h.by} · {formatWhen(h.at)}
              {h.reason && <span className="text-muted"> · “{h.reason}”</span>}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
