import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { addRequirements, assign, assignAcross, removeRequirement, unassign } from "@/lib/we/planning";
import { AppError } from "@/lib/we/store";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => {
    const actor = await requireApiRole("office");
    switch (body.action) {
      case "assign":
        return assign(actor, body);
      case "assign_across":
        return assignAcross(actor, body);
      case "unassign":
        return unassign(actor, body);
      case "add_requirement":
        return addRequirements(actor, body);
      case "remove_requirement":
        return removeRequirement(actor, body);
    }
    throw new AppError(400, "Unknown action.");
  });
}
