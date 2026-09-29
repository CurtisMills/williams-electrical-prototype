import Link from "next/link";
import { CalendarClock, ChevronRight, FileText, Phone, ShieldCheck, Star } from "lucide-react";
import { Card, Logo, SectionTitle, StatusBadge } from "@/components/ui";
import { ServiceIcon } from "@/components/ServiceIcon";
import { listJobs, listServices } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [services, jobs] = await Promise.all([listServices(), listJobs()]);
  const nextJob = jobs
    .filter((j) => j.status === "booked" && j.scheduledFor)
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!))[0];
  const awaitingAction = jobs.filter((j) => j.status === "quoted").length;
  const popular = services.filter((s) => s.category !== "emergency").slice(0, 4);

  return (
    <div>
      <section className="bg-brand-900 px-5 pt-6 pb-16 text-white">
        <div className="flex items-center justify-between">
          <Logo light />
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-spark-300 uppercase">
            Prototype
          </span>
        </div>
        <h1 className="mt-6 text-2xl leading-tight font-bold">
          Hi Sarah,
          <br />
          how can we help today?
        </h1>
        <p className="mt-2 text-sm text-brand-100">
          NICEIC approved electricians, covering homes and businesses across South Wales.
        </p>
      </section>

      <div className="-mt-10 space-y-6 px-5">
        <a
          href="tel:08001234567"
          className="flex items-center gap-3 rounded-2xl bg-red-600 p-4 text-white shadow-lg active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
            <Phone className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Emergency? Call 24/7</p>
            <p className="text-xs text-red-100">Engineer with you in under 2 hours</p>
          </div>
          <ChevronRight className="h-5 w-5" />
        </a>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/customer/quote" className="rounded-2xl bg-spark-400 p-4 text-brand-900 shadow-sm">
            <FileText className="h-6 w-6" />
            <p className="mt-3 font-semibold">Get a quote</p>
            <p className="text-xs opacity-80">Free, within 24h</p>
          </Link>
          <Link href="/customer/jobs" className="rounded-2xl bg-white p-4 text-brand-900 shadow-sm ring-1 ring-slate-200">
            <CalendarClock className="h-6 w-6" />
            <p className="mt-3 font-semibold">Track a job</p>
            <p className="text-xs text-slate-500">
              {awaitingAction ? `${awaitingAction} quote awaiting you` : "Live status updates"}
            </p>
          </Link>
        </div>

        {nextJob && (
          <section>
            <SectionTitle>Upcoming visit</SectionTitle>
            <Link href={`/customer/jobs/${nextJob.id}`}>
              <Card className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <span className="text-[10px] font-semibold uppercase">
                    {new Date(nextJob.scheduledFor!).toLocaleDateString("en-GB", { month: "short" })}
                  </span>
                  <span className="text-xl leading-none font-bold">
                    {new Date(nextJob.scheduledFor!).getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-brand-900">{nextJob.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(nextJob.scheduledFor!)} · {nextJob.engineer?.name}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge status={nextJob.status} />
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Card>
            </Link>
          </section>
        )}

        <section>
          <SectionTitle
            action={
              <Link href="/customer/services" className="text-sm font-medium text-brand-600">
                See all
              </Link>
            }
          >
            Popular services
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {popular.map((s) => (
              <Link key={s.slug} href={`/customer/quote?service=${s.slug}`}>
                <Card className="h-full">
                  <ServiceIcon slug={s.slug} className="h-6 w-6 text-brand-600" />
                  <p className="mt-2 text-sm leading-snug font-semibold text-brand-900">{s.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {s.fromPrice ? `From ${formatPrice(s.fromPrice)}` : "Quote on survey"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-4">
          <Card className="flex items-center gap-4 bg-brand-50">
            <ShieldCheck className="h-10 w-10 shrink-0 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-brand-900">Fully certified & insured</p>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                <Star className="h-3.5 w-3.5 fill-spark-400 text-spark-400" /> 4.9 from 320+ reviews
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
