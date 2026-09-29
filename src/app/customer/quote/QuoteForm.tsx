"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";
import type { Customer, Job, QuoteRequestInput, Service } from "@/lib/types";

const steps = ["The job", "Where", "Your details"] as const;

const stepFields: (keyof QuoteRequestInput)[][] = [
  ["serviceSlug", "description"],
  ["address", "postcode", "preferredDate"],
  ["name", "phone", "email"],
];

export function QuoteForm({
  services,
  initialService,
  customer,
}: {
  services: Service[];
  initialService: string;
  customer: Customer;
}) {
  const router = useRouter();
  const home = customer.properties[0];
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Job | null>(null);
  const [form, setForm] = useState<QuoteRequestInput>({
    serviceSlug: services.some((s) => s.slug === initialService) ? initialService : "",
    description: "",
    address: home?.address ?? "",
    postcode: home?.postcode ?? "",
    preferredDate: "",
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
  });

  const set = (key: keyof QuoteRequestInput, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.serviceSlug) e.serviceSlug = "Choose a service";
      if (form.description.trim().length < 10) e.description = "Tell us a little more (10+ characters)";
    }
    if (step === 1) {
      if (!form.address.trim()) e.address = "Address is required";
      if (!form.postcode.trim()) e.postcode = "Postcode is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const serverErrors: Record<string, string> = data.errors ?? {};
        setErrors(serverErrors);
        const firstBadStep = stepFields.findIndex((fields) => fields.some((f) => serverErrors[f]));
        if (firstBadStep >= 0) setStep(firstBadStep);
        return;
      }
      setCreated(data as Job);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < steps.length - 1) setStep(step + 1);
    else void submit();
  };

  if (created) {
    return (
      <div className="flex flex-col items-center px-6 pt-12 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold text-brand-900">Request sent!</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your reference is <span className="font-mono font-semibold">{created.reference}</span>. We&apos;ll
          review the details and send your quote within 24 hours.
        </p>
        <Link
          href={`/customer/jobs/${created.id}`}
          className="mt-8 w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white"
        >
          Track this request
        </Link>
        <Link href="/customer" className="mt-3 w-full py-3 text-sm font-medium text-brand-600">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="p-5">
      <ol className="mb-6 flex gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-spark-400" : "bg-slate-200"}`} />
            <p className={`mt-1.5 text-[11px] font-medium ${i === step ? "text-brand-900" : "text-slate-400"}`}>
              {label}
            </p>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-5">
          <Field label="What do you need?" error={errors.serviceSlug}>
            <div className="grid grid-cols-2 gap-2">
              {services.map((s) => (
                <button
                  type="button"
                  key={s.slug}
                  onClick={() => set("serviceSlug", s.slug)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-medium ${
                    form.serviceSlug === s.slug
                      ? "border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-600"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <ServiceIcon slug={s.slug} className="h-4 w-4 shrink-0 text-brand-600" />
                  {s.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Describe the job" error={errors.description}>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Kitchen sockets keep tripping when the kettle is on…"
              className={inputClass}
            />
          </Field>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm text-slate-500"
          >
            <Camera className="h-5 w-5" /> Add photos (optional)
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          {customer.properties.length > 0 && (
            <Field label="Saved properties">
              <div className="flex gap-2">
                {customer.properties.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => {
                      set("address", p.address);
                      set("postcode", p.postcode);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      form.postcode === p.postcode
                        ? "border-brand-600 bg-brand-50 text-brand-900"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Address" error={errors.address}>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Postcode" error={errors.postcode}>
            <input
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value)}
              className={`${inputClass} uppercase`}
            />
          </Field>
          <Field label="Preferred date (optional)">
            <input
              type="date"
              value={form.preferredDate}
              onChange={(e) => set("preferredDate", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field label="Full name" error={errors.name}>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-xl border border-slate-300 px-5 py-3.5 font-semibold text-slate-700"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {step < steps.length - 1 ? "Continue" : "Send request"}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}
