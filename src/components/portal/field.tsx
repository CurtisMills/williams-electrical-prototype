"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

export const inputClass = (invalid = false) =>
  `block min-h-12 w-full rounded-control border bg-surface px-3 text-body text-ink placeholder:text-muted disabled:bg-subtle disabled:text-muted ${
    invalid ? "border-error" : "border-control"
  }`;

export const labelClass = "block text-label font-semibold text-ink";

interface FieldChrome {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
}

function useFieldIds(id: string | undefined, hint: unknown, error: unknown) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return { fieldId, hintId, errorId, describedBy };
}

function Chrome({
  fieldId,
  hintId,
  errorId,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: FieldChrome & { fieldId: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-caption text-muted">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-label font-semibold text-error">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function TextField({ label, hint, error, optional, className, id, ...input }: FieldChrome & InputHTMLAttributes<HTMLInputElement>) {
  const ids = useFieldIds(id, hint, error);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input id={ids.fieldId} aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} className={inputClass(!!error)} {...input} />
    </Chrome>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  className,
  id,
  children,
  ...select
}: FieldChrome & SelectHTMLAttributes<HTMLSelectElement>) {
  const ids = useFieldIds(id, hint, error);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select id={ids.fieldId} aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} className={inputClass(!!error)} {...select}>
        {children}
      </select>
    </Chrome>
  );
}

export function TextAreaField({ label, hint, error, optional, className, id, ...area }: FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ids = useFieldIds(id, hint, error);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={`${inputClass(!!error)} py-2.5`}
        {...area}
      />
    </Chrome>
  );
}

export function CheckboxField({ label, className = "", ...input }: { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 text-label font-semibold text-ink ${className}`}>
      <input type="checkbox" className="size-5 shrink-0 accent-ink" {...input} />
      {label}
    </label>
  );
}
