"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { FieldError, FieldHint, fieldIds } from "./Field";
import { cx } from "./cx";
import { useT } from "./useT";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label: ReactNode;
  hint?: string;
  invalid?: boolean;
};

/** One checkbox/radio row. The whole row is the 44px touch target; the native input is enlarged, not replaced. */
function Choice({ type, label, hint, invalid, id, className, ...rest }: ChoiceProps & { type: "checkbox" | "radio" }) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  return (
    <div className={cx("flex min-h-11 items-start gap-3 py-2", className)}>
      <input
        id={fid}
        type={type}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        className={cx(
          "mt-0.5 size-6 shrink-0 accent-civic",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "outline-2 outline-offset-1 outline-danger",
        )}
        {...rest}
      />
      <div>
        <label htmlFor={fid} className={cx("block cursor-pointer leading-6", rest.disabled && "cursor-not-allowed text-muted")}>{label}</label>
        {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
      </div>
    </div>
  );
}

export function Checkbox({ error, lang, ...props }: ChoiceProps & { error?: string; lang?: Lang }) {
  const t = useT(lang);
  const auto = useId();
  const fid = props.id ?? auto;
  const { errorId } = fieldIds(fid, { error });
  return (
    <div>
      <Choice type="checkbox" id={fid} invalid={!!error} aria-describedby={errorId} {...props} />
      {error && <FieldError id={errorId} prefix={t.uiError}>{error}</FieldError>}
    </div>
  );
}

export type RadioOption = { value: string; label: string; hint?: string; disabled?: boolean };

/** Radio group in a fieldset with a legend. Native arrow-key navigation comes from the shared `name`. */
export function RadioGroup({ legend, name, options, value, onChange, error, disabled, lang, defaultValue }: {
  legend: string;
  name: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  lang?: Lang;
}) {
  const t = useT(lang);
  const gid = useId();
  const errorId = error ? `${gid}-error` : undefined;
  return (
    <fieldset aria-describedby={errorId} aria-invalid={error ? true : undefined} disabled={disabled} className="min-w-0 border-0 p-0">
      <legend className="mb-1 p-0 font-medium">{legend}</legend>
      {options.map((o) => (
        <Choice
          key={o.value}
          type="radio"
          name={name}
          value={o.value}
          label={o.label}
          hint={o.hint}
          disabled={o.disabled}
          invalid={!!error}
          {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
          onChange={() => onChange?.(o.value)}
        />
      ))}
      {error && <FieldError id={errorId} prefix={t.uiError}>{error}</FieldError>}
    </fieldset>
  );
}
