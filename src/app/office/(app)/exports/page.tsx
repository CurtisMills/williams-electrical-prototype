import type { Metadata } from "next";
import { Card, PageHeader, btn, inputCls, labelCls, td, th } from "@/components/office/kit";
import { Pill } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { addDays, formatDuration, formatWhen, isDateKey, todayKey, weekStartOf } from "@/lib/field/dates";
import { readStore } from "@/lib/we/store";
import { collectHours } from "@/lib/we/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Exports" };

const kindLabel = { employee_csv: "Employee hours CSV", customer_csv: "Customer hours CSV", customer_summary: "Printed customer summary" } as const;

export default async function ExportsPage(props: PageProps<"/office/exports">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const week = weekStartOf(isDateKey(sp.week) ? sp.week : addDays(todayKey(), -7));
  const store = await readStore();
  const final = collectHours(store, { from: week, to: addDays(week, 6), approval: "approved" });
  const draft = collectHours(store, { from: week, to: addDays(week, 6), approval: "all" });
  const unapproved = store.employees.filter((e) => {
    const t = store.timesheets.find((x) => x.employeeId === e.id && x.weekStart === week);
    return (draft.byEmployee.get(e.id)?.minutes ?? 0) > 0 && t?.status !== "approved";
  });
  const names = new Map([["office-megan", "Megan Lloyd"], ["office-gareth", "Gareth Williams"]]);
  const log = [...store.exports].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, 30);

  return (
    <>
      <PageHeader overline="OFFICE" title="Exports">
        Final exports include approved timesheets only, so payroll and invoices match what was signed off. Use a draft preview to check figures before approval. Every file is logged; if a
        correction later changes an approved week, its earlier exports are marked superseded.
      </PageHeader>

      <Card title="Download">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelCls}>
            From
            <input type="date" name="from" defaultValue={week} className={`${inputCls} mt-1`} required />
          </label>
          <label className={labelCls}>
            To
            <input type="date" name="to" defaultValue={addDays(week, 6)} className={`${inputCls} mt-1`} required />
          </label>
          <label className={labelCls}>
            Employee
            <select name="employee" className={`${inputCls} mt-1`}>
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
            <select name="customer" className={`${inputCls} mt-1`}>
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
            <select name="site" className={`${inputCls} mt-1`}>
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
            <select name="job" className={`${inputCls} mt-1`}>
              <option value="">All jobs</option>
              {store.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.ref} · {j.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className={labelCls}>Records</legend>
            <label className="mt-1 mr-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold">
              <input type="radio" name="mode" value="final" defaultChecked className="h-4 w-4" /> Final (approved only)
            </label>
            <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold">
              <input type="radio" name="mode" value="draft" className="h-4 w-4" /> Draft preview (includes unapproved)
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" formAction="/api/office/exports/employee" className={btn.dark}>
              Download employee CSV
            </button>
            <button type="submit" formAction="/api/office/exports/customer" className={btn.dark}>
              Download customer CSV
            </button>
            <button type="submit" formAction="/office/print/customer-summary" formTarget="_blank" className={btn.outline}>
              Printable customer summary
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm text-ink-600">
          Week of {week}: <strong>{formatDuration(final.totalMinutes)}</strong> approved of {formatDuration(draft.totalMinutes)} recorded.
          {unapproved.length > 0 && <> Not yet approved: {unapproved.map((e) => e.name).join(", ")}.</>}
          {draft.open.length > 0 && <> {draft.open.length} open record(s) are excluded until finished.</>}
        </p>
      </Card>

      <Card title="Export log" className="mt-6">
        {log.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing exported yet.</p>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60">
                <tr>
                  <th className={th}>Reference</th>
                  <th className={th}>Type</th>
                  <th className={th}>Range</th>
                  <th className={th}>Total</th>
                  <th className={th}>Generated</th>
                  <th className={th}>State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {log.map((x) => (
                  <tr key={x.id} className={x.supersededAt ? "bg-amber-50/60" : undefined}>
                    <td className={`${td} font-mono font-bold`}>{x.id}</td>
                    <td className={td}>
                      {kindLabel[x.kind]}
                      {Object.keys(x.filters).length > 0 && <span className="block text-xs text-ink-500">Filtered: {Object.keys(x.filters).join(", ")}</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {x.from} to {x.to}
                    </td>
                    <td className={`${td} font-mono`}>{formatDuration(x.totalMinutes)}</td>
                    <td className={td}>
                      {formatWhen(x.generatedAt)}
                      <span className="block text-xs text-ink-500">{names.get(x.generatedBy) ?? x.generatedBy}</span>
                    </td>
                    <td className={td}>
                      {x.mode === "draft" ? (
                        <Pill tone="grey">Draft preview</Pill>
                      ) : x.supersededAt ? (
                        <>
                          <Pill tone="amber">Superseded</Pill>
                          <span className="block text-xs text-amber-900">{x.supersededReason}</span>
                        </>
                      ) : (
                        <Pill tone="green">Current</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
