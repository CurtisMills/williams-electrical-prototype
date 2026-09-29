"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/portal/button";
import { FieldError, TextAreaField } from "@/components/portal/field";
import { useAction } from "@/components/useAction";

type Tone = "primary" | "dark" | "outline" | "ghost" | "danger";

const variantFor: Record<Tone, ButtonVariant> = {
  primary: "primary",
  dark: "primary",
  outline: "secondary",
  ghost: "quiet",
  danger: "danger",
};

function Result({ error, message }: { error: string | null; message: string | null }) {
  return (
    <>
      <span role="status" aria-live="polite" className="text-label font-semibold text-success">
        {message}
      </span>
      <span role="alert">
        {error && <FieldError>Couldn’t save. {error}</FieldError>}
      </span>
    </>
  );
}

/** One-click action; optional browser confirm for anything hard to undo. */
export function ActionButton({
  url,
  body,
  children,
  tone = "outline",
  size = "md",
  confirm,
  success,
  busyLabel,
}: {
  url: string;
  body: unknown;
  children: ReactNode;
  tone?: Tone;
  size?: "md" | "sm";
  confirm?: string;
  success?: string;
  busyLabel?: string;
}) {
  const { run, busy, error, message } = useAction();
  return (
    <span className="inline-flex max-w-md flex-col items-start gap-1">
      <Button
        variant={variantFor[tone]}
        size={size}
        busy={busy}
        busyLabel={busyLabel}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          void run(url, body, { success });
        }}
      >
        {children}
      </Button>
      <Result error={error} message={message} />
    </span>
  );
}

/** Action that needs a written reason (declines, corrections, reopening). */
export function ReasonAction({
  url,
  body,
  label,
  submitLabel,
  reasonLabel = "Reason",
  placeholder,
  optional = false,
  tone = "outline",
  submitTone = "primary",
  size = "md",
  success,
  field = "reason",
}: {
  url: string;
  body: Record<string, unknown>;
  label: ReactNode;
  submitLabel?: string;
  reasonLabel?: string;
  placeholder?: string;
  optional?: boolean;
  tone?: Tone;
  submitTone?: Tone;
  size?: "md" | "sm";
  success?: string;
  field?: string;
}) {
  const { run, busy, error, message } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const invalid = !optional && reason.trim().length < 5;

  if (!open) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <Button variant={variantFor[tone]} size={size} onClick={() => setOpen(true)}>
          {label}
        </Button>
        <Result error={null} message={message} />
      </span>
    );
  }
  return (
    <form
      noValidate
      className="w-full max-w-md space-y-3 rounded-card border border-line bg-subtle p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (invalid) return;
        const ok = await run(url, { ...body, [field]: reason }, { success });
        if (ok) {
          setOpen(false);
          setReason("");
          setTried(false);
        }
      }}
    >
      <TextAreaField
        label={reasonLabel}
        optional={optional}
        hint={placeholder}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={tried && invalid ? "Give a reason of at least 5 characters." : null}
        autoFocus
      />
      <Result error={error} message={null} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={variantFor[submitTone]} busy={busy} busyLabel="Saving…">
          {submitLabel ?? label}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
