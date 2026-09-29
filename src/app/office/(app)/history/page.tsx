import type { Metadata } from "next";
import Link from "next/link";
import { Card, Empty, PageHeader, btn, inputCls, labelCls, td, th } from "@/components/office/kit";
import { Pill, TimesheetPill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, dateKeyOf, formatClock, formatDayKey, formatDuration, isDateKey, todayKey } from "@/lib/field/dates";
import { readStore } from "@/lib/we/store";
import { history, selectableJobs } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";
import { OfficeTimesForm } from "../records/OfficeTimesForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Work history" };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export default async function HistoryPage(props: PageProps<"/office/history">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const today = todayKey();
  const from = isDateKey(sp.from) ? sp.from : addDays(today, -13);
  const to = isDateKey(sp.to) ? sp.to : today;
  const filter = { employeeId: str(sp.employee), customerId: str(sp.customer), siteId: str(sp.site), jobId: str(sp.job), from, to, q: str(sp.q) };
  const store = await readStore();
  const rows = history(store, filter);
  const total = rows.reduce((n, r) => n + (r.netMinutes ?? 0), 0);
  const jobs = selectableJobs(store);

  return (
    <>
      <PageHeader overline="OFFICE" title="Work history">
        Every recorded session. Filter by person, customer, site, job or date, or search any text. Open a record to correct it; the original is always kept.
      </PageHeader>

      <form className="mb-5 grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <label className={labelCls}>
          Employee
          <select name="employee" defaultValue={filter.employeeId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">Everyone</option>
            {store.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Customer
          <select name="customer" defaultValue={filter.customerId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">All customers</option>
            {store.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Site
          <select name="site" defaultValue={filter.siteId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">All sites</option>
            {store.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Job
          <select name="job" defaultValue={filter.jobId ?? ""} className={`${inputCls} mt-1`}>
            <option value="">All jobs</option>
            {store.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.ref} · {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          From
          <input type="date" name="from" defaultValue={from} className={`${inputCls} mt-1`} />
        </label>
        <label className={labelCls}>
          To
          <input type="date" name="to" defaultValue={to} className={`${inputCls} mt-1`} />
        </label>
        <label className={labelCls}>
          Search
          <input name="q" defaultValue={filter.q ?? ""} placeholder="Name, job, postcode, note…" className={`${inputCls} mt-1`} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={btn.dark}>
            Show records
          </button>
          <Link href="/office/history" className={btn.ghost}>
            Clear
          </Link>
        </div>
      </form>

      <Card title={`${rows.length} records`} aside={`${formatDuration(total)} finished time · ${formatDayKey(from, "short")} to ${formatDayKey(to, "short")}`}>
        {rows.length === 0 ? (
          <Empty>No records match these filters.</Empty>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Employee</th>
                  <th className={th}>Job / activity</th>
                  <th className={th}>Customer · site</th>
                  <th className={th}>Times</th>
                  <th className={th}>Break</th>
                  <th className={th}>Hours</th>
                  <th className={th}>Timesheet</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((r) => {
                  const s = r.session;
                  return (
                    <tr key={s.id} className={s.voided ? "text-ink-400 line-through" : undefined}>
                      <td className={`${td} whitespace-nowrap`}>{formatDayKey(dateKeyOf(s.startedAt), "short")}</td>
                      <td className={td}>{r.employee.name}</td>
                      <td className={td}>
                        {r.job ? (
                          <>
                            <span className="font-mono text-xs font-bold">{r.job.ref}</span> {r.job.title}
                          </>
                        ) : (
                          <span className={s.activity === "unassigned" ? "font-bold text-signal-700" : undefined}>
                            {activityLabel[s.activity]}
                            {s.note && `: ${s.note}`}
                          </span>
                        )}
                      </td>
                      <td className={td}>{r.customer ? `${r.customer.name} · ${r.site?.name}` : "–"}</td>
                      <td className={`${td} font-mono whitespace-nowrap`}>
                        {formatClock(s.startedAt)}–{s.finishedAt ? formatClock(s.finishedAt) : <span className="font-sans font-bold text-signal-700">no finish</span>}
                        {s.finishedAt && dateKeyOf(s.finishedAt) !== dateKeyOf(s.startedAt) && <span className="block font-sans text-xs text-ink-500">next day</span>}
                      </td>
                      <td className={`${td} font-mono`}>{r.breakMinutes ? `${Math.round(r.breakMinutes)}m` : "–"}</td>
                      <td className={`${td} font-mono font-bold`}>{r.netMinutes !== null ? formatDuration(r.netMinutes) : "–"}</td>
                      <td className={td}>
                        <span className="flex flex-wrap gap-1">
                          <TimesheetPill status={r.timesheet} />
                          {s.edited && <Pill tone="grey">Corrected</Pill>}
                          {s.source === "phone_offline" && <Pill tone="grey">Sent later</Pill>}
                          {s.source === "office" && <Pill tone="grey">Office entry</Pill>}
                          {s.voided && <Pill tone="red">Removed</Pill>}
                        </span>
                      </td>
                      <td className={td}>
                        <Link href={`/office/records/${s.id}`} className="font-extrabold text-signal-700 hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Add a missing record" className="mt-6" aside="For time nobody recorded on a phone">
        <OfficeTimesForm mode="create" jobs={jobs} employees={store.employees.map((e) => ({ id: e.id, name: e.name }))} initial={{ date: today }} />
      </Card>
    </>
  );
}
