import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handleField } from "@/lib/field/http";
import { startJob } from "@/lib/field/store";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/field/jobs/[id]/start">) {
  const { id } = await ctx.params;
  return handleField(async () => {
    const session = await requireApiRole("engineer");
    return startJob(session.userId, id);
  }, 201);
}
