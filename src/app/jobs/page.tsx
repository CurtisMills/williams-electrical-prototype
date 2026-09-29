import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { ServiceIcon } from "@/components/ServiceIcon";
import { listJobs } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await listJobs();
  const active = jobs.filter((j) => j.status !== "completed");
  const past = jobs.filter((j) => j.status === "completed");

  return (
    <div>
      <PageHeader title="My jobs" subtitle="Quotes, bookings and past work in one place" />
      <div className="space-y-6 p-5">
        <JobGroup title="Active" jobs={active} empty="No active jobs. Request a quote to get started." />
        <JobGroup title="Completed" jobs={past} empty="Nothing here yet." />
      </div>
    </div>
  );
}

function JobGroup({
  title,
  jobs,
  empty,
}: {
  title: string;
  jobs: Awaited<ReturnType<typeof listJobs>>;
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {title} ({jobs.length})
      </h2>
      {jobs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="block">
              <Card className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <ServiceIcon slug={job.serviceSlug} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-brand-900">{job.title}</p>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{job.reference}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <MapPin className="h-3 w-3" /> {job.address}, {job.postcode}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge status={job.status} />
                    <span className="text-xs text-slate-500">
                      {job.scheduledFor
                        ? formatDate(job.scheduledFor)
                        : job.quoteAmount
                          ? formatPrice(job.quoteAmount)
                          : `Sent ${formatDate(job.createdAt)}`}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
