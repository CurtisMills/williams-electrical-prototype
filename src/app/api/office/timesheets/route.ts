import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { decideTimesheet } from "@/lib/we/timesheets";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => decideTimesheet(await requireApiRole("office"), body));
}
