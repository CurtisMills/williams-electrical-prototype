import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, Download, FileText, MapPin, MessageSquare, Phone, UserRound } from "lucide-react";
import { Card, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { getJob } from "@/lib/db";
import { formatDate, formatDateTime, formatPrice, statusMeta } from "@/lib/format";

export const dynamic = "force-dynamic";

const progressSteps = ["Requested", "Quoted", "Booked", "On site", "Done"];

export default async function JobDetailPage(props: PageProps<"/customer/jobs/[id]">) {
  const { id } = await props.params;
  const job = await getJob(id);
  if (!job) notFound();

  const currentStep = statusMeta[job.status].step;

  return (
    <div>
      <PageHeader title={job.title} subtitle={`Ref ${job.reference}`} backHref="/customer/jobs" />

      <div className="space-y-5 p-5">
        <Card>
          <div className="flex items-center justify-between">
            <StatusBadge status={job.status} />
            <span className="text-lg font-bold text-brand-900">
              {job.quoteAmount ? formatPrice(job.quoteAmount) : "Awaiting quote"}
            </span>
          </div>
          <ol className="mt-5 flex items-center">
            {progressSteps.map((label, i) => (
              <li key={label} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <div className={`h-0.5 flex-1 ${i === 0 ? "invisible" : i <= currentStep ? "bg-brand-600" : "bg-slate-200"}`} />
                  <div
                    className={`h-3 w-3 shrink-0 rounded-full ${
                      i <= currentStep ? "bg-brand-600" : "bg-slate-200"
                    } ${i === currentStep ? "ring-4 ring-brand-100" : ""}`}
                  />
                  <div
                    className={`h-0.5 flex-1 ${
                      i === progressSteps.length - 1 ? "invisible" : i < currentStep ? "bg-brand-600" : "bg-slate-200"
                    }`}
                  />
                </div>
                <span className={`mt-2 text-[10px] ${i <= currentStep ? "text-brand-900" : "text-slate-400"}`}>
                  {label}
                </span>
              </li>
            ))}
          </ol>

          {job.status === "quoted" && (
            <div className="mt-5 flex gap-2">
              <button className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white">
                Accept & book
              </button>
              <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
                Ask a question
              </button>
            </div>
          )}
        </Card>

        <Card className="space-y-3 text-sm">
          <Row icon={MapPin}>
            {job.address}, {job.postcode}
          </Row>
          <Row icon={CalendarDays}>
            {job.scheduledFor ? `${formatDate(job.scheduledFor)}, 8am–12pm arrival` : "Not yet scheduled"}
          </Row>
          <Row icon={FileText}>{job.description}</Row>
        </Card>

        {job.engineer && (
          <section>
            <SectionTitle>Your engineer</SectionTitle>
            <Card className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <UserRound className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-brand-900">{job.engineer.name}</p>
                <p className="text-xs text-slate-500">NICEIC Approved Electrician</p>
              </div>
              <a
                href={`tel:${job.engineer.phone.replace(/\s/g, "")}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                aria-label="Call engineer"
              >
                <Phone className="h-5 w-5" />
              </a>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                aria-label="Message engineer"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </Card>
          </section>
        )}

        {job.documents.length > 0 && (
          <section>
            <SectionTitle>Documents</SectionTitle>
            <Card className="divide-y divide-slate-100 p-0">
              {job.documents.map((doc) => (
                <div key={doc.name} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{doc.kind}</p>
                  </div>
                  <Download className="h-4 w-4 text-brand-600" />
                </div>
              ))}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>Activity</SectionTitle>
          <ol className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-5">
            {[...job.timeline].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative">
                <span
                  className={`absolute top-1 -left-[27px] h-3 w-3 rounded-full ring-4 ring-slate-50 ${
                    i === 0 ? "bg-spark-400" : "bg-slate-300"
                  }`}
                />
                <p className="text-sm font-medium text-slate-800">{e.label}</p>
                <p className="text-xs text-slate-500">{formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p className="text-slate-700">{children}</p>
    </div>
  );
}
