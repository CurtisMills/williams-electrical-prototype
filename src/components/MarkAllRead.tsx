"use client";

import { useAction } from "./useAction";

export function MarkAllRead({ portal }: { portal: "field" | "office" }) {
  const { run, busy } = useAction();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => run("/api/notifications", { portal })}
      className="min-h-10 rounded-lg px-3 text-sm font-bold text-signal-700 hover:bg-ink-50 disabled:opacity-50"
    >
      Mark all as read
    </button>
  );
}
