"use client";

import { Button } from "@/components/portal/button";
import { useAction } from "./useAction";

export function MarkAllRead({ portal }: { portal: "field" | "office" }) {
  const { run, busy, error } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="quiet" busy={busy} onClick={() => run("/api/notifications", { portal })}>
        Mark all as read
      </Button>
      {error && (
        <span role="alert" className="text-label font-semibold text-error">
          Couldn’t mark as read. {error}
        </span>
      )}
    </span>
  );
}
