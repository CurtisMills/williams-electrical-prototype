import { requireApiRole } from "@/lib/auth/session";
import { handleField } from "@/lib/field/http";
import { getEngineerDay } from "@/lib/field/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleField(async () => {
    const session = await requireApiRole("engineer");
    return getEngineerDay(session.userId);
  });
}
