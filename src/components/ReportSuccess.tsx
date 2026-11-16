"use client";
import Link from "next/link";
import { useState } from "react";
import { fillNum } from "@/lib/format";
import { uploadPhotosTracked } from "@/lib/report-api";
import type { Dict, Lang } from "@/lib/i18n";
import type { Emergency } from "@/lib/types";
import Button, { buttonClass } from "./ui/Button";
import Card from "./ui/Card";
import { useShare } from "./ui/useShare";

export default function ReportSuccess({ t, lang, refId, failedPhotos = [], emergency, onAnother }: { t: Dict; lang: Lang; refId: string; failedPhotos?: { blob: Blob; caption: string }[]; emergency?: Emergency; onAnother: () => void }) {
  // Photos that did not go through are kept in memory; the retry sends exactly those and says how many are still left.
  const [left, setLeft] = useState(failedPhotos);
  const [retrying, setRetrying] = useState(false);
  const [allSent, setAllSent] = useState(false);
  async function retry() {
    setRetrying(true);
    const still = await uploadPhotosTracked(refId, left);
    setLeft(still);
    setAllSent(still.length === 0);
    setRetrying(false);
  }
  const { copy, copyLink, share } = useShare(t, `/issue/${refId}`, t.sentTitle);

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/spot-report-sent.svg" alt="" className="mx-auto h-40 w-auto" />
      {emergency && (
        // Fixed guidance from the server, shown as given and above everything else (docs/api-v1.md, imminent harm).
        <div role="alert" className="rounded-xl border-2 border-danger bg-white p-4 text-start">
          <p className="font-semibold text-danger">{emergency.guidance[lang]}</p>
          <p className="mt-1 text-lg font-semibold">{emergency.numbers.join(" · ")}</p>
        </div>
      )}
      <h1 className="text-2xl font-semibold text-civic">{t.sentTitle}</h1>
      <p className="text-muted">{t.successBody}</p>
      {left.length > 0 && (
        <div role="status" className="space-y-2 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
          <p>{t.sentPhotosFailed}</p>
          <p>{fillNum(t.rxRetryLeft, { n: left.length }, lang)}</p>
          <Button variant="secondary" loading={retrying} onClick={() => void retry()}>{retrying ? t.rxRetrying : t.rxRetry}</Button>
        </div>
      )}
      {allSent && <p role="status" className="text-sm text-leaf-strong">{t.rxRetryDone}</p>}
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
