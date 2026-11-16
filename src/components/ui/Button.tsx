import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, focusRing } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-civic text-white",
  secondary: "border border-civic bg-white text-civic",
  success: "bg-leaf-strong text-white",
  danger: "bg-danger text-white",
  ghost: "text-civic underline-offset-2 hover:underline",
};

/** Class string for anything that looks like a button (links included). Min height 44px. */
export function buttonClass({ variant = "primary", size = "md", full = false }: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean } = {}): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 font-medium",
    size === "lg" ? "min-h-12 text-lg" : "min-h-11",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant],
    full && "w-full",
    focusRing,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. Pass the "working…" label as children. */
  loading?: boolean;
  icon?: ReactNode;
};

export default function Button({ variant, size, full, loading = false, icon, disabled, type = "button", className, children, ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(buttonClass({ variant, size, full }), className)} {...rest}>
      {loading ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : icon}
      {children}
    </button>
  );
}
