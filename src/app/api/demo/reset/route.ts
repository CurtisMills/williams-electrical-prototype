import { getSession } from "@/lib/auth/session";
import { DEMO_MODE } from "@/lib/auth/users";
import { resetStore } from "@/lib/we/store";

export async function POST() {
  if (!DEMO_MODE) return Response.json({ error: "Demo mode is off." }, { status: 404 });
  const signedIn = (await getSession("office")) ?? (await getSession("engineer"));
  if (!signedIn) return Response.json({ error: "Please sign in first." }, { status: 401 });
  await resetStore();
  return Response.json({ ok: true });
}
