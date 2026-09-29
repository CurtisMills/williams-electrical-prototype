import { requireApiRole } from "@/lib/auth/session";
import { handleField } from "@/lib/field/http";
import { resetFieldStore } from "@/lib/field/store";

export async function POST() {
  return handleField(async () => {
    await requireApiRole("office");
    await resetFieldStore();
    return { ok: true };
  });
}
