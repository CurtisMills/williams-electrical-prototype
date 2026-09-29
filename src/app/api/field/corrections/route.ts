import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { requestCorrection } from "@/lib/we/work";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => requestCorrection(await requireApiRole("engineer"), body), 201);
}
