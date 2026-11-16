import type { ReactNode } from "react";
import State from "./State";

/** Empty list / no search results block. Compact by default and uses h2 so it can sit inside a page. */
export default function EmptyState({ variant = "empty", title, body, action, compact = true }: {
  variant?: "empty" | "noResults" | "officeEmpty";
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return <State kind={variant} as="h2" title={title} body={body} compact={compact}>{action}</State>;
}
