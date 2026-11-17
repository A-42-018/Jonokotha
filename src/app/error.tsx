"use client";
import Link from "next/link";
import { useEffect } from "react";
import State, { btnPrimary, btnSecondary } from "@/components/ui/State";
import { useT } from "@/components/ui/useT";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <State kind="error" title={t.stErrorTitle} body={t.stErrorBody} live="assertive">
      <button type="button" onClick={() => retry()} className={btnPrimary}>{t.stRetry}</button>
      <Link href="/" className={btnSecondary}>{t.stGoHome}</Link>
    </State>
  );
}
