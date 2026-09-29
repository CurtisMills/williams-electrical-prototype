import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { handleField } from "@/lib/field/http";
import { finishJob } from "@/lib/field/store";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/field/jobs/[id]/finish">) {
  const { id } = await ctx.params;
  return handleField(async () => {
    const session = await requireApiRole("engineer");
    return finishJob(session.userId, id);
  });
}
