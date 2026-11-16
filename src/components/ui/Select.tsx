"use client";
import { useId, type SelectHTMLAttributes } from "react";
import type { Lang } from "@/lib/i18n";
import { controlClass, FieldError, FieldHint, FieldLabel, fieldIds } from "./Field";
import { cx } from "./cx";
import { useT } from "./useT";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label: string;
  options: SelectOption[];
  /** Non-selectable first option, e.g. "Choose…". */
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  lang?: Lang;
};

export default function Select({ label, options, placeholder, hint, error, optional, lang, id, className, ...rest }: SelectProps) {
  const t = useT(lang);
  const auto = useId();
  const fid = id ?? auto;
  const { hintId, errorId, describedBy } = fieldIds(fid, { hint, error });
  return (
    <div>
      <FieldLabel htmlFor={fid} optional={optional ? t.uiOptional : undefined}>{label}</FieldLabel>
      <select id={fid} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx(controlClass(!!error), className)} {...rest}>
        {placeholder && <option value="" disabled={rest.required}>{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
      {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId} prefix={t.uiError}>{error}</FieldError>}
    </div>
  );
}
