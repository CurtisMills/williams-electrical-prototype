"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Notice } from "@/components/field/ui";

function useMutation() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(url: string, init: RequestInit) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Something went wrong. Please try again.");
      startRefresh(() => router.refresh());
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return { run, busy: sending || refreshing, error };
}

export function DecisionButtons({ id, name }: { id: string; name: string }) {
  const { run, busy, error } = useMutation();
  const [choice, setChoice] = useState<"approved" | "declined" | null>(null);

  const decide = (status: "approved" | "declined") => {
    setChoice(status);
    void run(`/api/field/holidays/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("approved")}
          aria-label={`Approve ${name}’s request`}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#254d3d] px-4 text-sm font-extrabold text-white disabled:opacity-60 sm:flex-none"
        >
          {busy && choice === "approved" && <Loader2 className="h-4 w-4 animate-spin" />}
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("declined")}
          aria-label={`Decline ${name}’s request`}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-4 text-sm font-extrabold text-ink-800 disabled:opacity-60 sm:flex-none"
        >
          {busy && choice === "declined" && <Loader2 className="h-4 w-4 animate-spin" />}
          Decline
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
