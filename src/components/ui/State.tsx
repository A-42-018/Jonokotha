import type { ReactNode } from "react";

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/illustrations/${ART[kind]}.svg`} alt="" className={compact ? "w-32" : "w-48 sm:w-56"} />
      <Heading className="text-2xl font-semibold text-civic">{title}</Heading>
      {body && <p className="text-slate-600">{body}</p>}
      {children && <div className="mt-2 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row">{children}</div>}
    </section>
  );
}

export const btnPrimary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-civic px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";
export const btnSecondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-civic px-5 font-medium text-civic focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";

/** Grey pulsing block for loading skeletons. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none ${className}`} />;
}
