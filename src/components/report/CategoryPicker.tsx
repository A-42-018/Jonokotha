"use client";
import { useId, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import { CATEGORIES, type Category } from "@/lib/types";
import { FieldError } from "../ui/Field";
import { cx } from "../ui/cx";

/** Category tiles with the cat-* illustrations. A native radio group: arrow keys, one tab stop, whole tile is the target. */
export default function CategoryPicker({ t, value, onChange, error, badge }: {
  t: Dict;
  value: Category | undefined;
  onChange: (c: Category) => void;
  error?: string;
  badge?: ReactNode;
}) {
  const gid = useId();
  const errorId = error ? `${gid}-error` : undefined;
  return (
    <fieldset aria-describedby={errorId} className="min-w-0 border-0 p-0">
      <legend className="mb-2 flex w-full flex-wrap items-center gap-2 p-0 font-medium">
        <span>{t.fCategory}</span>
        {badge}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {CATEGORIES.map((c) => (
          <label
            key={c}
            className={cx(
              "group relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 bg-white p-2 text-center",
              "border-line has-[:checked]:border-civic has-[:checked]:bg-civic/10",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-civic",
              error && "border-danger",
            )}
          >
            <input
              type="radio"
              name={`${gid}-category`}
              value={c}
              checked={value === c}
              onChange={() => onChange(c)}
              className="sr-only"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/illustrations/cat-${c}.svg`} alt="" width={56} height={56} className="size-14" />
            <span className={cx("font-medium", value === c ? "text-civic" : "text-foreground")}>{t.cats[c]}</span>
            <span
              aria-hidden
              className="absolute end-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-civic text-xs text-white opacity-0 group-has-[:checked]:opacity-100"
            >
              ✓
            </span>
          </label>
        ))}
      </div>
      {error && <FieldError id={errorId} prefix={t.uiError}>{error}</FieldError>}
    </fieldset>
  );
}
