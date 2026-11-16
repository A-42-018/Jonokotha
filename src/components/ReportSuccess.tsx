"use client";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import Button, { buttonClass } from "./ui/Button";
import Card from "./ui/Card";
import { useShare } from "./ui/useShare";

export default function ReportSuccess({ t, refId, onAnother }: { t: Dict; refId: string; onAnother: () => void }) {
  const { copy, copyLink, share } = useShare(t, `/issue/${refId}`, t.sentTitle);

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/spot-report-sent.svg" alt="" className="mx-auto h-40 w-auto" />
      <h1 className="text-2xl font-semibold text-civic">{t.sentTitle}</h1>
      <p className="text-muted">{t.successBody}</p>
      <Card>
        <p className="text-sm text-muted">{t.refId}</p>
        <p className="select-all break-all text-2xl font-semibold tracking-wide text-civic">{refId}</p>
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={() => void copy(refId)}>{t.copyRef}</Button>
        <Button variant="secondary" onClick={() => void copyLink()}>{t.copyLink}</Button>
        <Button variant="secondary" onClick={() => void share()}>{t.shareLink}</Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`/issue/${refId}`} className={buttonClass()}>{t.viewReport}</Link>
        <Button variant="ghost" onClick={onAnother}>{t.reportAnother}</Button>
      </div>
    </div>
  );
}
