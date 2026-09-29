import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { markNotificationsRead } from "@/lib/we/admin";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => markNotificationsRead(await requireApiRole(body.portal === "office" ? "office" : "engineer")));
}
