"use client";

import { useState } from "react";

export function PrintButton({ filter }: { filter: Record<string, string | undefined> }) {
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-8 flex items-center gap-3 print:hidden">
      <button
        type="button"
        className="min-h-12 rounded-control bg-ink px-5 text-label font-bold text-white"
        onClick={async () => {
          setError(null);
          if (!ref) {
            const res = await fetch("/api/office/exports/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filter) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return setError(data.error ?? "Couldn’t log this export.");
            setRef(data.id);
          }
          window.print();
        }}
      >
        Print or save as PDF
      </button>
      {ref && <span className="text-sm text-muted">Logged as {ref}</span>}
      {error && <span className="text-sm font-bold text-error">{error}</span>}
    </div>
  );
}
