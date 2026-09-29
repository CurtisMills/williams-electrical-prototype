import Link from "next/link";
import { Clock } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { ServiceIcon } from "@/components/ServiceIcon";
import { listServices } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import type { ServiceCategory } from "@/lib/types";

const groups: { category: ServiceCategory; title: string }[] = [
  { category: "emergency", title: "Emergency" },
  { category: "domestic", title: "Home" },
  { category: "commercial", title: "Business" },
];

export default async function ServicesPage() {
  const services = await listServices();

  return (
    <div>
      <PageHeader title="Our services" subtitle="Transparent pricing. All work certified." />
      <div className="space-y-6 p-5">
        {groups.map(({ category, title }) => (
          <section key={category}>
            <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h2>
            <div className="space-y-3">
              {services
                .filter((s) => s.category === category)
                .map((s) => (
                  <Card key={s.slug} className="flex gap-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        category === "emergency" ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
                      }`}
                    >
                      <ServiceIcon slug={s.slug} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-brand-900">{s.name}</p>
                        <p className="shrink-0 text-sm font-semibold text-brand-600">
                          {s.fromPrice ? `from ${formatPrice(s.fromPrice)}` : "POA"}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{s.summary}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" /> {s.duration}
                        </span>
                        <Link
                          href={`/quote?service=${s.slug}`}
                          className="rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white"
                        >
                          {category === "emergency" ? "Request now" : "Get quote"}
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
