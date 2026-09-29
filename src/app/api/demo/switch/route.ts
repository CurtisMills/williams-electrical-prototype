import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { SESSION_TTL_SECONDS, homeFor, sessionCookie, signSession } from "@/lib/auth/token";
import { DEMO_MODE, findStaff } from "@/lib/auth/users";
import { readJson } from "@/lib/field/http";

// Demo-only role switch for walkthroughs. Requires an existing sign-in and is disabled with
// DEMO_MODE=off; it is not a substitute for production sign-in.
export async function POST(request: Request) {
  if (!DEMO_MODE) return Response.json({ error: "Demo mode is off." }, { status: 404 });
  const signedIn = (await getSession("office")) ?? (await getSession("engineer"));
  if (!signedIn) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const body = await readJson(request);
  const user = findStaff(String(body.userId));
  if (!user) return Response.json({ error: "Unknown person." }, { status: 404 });
  const token = await signSession({ userId: user.id, role: user.role, name: user.name });
  (await cookies()).set(sessionCookie(user.role), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return Response.json({ redirectTo: homeFor(user.role) });
}
