import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { recordWork } from "@/lib/we/work";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => recordWork(await requireApiRole("engineer"), body));
}
