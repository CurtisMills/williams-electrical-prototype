import type { Metadata } from "next";
import { SignInShell } from "@/components/auth/SignInShell";

export const metadata: Metadata = { title: "Sign in" };

export default function FieldLoginPage() {
  return <SignInShell portal="field" />;
}
