import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { DEMO_EMPLOYEES } from "@/lib/we/seed";
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
  ...DEMO_EMPLOYEES.map((e) => ({
    id: e.id,
    name: e.name,
    initials: e.initials,
    email: emailFor(e.name),
    role: "engineer" as const,
    title: e.role === "apprentice" ? "Apprentice electrician" : "Electrician",
  })),
  { id: "office-megan", name: "Megan Lloyd", initials: "ML", email: emailFor("Megan Lloyd"), role: "office", title: "Office administrator" },
  { id: "office-gareth", name: "Gareth Williams", initials: "GW", email: emailFor("Gareth Williams"), role: "office", title: "Director and planner" },
];

/** Demo mode shows the role switcher and reset. Set DEMO_MODE=off to hide them. */
export const DEMO_MODE = process.env.DEMO_MODE !== "off";

export function demoPeople() {
  return STAFF.map(({ id, name, title, role }) => ({ id, name, title, role }));
}

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
