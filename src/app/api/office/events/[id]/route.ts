import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { dismissConflict } from "@/lib/we/work";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/office/events/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(async () => dismissConflict(await requireApiRole("office"), id, body));
}
