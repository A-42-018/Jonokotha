"use client";
import Link from "next/link";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

export default function ReportSuccess({ t, refId, onAnother }: { t: Dict; refId: string; onAnother: () => void }) {
  const [copied, setCopied] = useState<"" | "ref" | "link">("");

  const url = () => `${window.location.origin}/issue/${refId}`;

  async function copy(kind: "ref" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "ref" ? refId : url());
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
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

  const btn = "inline-flex min-h-11 items-center justify-center rounded-lg border border-teal px-4 py-2 text-teal";
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/spot-report-sent.svg" alt="" className="mx-auto h-40 w-auto" />
      <h1 className="text-2xl font-semibold text-civic">{t.sentTitle}</h1>
      <p className="text-slate-600">{t.successBody}</p>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">{t.refId}</p>
        <p className="select-all break-all text-2xl font-semibold tracking-wide text-civic">{refId}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => copy("ref")} className={btn}>{t.copyRef}</button>
        <button type="button" onClick={() => copy("link")} className={btn}>{t.copyLink}</button>
        <button type="button" onClick={share} className={btn}>{t.shareLink}</button>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-leaf">{copied ? `✓ ${t.copied}` : ""}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`/issue/${refId}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-civic px-5 py-2 font-medium text-white">{t.viewReport}</Link>
        <button type="button" onClick={onAnother} className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2 text-civic underline">{t.reportAnother}</button>
      </div>
    </div>
  );
}
