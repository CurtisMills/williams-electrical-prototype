import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { decideLeave } from "@/lib/we/leave";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/office/leave/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(async () => decideLeave(await requireApiRole("office"), id, body));
}
