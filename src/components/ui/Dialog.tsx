"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { cx, focusRing } from "./cx";
import { useT } from "./useT";

/**
 * Modal built on the native <dialog>: focus trap, Esc and inert background come from the browser.
 * Controlled with `open`. While `busy` the dialog cannot be dismissed (Esc, backdrop, close button).
 */
export default function Dialog({ open, onClose, title, description, children, actions, busy = false, lang }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Footer buttons. Put the primary action last; it ends up on top on phones. */
  actions?: ReactNode;
  busy?: boolean;
  lang?: Lang;
}) {
  const t = useT(lang);
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      aria-busy={busy || undefined}
      onClick={(e) => { if (e.target === ref.current && !busy) onClose(); }}
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClose={() => { if (open) onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="jk-h2">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t.uiClose} className={cx("-me-2 -mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted disabled:opacity-50", focusRing)}>
            <span aria-hidden>✕</span>
          </button>
        </div>
        {description && <p id={`${id}-desc`} className="text-muted">{description}</p>}
        {children}
        {actions && <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </dialog>
  );
}
