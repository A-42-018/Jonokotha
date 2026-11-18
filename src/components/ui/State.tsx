import type { ReactNode } from "react";
import { buttonClass } from "./Button";

export type StateKind = "error" | "notFound" | "noAccess" | "offline" | "maintenance" | "empty" | "officeEmpty" | "noResults" | "expired";

const ART: Record<StateKind, string> = {
  error: "state-error",
  notFound: "state-not-found",
  noAccess: "state-no-access",
  expired: "state-no-access",
  offline: "state-offline",
  maintenance: "state-maintenance",
  empty: "empty-no-reports",
  officeEmpty: "office-empty-inbox",
  noResults: "empty-no-results",
};

/** Centered message block with an illustration. Strings come from the caller (i18n). */
export default function State({ kind, title, body, children, compact = false, live, as: Heading = "h1" }: {
  kind: StateKind;
  as?: "h1" | "h2";
  title: string;
  body?: string;
  children?: ReactNode;
  compact?: boolean;
  live?: "polite" | "assertive";
}) {
  return (
    <section role={live === "assertive" ? "alert" : live ? "status" : undefined} className={`mx-auto flex max-w-md flex-col items-center text-center ${compact ? "gap-2 py-4" : "gap-3 py-8"}`}>
      {/* width/height reserve the square box (no layout shift); lazy stops React from emitting an unused preload hint for the not-found art on every page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/illustrations/${ART[kind]}.svg`} alt="" width={1024} height={1024} loading="lazy" className={compact ? "w-32" : "w-48 sm:w-56"} />
      <Heading className={Heading === "h1" ? "jk-h1" : "jk-h2"}>{title}</Heading>
      {body && <p className="text-muted">{body}</p>}
      {children && <div className="mt-2 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row">{children}</div>}
    </section>
  );
}

/** Class strings for links styled as buttons. Prefer `buttonClass()` / `<Button>` in new code. */
export const btnPrimary = buttonClass({ variant: "primary" });
export const btnSecondary = buttonClass({ variant: "secondary" });
