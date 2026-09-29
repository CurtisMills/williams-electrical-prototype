"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Notice } from "@/components/field/ui";
import { useAction } from "@/components/useAction";
import { btn, inputCls } from "./kit";

type Tone = keyof typeof btn;

/** One-click action; optional browser confirm for anything hard to undo. */
export function ActionButton({
  url,
  body,
  children,
  tone = "outline",
  confirm,
  success,
}: {
  url: string;
  body: unknown;
  children: ReactNode;
  tone?: Tone;
  confirm?: string;
  success?: string;
}) {
  const { run, busy, error, message } = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={btn[tone]}
        disabled={busy}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          void run(url, body, { success });
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
      {error && <span role="alert" className="max-w-md text-xs font-bold text-signal-700">{error}</span>}
      {message && <span role="status" className="text-xs font-bold text-emerald-700">{message}</span>}
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
  success?: string;
  field?: string;
}) {
  const { run, busy, error, message } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button type="button" className={btn[tone]} onClick={() => setOpen(true)}>
          {label}
        </button>
        {message && <span role="status" className="text-xs font-bold text-emerald-700">{message}</span>}
      </span>
    );
  }
  return (
    <form
      className="w-full max-w-md space-y-2 rounded-xl border border-ink-200 bg-ink-50/60 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(url, { ...body, [field]: reason }, { success });
        if (ok) {
          setOpen(false);
          setReason("");
        }
      }}
    >
      <label className="block text-xs font-extrabold text-ink-700">
        {reasonLabel}
        {optional && <span className="font-normal text-ink-500"> (optional)</span>}
        <textarea
          rows={2}
          value={reason}
          required={!optional}
          minLength={optional ? undefined : 5}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} mt-1 py-2`}
          autoFocus
        />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" className={btn[submitTone]} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel ?? label}
        </button>
        <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
