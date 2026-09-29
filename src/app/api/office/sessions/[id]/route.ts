import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { AppError } from "@/lib/we/store";
import { officeCorrectSession, officeVoidSession } from "@/lib/we/work";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/office/sessions/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  return handle(async () => {
    const actor = await requireApiRole("office");
    if (body.action === "correct") return officeCorrectSession(actor, id, body);
    if (body.action === "void") return officeVoidSession(actor, id, body);
    throw new AppError(400, "Unknown action.");
  });
}
