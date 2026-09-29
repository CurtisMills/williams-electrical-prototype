"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type WorkAction = "start" | "break" | "resume" | "finish" | "switch";

export interface QueuedEvent {
  clientEventId: string;
  action: WorkAction;
  occurredAt: string;
  jobId?: string | null;
  activity?: string;
  note?: string;
  /** Plain-English description shown while the event waits on the phone. */
  label: string;
}

export type SendResult =
  | { status: "saved"; message: string }
  | { status: "queued"; message: string }
  | { status: "error"; message: string };

interface OfflineState {
  queue: QueuedEvent[];
  online: boolean;
  syncing: boolean;
  lastSyncMessage: string | null;
  send: (event: Omit<QueuedEvent, "clientEventId" | "occurredAt">) => Promise<SendResult>;
  syncNow: () => void;
}

const OfflineContext = createContext<OfflineState | null>(null);
export const QUEUE_PREFIX = "we-offline-queue";

function readQueue(key: string): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function post(event: QueuedEvent) {
  const { label: _label, ...body } = event;
  void _label;
  const res = await fetch("/api/field/work", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Keeps start/break/finish taps on the phone when there's no signal, so they survive a reload,
 * and sends each one once when the connection returns. Each event keeps the time it happened.
 */
export function OfflineProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const router = useRouter();
  const key = `${QUEUE_PREFIX}:${userId}`;
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const flushing = useRef(false);

  const persist = useCallback(
    (next: QueuedEvent[]) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      setQueue(next);
    },
    [key],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    let pending = readQueue(key);
    if (!pending.length) return;
    flushing.current = true;
    setSyncing(true);
    const messages: string[] = [];
    try {
      while (pending.length) {
        const [event] = pending;
        let result;
        try {
          result = await post(event);
        } catch {
          break; // still offline; try again later
        }
        if (result.ok && result.data.outcome === "conflict") {
          messages.push(`${event.label}: sent to the office to check because it clashes with a newer record.`);
        } else if (!result.ok && result.status !== 401) {
          messages.push(`${event.label}: not saved. ${result.data.error ?? "Please tell the office."}`);
        } else if (result.status === 401) {
          break;
        }
        pending = pending.slice(1);
        persist(pending);
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      if (!pending.length) {
        setLastSyncMessage(messages.length ? messages.join(" ") : "Saved on the phone and now sent to the office.");
        router.refresh();
      } else if (messages.length) {
        setLastSyncMessage(messages.join(" "));
      }
    }
  }, [key, persist, router]);

  useEffect(() => {
    // Read the phone's saved queue after hydration so server and client render the same markup.
    const init = window.setTimeout(() => {
      setQueue(readQueue(key));
      setOnline(navigator.onLine);
      if (navigator.onLine) void flush();
    }, 0);
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 15000);
    return () => {
      window.clearTimeout(init);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [key, flush]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const script = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
    navigator.serviceWorker.register(script, { scope: "/field" }).catch(() => undefined);
  }, []);

  const send: OfflineState["send"] = async (input) => {
    const event: QueuedEvent = { ...input, clientEventId: newId(), occurredAt: new Date().toISOString() };
    const queueEvent = () => {
      persist([...readQueue(key), event]);
      return { status: "queued" as const, message: "No signal. Saved on this phone and will send automatically." };
    };
    // Keep order: if anything is already waiting, this one waits behind it.
    if (!navigator.onLine || readQueue(key).length) {
      const r = queueEvent();
      if (navigator.onLine) void flush();
      return r;
    }
    try {
      const result = await post(event);
      if (!result.ok) return { status: "error", message: result.data.error ?? "Not saved. Please try again." };
      router.refresh();
      return { status: "saved", message: result.data.message ?? "Saved." };
    } catch {
      return queueEvent();
    }
  };

  return (
    <OfflineContext.Provider value={{ queue, online, syncing, lastSyncMessage, send, syncNow: () => void flush() }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside OfflineProvider");
  return ctx;
}
