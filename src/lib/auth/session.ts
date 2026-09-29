import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError, type Actor } from "@/lib/we/store";
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

/** For route handlers: throws a 401/403 that `handle` turns into JSON. Every API call checks this. */
export async function requireApiRole(role: Role): Promise<Actor> {
  const session = await getSession(role);
  if (session) return { id: session.userId, name: session.name, role };
  const other = await getSession(role === "engineer" ? "office" : "engineer");
  throw other ? new AppError(403, "You don’t have access to this.") : new AppError(401, "Please sign in again.");
}
