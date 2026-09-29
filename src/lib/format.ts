import type { JobStatus } from "./types";

export const formatPrice = (amount: number | null) =>
  amount == null ? "POA" : `£${amount.toLocaleString("en-GB")}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const statusMeta: Record<JobStatus, { label: string; className: string; step: number }> = {
  quote_requested: { label: "Quote requested", className: "bg-slate-100 text-slate-700", step: 0 },
  quoted: { label: "Quote ready", className: "bg-amber-100 text-amber-800", step: 1 },
  booked: { label: "Booked", className: "bg-blue-100 text-blue-800", step: 2 },
  in_progress: { label: "In progress", className: "bg-violet-100 text-violet-800", step: 3 },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800", step: 4 },
};
