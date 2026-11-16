"use client";
import Link from "next/link";
import { useEffect } from "react";
import State, { btnPrimary, btnSecondary } from "./State";
import { useT } from "./useT";

/** Error boundary body shared by route-level error.tsx files: the header and tab bar stay, only this page is replaced. */
export default function RouteError({ error, retry, hint, backHref = "/", backLabel }: {
  error: unknown;
  retry: () => void;
  hint: string;
  backHref?: string;
  backLabel?: string;
}) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <State kind="error" title={t.stErrorTitle} body={`${t.stErrorBody} ${hint}`} live="assertive">
      <button type="button" onClick={() => retry()} className={btnPrimary}>{t.stRetry}</button>
      <Link href={backHref} className={btnSecondary}>{backLabel ?? t.stGoHome}</Link>
    </State>
  );
}
