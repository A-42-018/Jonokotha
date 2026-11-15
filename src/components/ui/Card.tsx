import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

export type CardTone = "default" | "info" | "warning" | "danger";

const TONE: Record<CardTone, string> = {
  default: "border-slate-200 bg-white",
  info: "border-civic/30 bg-civic/5",
  warning: "border-amber/60 bg-amber/10",
  danger: "border-danger/40 bg-danger/5",
};

/** Surface with optional title. `as` picks the element (section, li, article…); `title` renders in `headingAs`. */
export default function Card({ as, title, headingAs: Heading = "h2", tone = "default", padded = true, className, children }: {
  as?: ElementType;
  title?: ReactNode;
  headingAs?: "h2" | "h3" | "h4";
  tone?: CardTone;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const Tag = as ?? "div";
  return (
    <Tag className={cx("rounded-2xl border shadow-sm", TONE[tone], padded && "p-4 sm:p-5", className)}>
      {title && <Heading className="mb-2 text-lg font-semibold text-civic">{title}</Heading>}
      {children}
    </Tag>
  );
}
