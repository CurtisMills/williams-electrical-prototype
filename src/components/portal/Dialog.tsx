"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Modal sheet: slides from the bottom on phones, centred on wider screens.
 * Moves focus in on open, keeps Tab inside, closes on Escape and returns focus to where it was.
 */
export function Dialog({ title, description, onClose, children }: { title: ReactNode; description?: ReactNode; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? []);
    (focusables().find((f) => f.dataset.autofocus !== undefined) ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-dialog bg-surface shadow-overlay outline-none sm:rounded-dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line py-3 pr-2 pl-5">
          <div className="min-w-0 py-2">
            <h2 id={titleId} className="text-section font-bold">
              {title}
            </h2>
            {description && <p className="mt-1 text-label text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-12 shrink-0 place-items-center rounded-control text-ink hover:bg-subtle" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
