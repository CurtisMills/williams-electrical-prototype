import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FieldError } from "@/lib/field/store";
import { loginFor, sessionCookie, verifySession, type Role, type Session } from "./token";
import { findStaff } from "./users";

export async function getSession(role: Role): Promise<Session | null> {
  const store = await cookies();
  const session = await verifySession(store.get(sessionCookie(role))?.value);
  return session && session.role === role && findStaff(session.userId) ? session : null;
}

/** For pages and layouts: redirects to the portal's login when signed out. */
export async function requireRole(role: Role) {
  const session = await getSession(role);
  if (!session) redirect(loginFor(role));
  return { session, user: findStaff(session.userId)! };
}

/** For route handlers: throws a 401/403 that `handleField` turns into JSON. */
export async function requireApiRole(role: Role): Promise<Session> {
  const session = await getSession(role);
  if (session) return session;
  const other = await getSession(role === "engineer" ? "office" : "engineer");
  throw other ? new FieldError(403, "You don’t have access to this.") : new FieldError(401, "Please sign in again.");
}
