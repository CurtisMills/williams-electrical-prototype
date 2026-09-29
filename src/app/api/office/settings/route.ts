import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { updateSettings } from "@/lib/we/admin";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => updateSettings(await requireApiRole("office"), body));
}
