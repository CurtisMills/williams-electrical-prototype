import type { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { AppError } from "@/lib/we/store";
import { assertRange, customerCsv, parseHoursFilter } from "@/lib/we/exports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireApiRole("office");
    const filter = parseHoursFilter(request.nextUrl.searchParams);
    assertRange(filter);
    const { csv, filename } = await customerCsv(actor, filter);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return new Response(err.message, { status: err.status });
    throw err;
  }
}
