import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { createLeave } from "@/lib/we/leave";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => {
    const actor = await requireApiRole("engineer");
    // Employees can only ever request leave for themselves.
    return createLeave(actor, { ...body, employeeId: actor.id });
  }, 201);
}
