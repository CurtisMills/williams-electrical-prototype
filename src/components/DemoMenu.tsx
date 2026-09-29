"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";

export type DemoPerson = { id: string; name: string; title: string; role: "engineer" | "office" };

/** Demo-only control: switch person and reset the sample data. */
export function DemoMenu({ people, currentId, tone = "dark" }: { people: DemoPerson[]; currentId: string; tone?: "dark" | "light" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That did not work.");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(id: string) {
    const data = await post("/api/demo/switch", { userId: id });
    if (data?.redirectTo) {
      window.location.assign(data.redirectTo);
    }
  }

  async function reset() {
    if (!window.confirm("Reset all demo data to the starting scenario? Everything recorded during this demo will be lost.")) return;
    if (await post("/api/demo/reset")) {
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith("we-offline-queue")) localStorage.removeItem(k);
      } catch {}
      router.refresh();
    }
  }

  const office = people.filter((p) => p.role === "office");
  const staff = people.filter((p) => p.role === "engineer");

  return (
    <details className="group relative">
      <summary
        className={`flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-xs font-extrabold tracking-wide uppercase [&::-webkit-details-marker]:hidden ${
          tone === "dark" ? "border-amber-300/70 text-amber-200 hover:bg-white/5" : "border-amber-500 text-amber-800 hover:bg-amber-50"
        }`}
      >
        <FlaskConical className="h-3.5 w-3.5" />
        Demo
      </summary>
      <div className="absolute top-full right-0 z-40 mt-2 w-72 rounded-xl border border-ink-100 bg-white p-2 text-ink-950 shadow-xl">
        <p className="px-3 pt-2 pb-1 text-xs text-ink-500">
          Demonstration only. Sample people and jobs, not real records.
        </p>
        <label htmlFor="demo-switch" className="mt-2 block px-3 text-xs font-extrabold text-ink-700">
          View as
        </label>
        <select
          id="demo-switch"
          className="mx-3 mt-1 mb-2 min-h-11 w-[calc(100%-1.5rem)] rounded-lg border border-ink-200 bg-white px-2 text-sm font-semibold"
          value={currentId}
          disabled={busy}
          onChange={(e) => switchTo(e.target.value)}
        >
          <optgroup label="Office">
            {office.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Employees">
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.title}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-signal-700 hover:bg-ink-50 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Reset demo data
        </button>
        {error && (
          <p role="alert" className="px-3 pb-2 text-xs font-bold text-signal-700">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
