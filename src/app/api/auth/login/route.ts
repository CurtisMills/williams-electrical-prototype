import { cookies } from "next/headers";
import { readJson } from "@/lib/field/http";
import { SESSION_TTL_SECONDS, homeFor, sessionCookie, signSession, type Role } from "@/lib/auth/token";
import { verifyCredentials } from "@/lib/auth/users";

const portalRole: Record<string, Role> = { field: "engineer", office: "office" };

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = portalRole[String(body.portal)];

  if (!role) return Response.json({ error: "Unknown portal." }, { status: 400 });
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

  const user = verifyCredentials(email, password);
  if (!user) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  if (user.role !== role) {
    return Response.json(
      {
        error:
          user.role === "engineer"
            ? "This is an engineer account. Sign in through the field app."
            : "This is an office account. Sign in through the office portal.",
      },
      { status: 403 },
    );
  }

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
