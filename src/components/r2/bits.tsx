"use client";
import type { ReactNode } from "react";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import type { OrPlanned } from "@/lib/r11";

/** One toast for a failed write, chosen from the status and the server's rule code. Never shows the server's own text. */
export function useR2Fail() {
  const t = useT();
  const toast = useToast();
  return (e: unknown) => {
    const d = e instanceof ApiError ? `${e.code} ${e.fieldErrors._ ?? ""}` : "";
    const msg = !(e instanceof ApiError) ? t.r2Fail
      : /self_review/.test(d) ? t.r2MrSelfReview
      : /self_verification/.test(d) ? t.r2Self
      : e.status === 403 ? t.r2Denied
      : e.status === 429 || /limit/.test(d) ? t.r2AsDaily
      : e.status === 401 ? t.r2NoSignIn
      : t.r2Fail;
    toast("error", msg);
  };
}

/** "Not switched on" for a route the server does not offer; otherwise the children with the data. */
export function Gate<T>({ data, children }: { data: OrPlanned<T> | undefined; children: (d: T) => ReactNode }) {
  const t = useT();
  if (!data) return null;
  if (data.kind === "planned") return <PlannedPanel title={t.r2PlannedTitle} body={t.r2PlannedBody} />;
  return <>{children(data.data)}</>;
}

/** An external link that opens a new tab and names where it goes. Only https and http links are drawn. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//.test(href)) return <span className="break-all">{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className="break-words text-civic underline">{children}</a>;
}
