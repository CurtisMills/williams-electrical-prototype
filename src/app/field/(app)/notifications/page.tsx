import type { Metadata } from "next";
import { NotificationList } from "@/components/Notifications";
import { Overline } from "@/components/field/ui";
import { requireRole } from "@/lib/auth/session";
import { readStore } from "@/lib/we/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Updates" };

export default async function FieldNotificationsPage() {
  const { user } = await requireRole("engineer");
  const store = await readStore();
  const items = store.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
  return (
    <section>
      <Overline>UPDATES</Overline>
      <h1 className="mb-3 text-2xl font-extrabold tracking-tight">Updates from the office</h1>
      <NotificationList items={items} portal="field" />
    </section>
  );
}
