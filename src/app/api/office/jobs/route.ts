import { requireApiRole } from "@/lib/auth/session";
import { handle, readJson } from "@/lib/field/http";
import { createJob, createSite, setJobStatus } from "@/lib/we/planning";
import { AppError } from "@/lib/we/store";

export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(async () => {
    const actor = await requireApiRole("office");
    switch (body.action) {
      case "create":
        return createJob(actor, body);
      case "status":
        return setJobStatus(actor, body);
      case "site":
        return createSite(actor, body);
    }
    throw new AppError(400, "Unknown action.");
  });
}
