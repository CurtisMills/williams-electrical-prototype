import type { Metadata } from "next";
import { FieldBrand } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { decimalHours, formatDayKey, formatDuration } from "@/lib/field/dates";
import { customerSummary, parseHoursFilter } from "@/lib/we/exports";
import { readStore } from "@/lib/we/store";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer hours summary" };

// Outside the office layout on purpose: no navigation, no auto-refresh, prints cleanly.
export default async function CustomerSummaryPage(props: PageProps<"/office/print/customer-summary">) {
  await requireRole("office");
  const sp = await props.searchParams;
  const params = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
  const filter = parseHoursFilter(params);
  const store = await readStore();
  const summary = customerSummary(store, filter);
  const byCustomer = new Map<string, typeof summary.lines>();
  for (const l of summary.lines) byCustomer.set(l.customer, [...(byCustomer.get(l.customer) ?? []), l]);
  const draft = filter.approval === "all";

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-ink-950 print:p-0">
      <div className="mb-6 flex items-start justify-between gap-6 border-b-4 border-signal-600 pb-4">
        <div className="rounded-lg bg-ink-900 p-3">
          <FieldBrand className="h-16 w-auto" />
        </div>
        <div className="text-right text-sm">
          <p className="text-lg font-extrabold">Hours summary</p>
          <p>
            {formatDayKey(filter.from, "long")} to {formatDayKey(filter.to, "long")}
          </p>
          <p className="text-ink-500">Demo data · fictional prototype records</p>
        </div>
      </div>

      {draft && (
        <p className="mb-4 rounded border-2 border-amber-500 bg-amber-50 p-3 text-sm font-bold text-amber-950">
          DRAFT PREVIEW: includes hours not yet approved. Not for invoicing.
        </p>
      )}

      {summary.lines.length === 0 ? (
        <p className="text-sm text-ink-600">No {draft ? "" : "approved "}job hours in this period.</p>
      ) : (
        [...byCustomer.entries()].map(([customer, lines]) => (
          <section key={customer} className="mb-8 break-inside-avoid">
            <h2 className="mb-2 text-xl font-extrabold">{customer}</h2>
            <table className="w-full text-sm">
              <thead className="border-b-2 border-ink-900 text-left">
                <tr>
                  <th className="py-1.5">Date</th>
                  <th className="py-1.5">Site</th>
                  <th className="py-1.5">Job</th>
                  <th className="py-1.5 text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {lines.map((l) => (
                  <tr key={`${l.jobRef}-${l.date}`}>
                    <td className="py-1.5 whitespace-nowrap">{formatDayKey(l.date, "short")}</td>
                    <td className="py-1.5">{l.site}</td>
                    <td className="py-1.5">
                      {l.jobRef} · {l.jobTitle}
                    </td>
                    <td className="py-1.5 text-right font-mono">{decimalHours(l.minutes)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-ink-900 font-extrabold">
                <tr>
                  <td className="py-1.5" colSpan={3}>
                    Total for {customer}
                  </td>
                  <td className="py-1.5 text-right font-mono">{decimalHours(lines.reduce((n, l) => n + l.minutes, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        ))
      )}

      <p className="mt-6 border-t border-ink-100 pt-3 text-xs text-ink-500">
        Total {formatDuration(summary.totalMinutes)} ({decimalHours(summary.totalMinutes)} hours). Hours are net of breaks, in UK time, and sessions crossing midnight are counted on each date.
        {summary.openCount > 0 && ` ${summary.openCount} incomplete record(s) are not included.`} Williams Electrical (Cymru) Ltd.
      </p>

      <PrintButton filter={params} />
    </main>
  );
}
