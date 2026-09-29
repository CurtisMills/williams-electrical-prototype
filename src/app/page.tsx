import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const h = await headers();
  const mobile = h.get("sec-ch-ua-mobile") === "?1" || /Mobi|Android|iPhone|iPad|iPod/i.test(h.get("user-agent") ?? "");
  const [engineer, office] = await Promise.all([getSession("engineer"), getSession("office")]);

  if (mobile) redirect(engineer ? "/field" : office ? "/office" : "/field/login");
  redirect(office ? "/office" : engineer ? "/field" : "/office/login");
}
