"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * POSTs JSON, keeps the user's input on failure, and refreshes server data either way so the
 * screen reflects what the server actually holds.
 */
export function useAction() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run<T = Record<string, unknown>>(
    url: string,
    body: unknown,
    options: { success?: string | ((data: T) => string); refresh?: boolean } = {},
  ): Promise<T | null> {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (res.status === 409 || options.refresh !== false) startRefresh(() => router.refresh());
        return null;
      }
      if (options.success) setMessage(typeof options.success === "function" ? options.success(data) : options.success);
      if (options.refresh !== false) startRefresh(() => router.refresh());
      return data as T;
    } catch {
      setError("No connection. Your entry is still here. Check your signal and try again.");
      return null;
    } finally {
      setSending(false);
    }
  }

  return { run, busy: sending || refreshing, error, message, setError, setMessage };
}
