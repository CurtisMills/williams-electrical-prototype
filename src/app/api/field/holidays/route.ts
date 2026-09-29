import type { NextRequest } from "next/server";
import { getSession, requireApiRole } from "@/lib/auth/session";
import { handleField, readJson } from "@/lib/field/http";
import { FieldError, createHolidayRequest, listHolidayRequests } from "@/lib/field/store";
import type { HolidayStatus } from "@/lib/field/types";

export const dynamic = "force-dynamic";

const statuses: HolidayStatus[] = ["pending", "approved", "declined"];

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") as HolidayStatus | null;
  return handleField(async () => {
    const office = await getSession("office");
    const engineer = office ? null : await getSession("engineer");
    if (!office && !engineer) throw new FieldError(401, "Please sign in again.");
    return listHolidayRequests({
      status: status && statuses.includes(status) ? status : undefined,
      // Engineers only ever see their own requests.
      engineerId: engineer?.userId,
    });
  });
}

export async function POST(request: Request) {
  const body = await readJson(request);
  return handleField(async () => {
    const session = await requireApiRole("engineer");
    return createHolidayRequest(session.userId, body);
  }, 201);
}
