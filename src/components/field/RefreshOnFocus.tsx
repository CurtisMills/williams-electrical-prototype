"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches server data when the tab regains focus (and optionally on a timer while visible),
 * so employee and office screens stay in step without a manual reload.
 */
export function RefreshOnFocus({ intervalMs }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = intervalMs
      ? window.setInterval(() => {
          if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
        }, intervalMs)
      : undefined;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearInterval(timer);
    };
  }, [router, intervalMs]);
  return null;
}
