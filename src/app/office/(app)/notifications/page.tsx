import type { Metadata } from "next";
import { NotificationList } from "@/components/Notifications";
import { PageHeader } from "@/components/office/kit";
import { requireRole } from "@/lib/auth/session";
import { readStore } from "@/lib/we/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Updates" };

export default async function OfficeNotificationsPage() {
  const { user } = await requireRole("office");
  const store = await readStore();
  const items = store.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  return (
    <section className="max-w-3xl">
      <PageHeader overline="OFFICE" title="Updates" />
      <NotificationList items={items} portal="office" />
    </section>
  );
}
