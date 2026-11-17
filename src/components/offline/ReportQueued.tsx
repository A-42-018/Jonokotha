"use client";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import Button, { buttonClass } from "@/components/ui/Button";

/** Shown instead of the success screen when the report was saved on the phone because there was no signal. */
export default function ReportQueued({ t, onAnother }: { t: Dict; onAnother: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/state-offline.svg" alt="" className="mx-auto h-40 w-auto" />
      <div role="status" className="space-y-4">
        <h1 className="jk-h1">{t.qSavedTitle}</h1>
        <p className="text-muted">{t.qSavedBody}</p>
      </div>
      <p className="text-sm text-muted">{t.qSavedNote}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/me" className={buttonClass()}>{t.qViewQueue}</Link>
        <Button variant="ghost" onClick={onAnother}>{t.reportAnother}</Button>
      </div>
    </div>
  );
}
