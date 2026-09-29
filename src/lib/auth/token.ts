// Signed session token (HMAC-SHA256 via Web Crypto) so it can be verified in the proxy and
// in route handlers alike. Payload is not secret, only tamper-proof.

export type Role = "engineer" | "office";

export interface Session {
  userId: string;
  role: Role;
  name: string;
  exp: number;
}

// One cookie per portal so the field app and office portal can be open side by side.
export const sessionCookie = (role: Role) => (role === "engineer" ? "we_field_session" : "we_office_session");
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

const DEV_SECRET = "dev-only-williams-electrical-session-secret";
let warned = false;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("SESSION_SECRET is not set; using the development secret.");
  }
  return DEV_SECRET;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hmacKey() {
  return crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(session: Omit<Session, "exp">): Promise<string> {
  const payload: Session = { ...session, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(signature), encoder.encode(body));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Session;
    if (typeof session.exp !== "number" || session.exp < Date.now() / 1000) return null;
    if (session.role !== "engineer" && session.role !== "office") return null;
    return session;
  } catch {
    return null;
  }
}

export const homeFor = (role: Role) => (role === "engineer" ? "/field" : "/office");
export const loginFor = (role: Role) => (role === "engineer" ? "/field/login" : "/office/login");
