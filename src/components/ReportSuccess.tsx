"use client";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import Button, { buttonClass } from "./ui/Button";
import Card from "./ui/Card";
import { useToast } from "./ui/Toast";

export default function ReportSuccess({ t, refId, onAnother }: { t: Dict; refId: string; onAnother: () => void }) {
  const toast = useToast();

  const url = () => `${window.location.origin}/issue/${refId}`;

  async function copy(kind: "ref" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "ref" ? refId : url());
      toast("success", t.copied);
    } catch {
      /* clipboard unavailable: the text stays selectable on screen */
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t.sentTitle, url: url() });
        return;
      } catch {
        /* cancelled or failed: fall back to copying */
      }
    }
    await copy("link");
  }

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/spot-report-sent.svg" alt="" className="mx-auto h-40 w-auto" />
      <h1 className="text-2xl font-semibold text-civic">{t.sentTitle}</h1>
      <p className="text-muted">{t.successBody}</p>
      <Card>
        <p className="text-sm text-muted">{t.refId}</p>
        <p className="select-all break-all text-2xl font-semibold tracking-wide text-civic">{refId}</p>
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={() => void copy("ref")}>{t.copyRef}</Button>
        <Button variant="secondary" onClick={() => void copy("link")}>{t.copyLink}</Button>
        <Button variant="secondary" onClick={() => void share()}>{t.shareLink}</Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`/issue/${refId}`} className={buttonClass()}>{t.viewReport}</Link>
        <Button variant="ghost" onClick={onAnother}>{t.reportAnother}</Button>
      </div>
    </div>
  );
}
