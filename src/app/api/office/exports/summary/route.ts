import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { assertRange, parseHoursFilter, recordPrintedSummary } from "@/lib/we/exports";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => {
    const actor = await requireApiRole("office");
    const filter = parseHoursFilter(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v : undefined])));
    assertRange(filter);
    return recordPrintedSummary(actor, filter);
  });
}
