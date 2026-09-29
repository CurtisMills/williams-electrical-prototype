"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/portal/button";
import { FieldError, inputClass, labelClass } from "@/components/portal/field";
import { Notice } from "@/components/portal/notice";

export function LoginForm({ portal }: { portal: "field" | "office" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetHint, setResetHint] = useState(false);

  const emailError = tried && !email.trim() ? "Enter your email address." : null;
  const passwordError = tried && !password ? "Enter your password." : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t sign you in. Try again.");
        setBusy(false);
        return;
      }
      router.replace(data.redirectTo);
    } catch {
      setError("No connection. Check your signal and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <label htmlFor="signin-email" className={labelClass}>
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "signin-email-error" : undefined}
          className={`mt-1.5 ${inputClass(!!emailError)}`}
        />
        {emailError && <FieldError id="signin-email-error">{emailError}</FieldError>}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="signin-password" className={labelClass}>
            Password
          </label>
          <button
            type="button"
            onClick={() => setResetHint((v) => !v)}
            aria-expanded={resetHint}
            aria-controls="signin-reset-hint"
            className="-my-2 min-h-11 rounded-control px-1 text-label font-semibold text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative mt-1.5">
          <input
            id="signin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={[passwordError ? "signin-password-error" : null, resetHint ? "signin-reset-hint" : null].filter(Boolean).join(" ") || undefined}
            className={`${inputClass(!!passwordError)} pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-control text-muted hover:text-ink"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
        {passwordError && <FieldError id="signin-password-error">{passwordError}</FieldError>}
        {resetHint && (
          <p id="signin-reset-hint" className="mt-2 text-label text-muted">
            Contact the office to reset your password.
          </p>
        )}
      </div>

      <div role="alert" aria-atomic="true">
        {error && (
          <Notice tone="error" title="Couldn’t sign you in" live={false}>
            {error}
          </Notice>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" full busy={busy} busyLabel="Signing in…">
        Sign in
      </Button>
    </form>
  );
}
