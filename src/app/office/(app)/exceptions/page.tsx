import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, ReasonAction } from "@/components/office/actions";
import { Card, Empty, PageHeader } from "@/components/office/kit";
import { Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatClock, formatDayKey, formatWhen } from "@/lib/field/dates";
import { breakMinutes } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { exceptionKindLabel, exceptions, lookup, type ExceptionKind } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Exceptions" };

const groups: { title: string; kinds: ExceptionKind[]; blurb: string }[] = [
  { title: "Time records", kinds: ["missing_finish", "no_start", "phone_conflict", "overlap", "unassigned_work", "long_session"], blurb: "Records that are incomplete, unusual or clash." },
  { title: "Employee requests", kinds: ["correction", "timesheet_review"], blurb: "Changes and timesheets waiting for a decision." },
  { title: "Staffing", kinds: ["needs_replacement", "unfilled"], blurb: "Planned work without enough people." },
];

export default async function ExceptionsPage(props: PageProps<"/office/exceptions">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const kind = typeof sp.kind === "string" ? (sp.kind as ExceptionKind) : null;
  const store = await readStore();
  const l = lookup(store);
  const all = exceptions(store, new Date());
  const items = kind ? all.filter((i) => i.kind === kind) : all;
  const counts = new Map<ExceptionKind, number>();
  for (const i of all) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);

  const correctionFor = (id: string) => store.corrections.find((c) => `co-${c.id}` === id);
  const eventFor = (id: string) => store.events.find((e) => `pc-${e.id}` === id);
  const jobLabel = (jobId: string | null, activity: string) => {
    const j = l.job(jobId);
    return j ? `${j.ref} ${j.title}` : activityLabel[activity as keyof typeof activityLabel];
  };

  return (
    <>
      <PageHeader overline="OFFICE" title="Exceptions">
        Everything that needs a person to look at it. Each item says what’s wrong and what to do. Items disappear once they’re resolved.
      </PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/office/exceptions" className={`rounded-full px-3 py-1.5 text-sm font-bold ${!kind ? "bg-ink-900 text-white" : "border border-ink-200 bg-white"}`}>
          All ({all.length})
        </Link>
        {[...counts.entries()].map(([k, n]) => (
          <Link
            key={k}
            href={`/office/exceptions?kind=${k}`}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${kind === k ? "bg-ink-900 text-white" : "border border-ink-200 bg-white"}`}
          >
            {exceptionKindLabel[k]} ({n})
          </Link>
        ))}
      </div>

      {items.length === 0 && <Empty>Nothing needs attention. Well done.</Empty>}

      <div className="space-y-6">
        {groups.map((g) => {
          const list = items.filter((i) => g.kinds.includes(i.kind));
          if (!list.length) return null;
          return (
            <Card key={g.title} title={g.title} aside={g.blurb}>
              <ul className="divide-y divide-ink-50">
                {list.map((i) => {
                  const c = i.kind === "correction" ? correctionFor(i.id) : undefined;
                  const e = i.kind === "phone_conflict" ? eventFor(i.id) : undefined;
                  const s = c?.sessionId ? store.sessions.find((x) => x.id === c.sessionId) : undefined;
                  return (
                    <li key={i.id} id={c?.id ?? e?.id} className="scroll-mt-24 py-3.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Pill tone={i.kind === "no_start" ? "amber" : i.kind === "timesheet_review" || i.kind === "correction" ? "blue" : i.kind === "unfilled" || i.kind === "needs_replacement" ? "violet" : "red"}>
                              {exceptionKindLabel[i.kind]}
                            </Pill>
                            <span className="text-xs text-ink-500">{formatDayKey(i.date, "short")}</span>
                          </div>
                          <p className="font-bold">{i.title}</p>
                          <p className="text-sm text-ink-600">{i.detail}</p>

                          {c && (
                            <div className="mt-2 grid max-w-2xl gap-2 text-sm sm:grid-cols-2">
                              {s && (
                                <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-2.5">
                                  <p className="text-xs font-extrabold text-ink-500 uppercase">{c.provisional ? "Before employee’s change" : "Recorded now"}</p>
                                  {c.provisional && s.original ? (
                                    <p>
                                      {formatClock(s.original.startedAt)}–{s.original.finishedAt ? formatClock(s.original.finishedAt) : "no finish"} · {s.original.breakMinutes} min break
                                    </p>
                                  ) : (
                                    <p>
                                      {formatClock(s.startedAt)}–{s.finishedAt ? formatClock(s.finishedAt) : "no finish"} · {breakMinutes(s)} min break
                                    </p>
                                  )}
                                  <p className="text-ink-600">{jobLabel(s.original?.jobId ?? s.jobId, s.original?.activity ?? s.activity)}</p>
                                </div>
                              )}
                              <div className="rounded-lg border border-blue-200 bg-sky-50 p-2.5">
                                <p className="text-xs font-extrabold text-sky-800 uppercase">{c.provisional ? "Employee’s finish (already applied)" : s ? "Employee asks for" : "Employee says they worked"}</p>
                                <p>
                                  {c.proposed.start}–{c.proposed.finish} · {c.proposed.breakMinutes} min break
                                </p>
                                <p className="text-ink-600">{jobLabel(c.proposed.jobId, c.proposed.activity)}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-start gap-2">
                          {c ? (
                            <>
                              <ActionButton url={`/api/office/corrections/${c.id}`} body={{ decision: "approve" }} tone="dark" success="Applied and recorded in the history.">
                                {c.provisional ? "Confirm" : "Approve change"}
                              </ActionButton>
                              <ReasonAction
                                url={`/api/office/corrections/${c.id}`}
                                body={{ decision: "reject" }}
                                field="note"
                                label="Reject"
                                reasonLabel="Tell the employee why"
                              />
                              {s && (
                                <Link href={`/office/records/${s.id}`} className="inline-flex min-h-10 items-center px-2 text-sm font-extrabold text-signal-700">
                                  Edit instead
                                </Link>
                              )}
                            </>
                          ) : e ? (
                            <ReasonAction
                              url={`/api/office/events/${e.id}`}
                              body={{}}
                              label="Mark reviewed"
                              reasonLabel="What did you decide?"
                              placeholder="e.g. Checked with Jordan, finish time corrected on the record"
                            />
                          ) : (
                            <Link href={i.href} className="inline-flex min-h-10 items-center rounded-lg bg-ink-900 px-4 text-sm font-extrabold text-white hover:bg-ink-800">
                              {i.action}
                            </Link>
                          )}
                        </div>
                      </div>
                      {e && (
                        <p className="mt-1 text-xs text-ink-500">
                          Tapped {formatWhen(e.occurredAt)}, received {formatWhen(e.receivedAt)}. Nothing was changed automatically.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card title="Warning settings" className="mt-8" aside="Company defaults for this demo">
        <SettingsForm longSessionHours={store.settings.longSessionHours} noStartGraceMinutes={store.settings.noStartGraceMinutes} />
      </Card>
    </>
  );
}
