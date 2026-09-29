import { NextResponse, type NextRequest } from "next/server";
import { homeFor, loginFor, sessionCookie, verifySession, type Role } from "@/lib/auth/token";

// Optimistic gate: only reads the signed cookie. Pages and API routes re-check the session.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role: Role = pathname.startsWith("/office") ? "office" : "engineer";
  const session = await verifySession(request.cookies.get(sessionCookie(role))?.value);
  const signedIn = session?.role === role;

  if (pathname === loginFor(role)) {
    return signedIn ? NextResponse.redirect(new URL(homeFor(role), request.url)) : NextResponse.next();
  }
  if (!signedIn) return NextResponse.redirect(new URL(loginFor(role), request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/field/:path*", "/office/:path*"],
};
