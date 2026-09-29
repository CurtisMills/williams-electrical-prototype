import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReasonAction } from "@/components/office/actions";
import { Card, PageHeader, td, th } from "@/components/office/kit";
import { Pill, TimesheetPill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { dateKeyOf, formatClock, formatDayKey, formatDuration, formatWhen, weekStartOf } from "@/lib/field/dates";
import { breakMinutes, dailySplit, netMinutes } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { sheetFor } from "@/lib/we/timesheets";
import type { SessionValues } from "@/lib/we/types";
import { lookup, selectableJobs } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";
import { OfficeTimesForm } from "../OfficeTimesForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Record" };

export default async function RecordPage(props: PageProps<"/office/records/[id]">) {
  await requireRole("office");
  const { id } = await props.params;
  const store = await readStore();
  const s = store.sessions.find((x) => x.id === id);
  if (!s) notFound();
  const l = lookup(store);
  const employee = l.employee(s.employeeId)!;
  const job = l.job(s.jobId);
  const site = l.site(job?.siteId);
  const week = weekStartOf(dateKeyOf(s.startedAt));
  const sheet = sheetFor(store, s.employeeId, week);
  const events = store.events.filter((e) => e.sessionId === s.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const trail = store.audit.filter((a) => a.entity === "session" && a.entityId === s.id).sort((a, b) => b.at.localeCompare(a.at));
  const pending = store.corrections.filter((c) => c.sessionId === s.id && c.status === "pending");
  const describe = (v: SessionValues) => {
    const j = l.job(v.jobId);
    return `${formatDayKey(dateKeyOf(v.startedAt), "short")} ${formatClock(v.startedAt)}–${v.finishedAt ? formatClock(v.finishedAt) : "no finish"}, ${v.breakMinutes} min break, ${j ? j.ref : activityLabel[v.activity]}`;
  };
  const isValues = (v: unknown): v is SessionValues => !!v && typeof v === "object" && "startedAt" in v;

  return (
    <>
      <PageHeader
        overline={`RECORD ${s.id}`}
        title={`${employee.name}, ${formatDayKey(dateKeyOf(s.startedAt), "long")}`}
        aside={
          <Link href={`/office/history?employee=${employee.id}`} className="inline-flex min-h-12 items-center text-label font-bold text-primary hover:underline">
            {employee.name}’s history
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="What’s recorded" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-muted">Job</dt>
              <dd className="font-bold">{job ? `${job.ref} · ${job.title}` : `${activityLabel[s.activity]}${s.note ? `: ${s.note}` : ""}`}</dd>
              {site && <dd className="text-muted">{l.customer(job?.customerId)?.name} · {site.name}, {site.address}</dd>}
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Times</dt>
              <dd className="tabular-nums font-bold">
                {formatClock(s.startedAt)}–{s.finishedAt ? formatClock(s.finishedAt) : "no finish yet"}
                {s.finishedAt && dateKeyOf(s.finishedAt) !== dateKeyOf(s.startedAt) && " (next day)"}
              </dd>
              <dd className="text-muted">
                {Math.round(breakMinutes(s))} min break · {s.finishedAt ? `${formatDuration(netMinutes(s))} worked` : "excluded from totals until finished"}
              </dd>
              {s.finishedAt && dailySplit(s).length > 1 && (
                <dd className="text-xs text-muted">
                  Split at midnight: {dailySplit(s).map((d) => `${formatDayKey(d.date, "dm")} ${formatDuration(d.netMinutes)}`).join(", ")}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Source</dt>
              <dd>{s.source === "phone" ? "Employee’s phone" : s.source === "phone_offline" ? "Employee’s phone, sent after reconnecting" : s.source === "office" ? "Entered by the office" : "Demo data"}</dd>
              <dd className="text-xs text-muted">First received {formatWhen(s.receivedAt)} · last update {formatWhen(s.lastEventAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Timesheet</dt>
              <dd className="flex items-center gap-2">
                <TimesheetPill status={sheet.status} />
                <Link href={`/office/timesheets/${employee.id}?week=${week}`} className="inline-flex min-h-12 items-center text-label font-bold text-primary hover:underline">
                  Week of {formatDayKey(week, "dm")}
                </Link>
              </dd>
              {sheet.status === "approved" && <dd className="text-xs text-warning">Correcting this reopens the approved week for review.</dd>}
            </div>
          </dl>
          {s.original && (
            <p className="mt-4 rounded-control bg-subtle p-3 text-sm">
              <span className="font-bold">Originally recorded:</span> {describe(s.original)}
            </p>
          )}
          {s.voided && <p className="mt-4 rounded-control bg-warning-surface p-3 text-sm font-bold text-warning">This record has been removed and is excluded from all hours.</p>}
          {pending.map((c) => (
            <p key={c.id} className="mt-4 rounded-control bg-info-surface p-3 text-sm">
              <span className="font-bold">{c.provisional ? "Employee added the finish:" : "Employee asks for:"}</span> {c.proposed.start}–{c.proposed.finish}, {c.proposed.breakMinutes} min break. “{c.reason}”{" "}
              <Link href={`/office/exceptions#${c.id}`} className="font-bold text-primary">
                Review
              </Link>
            </p>
          ))}
        </Card>

        <Card title="Phone taps received">
          {events.length === 0 ? (
            <p className="text-sm text-muted">No phone events (entered by the office or demo data).</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <span className="font-bold capitalize">{e.type}</span> at {formatClock(e.occurredAt)}
                  {e.offline && <span className="text-muted"> · received {formatWhen(e.receivedAt)}</span>}
                  {e.outcome === "conflict" && <Pill tone="red">Clash</Pill>}
                  <span className="block text-xs text-muted">{e.detail}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {!s.voided && (
        <Card title={s.finishedAt ? "Correct this record" : "Add the finish time"} className="mt-6">
          <OfficeTimesForm
            mode="correct"
            sessionId={s.id}
            version={s.version}
            jobs={selectableJobs(store)}
            initial={{
              date: dateKeyOf(s.startedAt),
              start: formatClock(s.startedAt),
              finish: s.finishedAt ? formatClock(s.finishedAt) : "",
              finishNextDay: !!s.finishedAt && dateKeyOf(s.finishedAt) !== dateKeyOf(s.startedAt),
              breakMinutes: Math.round(breakMinutes(s)),
              jobId: s.jobId,
              activity: s.activity,
              note: s.note,
            }}
          />
        </Card>
      )}

      <Card title="Change history" className="mt-6" aside="Who changed what, when and why">
        {trail.length === 0 ? (
          <p className="text-sm text-muted">Not changed since it was recorded.</p>
        ) : (
          <div className="-mx-5 -my-5 relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line bg-subtle">
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Who</th>
                  <th className={th}>What</th>
                  <th className={th}>Before</th>
                  <th className={th}>After</th>
                  <th className={th}>Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {trail.map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} whitespace-nowrap`}>{formatWhen(a.at)}</td>
                    <td className={td}>{a.actorName}</td>
                    <td className={`${td} capitalize`}>{a.action}</td>
                    <td className={td}>{isValues(a.before) ? describe(a.before) : "–"}</td>
                    <td className={td}>{isValues(a.after) ? describe(a.after) : "–"}</td>
                    <td className={td}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <ReasonAction
          url={`/api/office/sessions/${s.id}`}
          body={{ action: "void", version: s.version }}
          label={s.voided ? "Restore this record" : "Remove this record"}
          reasonLabel={s.voided ? "Why restore it?" : "Why remove it? (e.g. duplicate entry)"}
          tone={s.voided ? "outline" : "ghost"}
          success={s.voided ? "Record removed." : "Record restored."}
        />
      </div>
    </>
  );
}
