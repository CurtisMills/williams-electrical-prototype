import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, td, th } from "@/components/office/kit";
import { Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { formatDayKey, formatDuration } from "@/lib/field/dates";
import { netMinutes } from "@/lib/we/calc";
import { jobStatusLabel } from "@/lib/we/planning";
import { readStore } from "@/lib/we/store";
import { JobForm, JobStatusControl, SiteForm } from "./JobForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs and sites" };

const tone = { confirmed: "green", tentative: "amber", completed: "blue", cancelled: "grey", archived: "grey" } as const;

export default async function JobsPage() {
  await requireRole("office");
  const store = await readStore();
  const order = ["confirmed", "tentative", "completed", "cancelled", "archived"];
  const jobs = [...store.jobs].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.ref.localeCompare(b.ref));
  const recorded = (jobId: string) => store.sessions.filter((s) => s.jobId === jobId && !s.voided && s.finishedAt).reduce((n, s) => n + netMinutes(s), 0);
  const customers = store.customers.map((c) => ({ id: c.id, name: c.name }));
  const sites = store.sites.map((s) => ({ id: s.id, name: s.name, customerId: s.customerId }));

  return (
    <>
      <PageHeader overline="Office" title="Jobs and sites">
        Tentative jobs appear only in the planning preview. Cancelled and archived jobs keep their history but can’t take new time or assignments.
      </PageHeader>

      <Card title={`Jobs (${jobs.length})`}>
        <div className="-mx-5 -my-5 relative overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-line bg-subtle">
              <tr>
                <th className={th}>Job</th>
                <th className={th}>Customer · site</th>
                <th className={th}>Dates</th>
                <th className={th}>Hours</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Links</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.map((j) => {
                const site = store.sites.find((s) => s.id === j.siteId);
                return (
                  <tr key={j.id}>
                    <td className={td}>
                      <span className="text-xs font-bold text-muted tabular-nums">{j.ref}</span>
                      <span className="block font-bold">{j.title}</span>
                      <span className="text-xs text-muted">{j.type}</span>
                    </td>
                    <td className={td}>
                      {store.customers.find((c) => c.id === j.customerId)?.name}
                      <span className="block text-xs text-muted">{site?.name}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatDayKey(j.startDate, "dm")} – {formatDayKey(j.endDate, "dm")}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <span className="tabular-nums">{formatDuration(recorded(j.id))}</span>
                      <span className="block text-xs text-muted">of {j.plannedHours}h planned</span>
                    </td>
                    <td className={td}>
                      <Pill tone={tone[j.status]}>{jobStatusLabel[j.status]}</Pill>
                      <div className="mt-1.5">
                        <JobStatusControl jobId={j.id} status={j.status} />
                      </div>
                    </td>
                    <td className={td}>
                      <span className="flex flex-col">
                        <Link href={`/office/planning/jobs/${j.id}`} className="inline-flex min-h-12 items-center font-bold text-primary hover:underline">
                          Staffing
                        </Link>
                        <Link href={`/office/history?job=${j.id}&from=${j.startDate}`} className="inline-flex min-h-12 items-center text-label font-bold text-primary hover:underline">
                          Work history
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="New job">
          <JobForm customers={customers} sites={sites} />
        </Card>
        <Card title="New site">
          <SiteForm customers={customers} />
        </Card>
      </div>

      <Card title={`Sites (${store.sites.length})`} className="mt-6" aside="Access notes are shown to employees on their job cards">
        <ul className="grid gap-3 md:grid-cols-2">
          {store.sites.map((s) => (
            <li key={s.id} className="rounded-card border border-line p-4 text-sm">
              <p className="font-bold">
                {s.name} <span className="font-normal text-muted">· {store.customers.find((c) => c.id === s.customerId)?.name}</span>
              </p>
              <p className="text-muted">{s.address}</p>
              {s.contactName && (
                <p className="text-muted">
                  Contact: {s.contactName} {s.contactPhone}
                </p>
              )}
              {s.access && <p className="mt-2 rounded-control bg-subtle p-2 text-ink">Access: {s.access}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
