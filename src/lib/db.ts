import "server-only";
import type { Customer, Job, QuoteRequestInput, Service } from "./types";

// In-memory store for the prototype. Swap for a real database (e.g. Postgres + Prisma)
// without changing the function signatures below.

const services: Service[] = [
  {
    slug: "emergency-callout",
    name: "24/7 Emergency Call-out",
    summary: "Power loss, burning smells, tripping circuits. An engineer with you fast.",
    category: "emergency",
    fromPrice: 95,
    duration: "Within 2 hours",
  },
  {
    slug: "eicr",
    name: "EICR / Safety Inspection",
    summary: "Electrical Installation Condition Reports for homeowners and landlords.",
    category: "domestic",
    fromPrice: 140,
    duration: "2–4 hours",
  },
  {
    slug: "consumer-unit",
    name: "Consumer Unit Upgrade",
    summary: "Replace an old fuse box with a modern, RCD-protected consumer unit.",
    category: "domestic",
    fromPrice: 450,
    duration: "1 day",
  },
  {
    slug: "ev-charger",
    name: "EV Charger Installation",
    summary: "OZEV-approved home charge point supply, fit and certification.",
    category: "domestic",
    fromPrice: 799,
    duration: "Half day",
  },
  {
    slug: "rewire",
    name: "Full / Partial Rewire",
    summary: "Complete or partial rewiring for renovations and older properties.",
    category: "domestic",
    fromPrice: null,
    duration: "3–7 days",
  },
  {
    slug: "lighting",
    name: "Lighting & Sockets",
    summary: "New sockets, downlights, outdoor lighting and smart switches.",
    category: "domestic",
    fromPrice: 65,
    duration: "1–4 hours",
  },
  {
    slug: "commercial-maintenance",
    name: "Commercial Maintenance",
    summary: "Planned maintenance, PAT testing and emergency lighting for businesses.",
    category: "commercial",
    fromPrice: null,
    duration: "Contract",
  },
];

const daysFromNow = (d: number, hour = 9) => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

function seedJobs(): Job[] {
  return [
    {
      id: "j1",
      reference: "WE-10482",
      serviceSlug: "ev-charger",
      title: "EV Charger Installation",
      description: "7kW charger on the front of the house, near the driveway.",
      address: "14 Oak Lane",
      postcode: "CF10 1AB",
      status: "booked",
      createdAt: daysFromNow(-6),
      scheduledFor: daysFromNow(3, 8),
      engineer: { name: "Dan Williams", phone: "07700 900123" },
      quoteAmount: 899,
      documents: [{ name: "Quote WE-10482.pdf", kind: "quote" }],
      timeline: [
        { at: daysFromNow(-6), label: "Quote requested" },
        { at: daysFromNow(-5), label: "Survey photos reviewed" },
        { at: daysFromNow(-4), label: "Quote sent: £899" },
        { at: daysFromNow(-3), label: "Quote accepted & booked" },
      ],
    },
    {
      id: "j2",
      reference: "WE-10311",
      serviceSlug: "eicr",
      title: "EICR / Safety Inspection",
      description: "Landlord EICR for rental flat.",
      address: "Flat 2, 88 High Street",
      postcode: "CF24 3DG",
      status: "completed",
      createdAt: daysFromNow(-40),
      scheduledFor: daysFromNow(-32, 10),
      engineer: { name: "Rhys Morgan", phone: "07700 900456" },
      quoteAmount: 160,
      documents: [
        { name: "EICR Certificate.pdf", kind: "certificate" },
        { name: "Invoice INV-2291.pdf", kind: "invoice" },
      ],
      timeline: [
        { at: daysFromNow(-40), label: "Booking requested" },
        { at: daysFromNow(-39), label: "Booked" },
        { at: daysFromNow(-32, 10), label: "Engineer on site" },
        { at: daysFromNow(-32, 13), label: "Inspection complete: Satisfactory" },
        { at: daysFromNow(-31), label: "Certificate & invoice issued" },
      ],
    },
    {
      id: "j3",
      reference: "WE-10497",
      serviceSlug: "lighting",
      title: "Lighting & Sockets",
      description: "Replace 6 kitchen spotlights with LED downlights.",
      address: "14 Oak Lane",
      postcode: "CF10 1AB",
      status: "quoted",
      createdAt: daysFromNow(-2),
      scheduledFor: null,
      engineer: null,
      quoteAmount: 285,
      documents: [{ name: "Quote WE-10497.pdf", kind: "quote" }],
      timeline: [
        { at: daysFromNow(-2), label: "Quote requested" },
        { at: daysFromNow(-1), label: "Quote sent: £285" },
      ],
    },
  ];
}

const customer: Customer = {
  name: "Sarah Jones",
  email: "sarah.jones@example.com",
  phone: "07700 900789",
  properties: [
    { label: "Home", address: "14 Oak Lane", postcode: "CF10 1AB" },
    { label: "Rental flat", address: "Flat 2, 88 High Street", postcode: "CF24 3DG" },
  ],
};

// Persist across hot reloads in dev.
const globalStore = globalThis as unknown as { __weJobs?: Job[] };
const jobs: Job[] = (globalStore.__weJobs ??= seedJobs());

export async function listServices(): Promise<Service[]> {
  return services;
}

export async function getService(slug: string): Promise<Service | undefined> {
  return services.find((s) => s.slug === slug);
}

export async function listJobs(): Promise<Job[]> {
  return [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJob(id: string): Promise<Job | undefined> {
  return jobs.find((j) => j.id === id);
}

export async function getCustomer(): Promise<Customer> {
  return customer;
}

export async function createQuoteRequest(input: QuoteRequestInput): Promise<Job> {
  const service = await getService(input.serviceSlug);
  const now = new Date().toISOString();
  const job: Job = {
    id: `j${Date.now()}`,
    reference: `WE-${10500 + jobs.length}`,
    serviceSlug: input.serviceSlug,
    title: service?.name ?? "General enquiry",
    description: input.description,
    address: input.address,
    postcode: input.postcode.toUpperCase(),
    status: "quote_requested",
    createdAt: now,
    scheduledFor: null,
    engineer: null,
    quoteAmount: null,
    documents: [],
    timeline: [
      {
        at: now,
        label: input.preferredDate
          ? `Quote requested (preferred date ${input.preferredDate})`
          : "Quote requested",
      },
    ],
  };
  jobs.push(job);
  return job;
}

export function validateQuoteRequest(
  body: unknown,
): { ok: true; data: QuoteRequestInput } | { ok: false; errors: Record<string, string> } {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const errors: Record<string, string> = {};

  const data: QuoteRequestInput = {
    serviceSlug: str("serviceSlug"),
    description: str("description"),
    name: str("name"),
    phone: str("phone"),
    email: str("email"),
    address: str("address"),
    postcode: str("postcode"),
    preferredDate: str("preferredDate") || undefined,
  };

  if (!services.some((s) => s.slug === data.serviceSlug)) errors.serviceSlug = "Choose a service";
  if (data.description.length < 10) errors.description = "Tell us a little more (10+ characters)";
  if (!data.name) errors.name = "Name is required";
  if (!/^[0-9 +()-]{10,}$/.test(data.phone)) errors.phone = "Enter a valid phone number";
  if (!/^\S+@\S+\.\S+$/.test(data.email)) errors.email = "Enter a valid email";
  if (!data.address) errors.address = "Address is required";
  if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(data.postcode))
    errors.postcode = "Enter a valid UK postcode";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
