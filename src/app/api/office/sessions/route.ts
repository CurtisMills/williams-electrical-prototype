import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { officeCreateSession } from "@/lib/we/work";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => officeCreateSession(await requireApiRole("office"), body), 201);
}
