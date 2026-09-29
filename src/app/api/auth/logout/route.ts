import { cookies } from "next/headers";
import { sessionCookie } from "@/lib/auth/token";

// Plain form POST so sign-out works without client JavaScript.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const portal = form?.get("portal") === "office" ? "office" : "field";
  (await cookies()).delete(sessionCookie(portal === "office" ? "office" : "engineer"));
  return new Response(null, { status: 303, headers: { Location: `/${portal}/login` } });
}
