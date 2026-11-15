import type { ReactNode } from "react";
import { cx } from "./cx";

/** Ids that tie a control to its label, hint and error text. */
export function fieldIds(id: string, { hint, error }: { hint?: string; error?: string }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return { hintId, errorId, describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined };
}

/** Shared base for text-like controls: 44px min height, 4.5:1 border, red border plus message on error. */
export const controlClass = (invalid: boolean) =>
  cx(
    "block w-full min-h-11 rounded-lg border bg-white px-3 py-2 text-base text-foreground placeholder:text-muted",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-civic",
    "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted",
    invalid ? "border-danger border-2" : "border-line",
  );

export function FieldLabel({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block font-medium">
      {children}
      {optional && <span className="ms-2 text-sm font-normal text-muted">({optional})</span>}
    </label>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return <p id={id} className="mt-1 text-sm text-muted">{children}</p>;
}

/** Error text: icon and words, never colour alone. `prefix` is a screen-reader-only "Error:" label. */
export function FieldError({ id, children, prefix }: { id?: string; children: ReactNode; prefix?: string }) {
  return (
    <p id={id} data-field-error className="mt-1 flex items-start gap-1 text-sm font-medium text-danger">
      <span aria-hidden>⚠</span>
      <span>{prefix && <span className="sr-only">{prefix} </span>}{children}</span>
    </p>
  );
}
