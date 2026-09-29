import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { employeeLeaveAction } from "@/lib/we/leave";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/field/leave/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(async () => employeeLeaveAction(await requireApiRole("engineer"), id, body));
}
