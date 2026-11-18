import type { ReactNode } from "react";
import State from "./State";

/** Empty list / no search results block. Compact by default and uses h2 so it can sit inside a page. */
export default function EmptyState({ variant = "empty", title, body, action, compact = true, as = "h2" }: {
  variant?: "empty" | "noResults" | "officeEmpty";
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
  /** Heading level: h1 when the empty state is the whole page (a missing record), h2 inside a page. */
  as?: "h1" | "h2";
}) {
  return <State kind={variant} as={as} title={title} body={body} compact={compact}>{action}</State>;
}
