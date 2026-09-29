import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { createLeave } from "@/lib/we/leave";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => createLeave(await requireApiRole("office"), body), 201);
}
