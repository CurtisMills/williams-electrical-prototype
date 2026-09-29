import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handleField, readJson } from "@/lib/field/http";
import { decideHolidayRequest } from "@/lib/field/store";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/field/holidays/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handleField(async () => {
    await requireApiRole("office");
    return decideHolidayRequest(id, body.status);
  });
}
