"use client";
import { useId, type InputHTMLAttributes } from "react";
import type { Lang } from "@/lib/i18n";
import { controlClass, FieldError, FieldHint, FieldLabel, fieldIds } from "./Field";
import { cx } from "./cx";
import { useT } from "./useT";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: string;
  /** When set the field is invalid: red border, icon, message, aria-invalid. */
  error?: string;
  /** Marks a non-required field as "(optional)". */
  optional?: boolean;
  lang?: Lang;
};

export default function Input({ label, hint, error, optional, lang, id, className, ...rest }: InputProps) {
  const t = useT(lang);
  const auto = useId();
  const fid = id ?? auto;
  const { hintId, errorId, describedBy } = fieldIds(fid, { hint, error });
  return (
    <div>
      <FieldLabel htmlFor={fid} optional={optional ? t.uiOptional : undefined}>{label}</FieldLabel>
      <input id={fid} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx(controlClass(!!error), className)} {...rest} />
      {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId} prefix={t.uiError}>{error}</FieldError>}
    </div>
  );
}
