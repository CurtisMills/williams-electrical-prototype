import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { SAMPLE_ENGINEERS } from "@/lib/field/sample-data";
import type { Role } from "./token";

// Demo staff directory. Replace with the real identity provider / user table.

export interface StaffUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  title: string;
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Williams2026!";
const DOMAIN = "williamselectrical.co.uk";

const emailFor = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DOMAIN}`;

export const STAFF: StaffUser[] = [
  ...SAMPLE_ENGINEERS.map((e) => ({
    id: e.id,
    name: e.name,
    initials: e.initials,
    email: emailFor(e.name),
    role: "engineer" as const,
    title: "Electrician",
  })),
  { id: "office-megan", name: "Megan Lloyd", initials: "ML", email: emailFor("Megan Lloyd"), role: "office", title: "Office manager" },
  { id: "office-gareth", name: "Gareth Williams", initials: "GW", email: emailFor("Gareth Williams"), role: "office", title: "Director" },
];

const hash = (password: string, salt: string) => scryptSync(password, `we:${salt}`, 32);
const passwordHashes = new Map(STAFF.map((u) => [u.id, hash(DEMO_PASSWORD, u.id)]));

export function findStaff(id: string) {
  return STAFF.find((u) => u.id === id);
}

export function verifyCredentials(email: string, password: string): StaffUser | null {
  const user = STAFF.find((u) => u.email === email.trim().toLowerCase());
  // Hash even for unknown emails so response time doesn't reveal which accounts exist.
  const candidate = hash(password, user?.id ?? "unknown");
  const expected = user ? passwordHashes.get(user.id) : undefined;
  if (!user || !expected || !timingSafeEqual(candidate, expected)) return null;
  return user;
}
