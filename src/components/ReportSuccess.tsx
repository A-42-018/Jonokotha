"use client";
import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";
import type { Emergency } from "@/lib/types";
import Button, { buttonClass } from "./ui/Button";
import Card from "./ui/Card";
import { useShare } from "./ui/useShare";

export default function ReportSuccess({ t, lang, refId, photosFailed = 0, emergency, onAnother }: { t: Dict; lang: Lang; refId: string; photosFailed?: number; emergency?: Emergency; onAnother: () => void }) {
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
      {photosFailed > 0 && <p role="status" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.sentPhotosFailed}</p>}
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
