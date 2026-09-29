"use client";

import { useState } from "react";
import { Notice } from "@/components/field/ui";
import { Button } from "@/components/portal/button";
import { FieldError } from "@/components/portal/field";
import { btn, inputCls, labelCls } from "@/components/office/kit";
import { useAction } from "@/components/useAction";

type Customer = { id: string; name: string };
type Site = { id: string; name: string; customerId: string };

const NEXT: Record<string, { to: string; label: string }[]> = {
  tentative: [
    { to: "confirmed", label: "Confirm (won)" },
    { to: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { to: "completed", label: "Mark completed" },
    { to: "cancelled", label: "Cancel" },
  ],
  completed: [
    { to: "archived", label: "Archive" },
    { to: "confirmed", label: "Reopen" },
  ],
  cancelled: [{ to: "confirmed", label: "Reopen" }],
  archived: [{ to: "confirmed", label: "Reopen" }],
};

export function JobStatusControl({ jobId, status }: { jobId: string; status: string }) {
  const { run, busy, error } = useAction();
  const [reopening, setReopening] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const needsReason = status === "cancelled" || status === "archived";
  if (reopening) {
    return (
      <form
        className="flex max-w-xs flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("/api/office/jobs", { action: "status", jobId, status: reopening, reason })) setReopening(null);
        }}
      >
        <input required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reopening" aria-label="Reason for reopening" className={inputCls} />
        <span className="flex gap-2">
          <Button type="submit" size="md" busy={busy}>
            Reopen
          </Button>
          <Button variant="quiet" onClick={() => setReopening(null)}>
            Cancel
          </Button>
        </span>
        <span role="alert">{error && <FieldError>{error}</FieldError>}</span>
      </form>
    );
  }
  return (
    <span className="flex flex-wrap gap-2">
      {NEXT[status].map((n) => (
        <Button
          key={n.to}
          variant="secondary"
          size="sm"          busy={busy}
          onClick={() => {
            if (needsReason) return setReopening(n.to);
            if (n.to === "cancelled" && !window.confirm("Cancel this job? Nobody will be able to record time against it.")) return;
            void run("/api/office/jobs", { action: "status", jobId, status: n.to });
          }}
        >
          {n.label}
        </Button>
      ))}
      <span role="alert">{error && <FieldError>{error}</FieldError>}</span>
    </span>
  );
}

export function JobForm({ customers, sites }: { customers: Customer[]; sites: Site[] }) {
  const { run, busy, error, message } = useAction();
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Installation");
  const [status, setStatus] = useState("confirmed");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [plannedHours, setPlannedHours] = useState("");
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const job = await run<{ ref: string; id: string }>(
          "/api/office/jobs",
          { action: "create", customerId, siteId, title, type, status, startDate, endDate, plannedHours: Number(plannedHours) },
          { success: (d) => `${d.ref} created. Add its staffing requirements next.` },
        );
        if (job) setTitle("");
      }}
    >
      <label className={labelCls}>
        Customer
        <select required value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSiteId(""); }} className={inputCls}>
          <option value="" disabled>
            Choose…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Site
        <select required value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls} disabled={!customerId}>
          <option value="" disabled>
            Choose…
          </option>
          {sites.filter((s) => s.customerId === customerId).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        Title
        <input required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Kitchen rewire" />
      </label>
      <label className={labelCls}>
        Type
        <input value={type} onChange={(e) => setType(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="confirmed">Confirmed</option>
          <option value="tentative">Tentative (quote stage)</option>
        </select>
      </label>
      <label className={labelCls}>
        Start
        <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        End
        <input type="date" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        Planned hours
        <input type="number" min={0} value={plannedHours} onChange={(e) => setPlannedHours(e.target.value)} className={inputCls} />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={busy} className={`${btn.dark} w-full`}>
          Create job
        </button>
      </div>
      {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="sm:col-span-2"><Notice tone="success">{message}</Notice></div>}
    </form>
  );
}

export function SiteForm({ customers }: { customers: Customer[] }) {
  const { run, busy, error, message } = useAction();
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [access, setAccess] = useState("");
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("/api/office/jobs", { action: "site", customerId, customerName, name, address, contactName, contactPhone, access }, { success: "Site added." });
        if (ok) {
          setName("");
          setAddress("");
          setAccess("");
        }
      }}
    >
      <label className={labelCls}>
        Customer
        <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
          <option value="" disabled>
            Choose…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="new">+ New customer</option>
        </select>
      </label>
      {customerId === "new" ? (
        <label className={labelCls}>
          New customer name
          <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} />
        </label>
      ) : (
        <span />
      )}
      <label className={labelCls}>
        Site name
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        Address and postcode
        <input required value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        Site contact
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>
        Contact phone
        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        Access instructions
        <textarea rows={2} value={access} onChange={(e) => setAccess(e.target.value)} className={`${inputCls} py-2`} placeholder="Key safe code, parking, sign-in, PPE…" />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className={btn.dark}>
          Add site
        </button>
      </div>
      {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="sm:col-span-2"><Notice tone="success">{message}</Notice></div>}
    </form>
  );
}
