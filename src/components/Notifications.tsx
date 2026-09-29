import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/portal/layout";
import { formatWhen } from "@/lib/field/dates";
import { holidayWording } from "@/lib/we/present";
import type { Notification } from "@/lib/we/types";
import { MarkAllRead } from "./MarkAllRead";

export function NotificationList({ items, portal }: { items: Notification[]; portal: "field" | "office" }) {
  const unread = items.filter((n) => !n.read).length;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-label text-muted">{unread ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 && <MarkAllRead portal={portal} />}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No updates yet.">
          Decisions on holiday, corrections and timesheets will appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className={`block rounded-card border p-4 transition-colors hover:border-control ${n.read ? "border-line bg-surface" : "border-primary/40 bg-primary-soft"}`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="flex items-baseline gap-2 font-bold">
                    {!n.read && (
                      <span className="shrink-0 text-caption font-bold text-primary">
                        New<span className="sr-only">:</span>
                      </span>
                    )}
                    {holidayWording(n.title)}
                  </span>
                  <span className="shrink-0 text-label text-muted tabular-nums">{formatWhen(n.at)}</span>
                </span>
                {n.body && <span className="mt-0.5 block text-label text-ink">{holidayWording(n.body)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
