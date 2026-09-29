export type ServiceCategory = "domestic" | "commercial" | "emergency";

export interface Service {
  slug: string;
  name: string;
  summary: string;
  category: ServiceCategory;
  fromPrice: number | null;
  duration: string;
}

export type JobStatus =
  | "quote_requested"
  | "quoted"
  | "booked"
  | "in_progress"
  | "completed";

export interface JobEvent {
  at: string;
  label: string;
}

export interface Job {
  id: string;
  reference: string;
  serviceSlug: string;
  title: string;
  description: string;
  address: string;
  postcode: string;
  status: JobStatus;
  createdAt: string;
  scheduledFor: string | null;
  engineer: { name: string; phone: string } | null;
  quoteAmount: number | null;
  documents: { name: string; kind: "certificate" | "invoice" | "quote" }[];
  timeline: JobEvent[];
}

export interface QuoteRequestInput {
  serviceSlug: string;
  description: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  preferredDate?: string;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
  properties: { label: string; address: string; postcode: string }[];
}
