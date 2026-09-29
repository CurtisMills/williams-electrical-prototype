"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginForm({ portal }: { portal: "field" | "office" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetHint, setResetHint] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t sign you in. Please try again.");
        setBusy(false);
        return;
      }
      router.replace(data.redirectTo);
    } catch {
      setError("No connection. Check your signal and try again.");
      setBusy(false);
    }
  }

  const input =
    "min-h-13 w-full rounded-xl border border-ink-200 bg-white px-4 text-base text-ink-950 outline-none placeholder:text-ink-400 focus-visible:border-signal-600 focus-visible:ring-3 focus-visible:ring-signal-400/30";

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-ink-800">Email</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@williamselectrical.co.uk"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-2 flex items-center justify-between text-sm font-bold text-ink-800">
          Password
          <button
            type="button"
            onClick={() => setResetHint((v) => !v)}
            className="text-sm font-semibold text-signal-700 hover:underline"
          >
            Forgot password?
          </button>
        </span>
        <span className="relative block">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${input} pr-13`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-13 place-items-center text-ink-400 hover:text-ink-700"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </span>
      </label>

      {resetHint && (
        <p role="status" className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-600">
          Contact the office to reset your password.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-signal-600/10 px-3 py-2.5 text-sm text-signal-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal-600 px-4 text-base font-extrabold text-white hover:bg-signal-700 active:bg-signal-800 disabled:opacity-70"
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}
