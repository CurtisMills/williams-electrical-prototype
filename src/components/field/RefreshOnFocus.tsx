"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server data when the tab regains focus, so engineer and office tabs stay in step. */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
