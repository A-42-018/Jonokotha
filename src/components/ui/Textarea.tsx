"use client";
import { useId, type TextareaHTMLAttributes } from "react";
import type { Lang } from "@/lib/i18n";
import { controlClass, FieldError, FieldHint, FieldLabel, fieldIds } from "./Field";
import { cx } from "./cx";
import { useT } from "./useT";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  lang?: Lang;
};

export default function Textarea({ label, hint, error, optional, lang, id, className, rows = 4, ...rest }: TextareaProps) {
  const t = useT(lang);
  const auto = useId();
  const fid = id ?? auto;
  const { hintId, errorId, describedBy } = fieldIds(fid, { hint, error });
  return (
    <div>
      <FieldLabel htmlFor={fid} optional={optional ? t.uiOptional : undefined}>{label}</FieldLabel>
      <textarea id={fid} rows={rows} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx(controlClass(!!error), "resize-y", className)} {...rest} />
      {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId} prefix={t.uiError}>{error}</FieldError>}
    </div>
  );
}
