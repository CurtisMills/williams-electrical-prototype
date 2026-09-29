import Link from "next/link";
import { formatWhen } from "@/lib/field/dates";
import type { Notification } from "@/lib/we/types";
import { MarkAllRead } from "./MarkAllRead";

export function NotificationList({ items, portal }: { items: Notification[]; portal: "field" | "office" }) {
  const unread = items.filter((n) => !n.read).length;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">{unread ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 && <MarkAllRead portal={portal} />}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 bg-white p-4 text-sm text-ink-500">No updates yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className={`block rounded-xl border p-3.5 hover:border-ink-300 ${n.read ? "border-ink-100 bg-white" : "border-signal-600/40 bg-signal-600/5"}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-extrabold">
                    {!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-signal-600" aria-label="Unread" />}
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">{formatWhen(n.at)}</span>
                </span>
                {n.body && <span className="mt-0.5 block text-sm text-ink-600">{n.body}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
