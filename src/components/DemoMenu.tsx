"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { MenuDetails, menuItem } from "@/components/portal/Menu";

export type DemoPerson = { id: string; name: string; title: string; role: "engineer" | "office" };

/** Demo-only control: switch person and reset the sample data. */
export function DemoMenu({ people, currentId, align = "right" }: { people: DemoPerson[]; currentId: string; align?: "right" | "left" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t work. Try again.");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t work. Try again.");
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
    <MenuDetails
      summaryClassName="inline-flex min-h-12 items-center gap-1.5 rounded-control px-3 text-label font-bold text-warning underline-offset-4 hover:underline"
      panelClassName={`top-full mt-1 w-72 ${align === "right" ? "right-0" : "left-0"}`}
      summary={
        <>
          <FlaskConical className="size-4" aria-hidden />
          Demo tools
        </>
      }
    >
      <p className="px-3 pt-2 pb-1 text-label text-muted">Demonstration only. Sample people and jobs, not real records.</p>
      <label htmlFor="demo-switch" className="mt-2 block px-3 text-label font-semibold text-ink">
        View as
      </label>
      <select
        id="demo-switch"
        className="mx-3 mt-1.5 mb-2 block min-h-12 w-[calc(100%-1.5rem)] rounded-control border border-control bg-surface px-3 text-body"
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
      <button type="button" onClick={reset} disabled={busy} className={`${menuItem} text-error disabled:opacity-60`}>
        <RotateCcw className="size-5" aria-hidden />
        Reset demo data
      </button>
      {error && (
        <p role="alert" className="px-3 pb-2 text-label font-semibold text-error">
          {error}
        </p>
      )}
    </MenuDetails>
  );
}

/** Thin strip that labels sample data and holds the demo tools, kept out of the main header. */
export function DemoStrip({ people, currentId }: { people: DemoPerson[]; currentId: string }) {
  return (
    <div className="border-b border-warning/30 bg-warning-surface text-ink">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 px-4 sm:px-6">
        <p className="py-1 text-caption font-semibold">Demo: sample people, jobs and times</p>
        <DemoMenu people={people} currentId={currentId} />
      </div>
    </div>
  );
}
