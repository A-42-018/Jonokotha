import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

export type CardTone = "default" | "info" | "warning" | "danger";

const TONE: Record<CardTone, string> = {
  default: "jk-card",
  info: "border border-civic/30 bg-civic/5 shadow-sm",
  warning: "border border-amber/60 bg-amber/10 shadow-sm",
  danger: "border border-danger/40 bg-danger/5 shadow-sm",
};

/** Surface with optional title. `as` picks the element (section, li, article…); `title` renders in `headingAs`. */
export default function Card({ as, id, title, headingAs: Heading = "h2", tone = "default", padded = true, className, children }: {
  as?: ElementType;
  id?: string;
  title?: ReactNode;
  headingAs?: "h2" | "h3" | "h4";
  tone?: CardTone;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const Tag = as ?? "div";
  return (
    <Tag id={id} className={cx("rounded-2xl", TONE[tone], padded && "p-4 sm:p-5", className)}>
      {title && <Heading className="jk-h3 mb-2">{title}</Heading>}
      {children}
    </Tag>
  );
}
