import type { Metadata } from "next";
import { SignInShell } from "@/components/auth/SignInShell";

export const metadata: Metadata = { title: "Sign in" };

export default function OfficeLoginPage() {
  return <SignInShell portal="office" />;
}
