"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import Dialog from "@/components/ui/Dialog";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { reportContent, type ReportReason } from "@/lib/engagement-api";

const REASONS = ["Spam", "Abuse", "Private", "False", "Other"] as const;
export type ReportType = "issue" | "idea" | "question";

/** "Report this" for public content, sent to moderation through `POST /api/v1/reports`. Signed-out visitors get a sign-in link. */
export default function ReportContent(props: { type: ReportType; refId: string; signedIn: boolean; next: string }) {
  return <QueryProvider><ReportInner {...props} /></QueryProvider>;
}

function ReportInner({ type, refId, signedIn, next }: { type: ReportType; refId: string; signedIn: boolean; next: string }) {
  const t = useT();
  const toast = useToast();
  const name = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const title = type === "issue" ? t.rcIssue : type === "idea" ? t.rcIdea : t.rcQuestion;
  const label: Record<(typeof REASONS)[number], string> = { Spam: t.isReasonSpam, Abuse: t.isReasonAbuse, Private: t.isReasonPrivate, False: t.isReasonFalse, Other: t.isReasonOther };

  function close() { setOpen(false); setReason(""); setNote(""); setError(""); }
  const send = useMutation({
    mutationFn: () => reportContent(type, refId, reason as ReportReason, note),
    onSuccess: () => { close(); toast("info", t.rcThanks); },
    onError: (e) => {
      close();
      toast("error", e instanceof ApiError && e.status === 409 ? t.rcAlready : e instanceof ApiError && e.status === 429 ? t.rcLimit : t.rcFail);
    },
  });

  if (!signedIn) {
    return <Link href={`/login?need=1&next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center text-sm text-civic underline">{t.rcSignIn}</Link>;
  }
  return (
    <>
      <Button variant="ghost" aria-label={`${t.rcButton}: ${title}`} onClick={() => setOpen(true)}>{t.rcButton}</Button>
      <Dialog
        open={open}
        onClose={close}
        title={title}
        description={t.isReportBody}
        actions={<>
          <Button variant="ghost" onClick={close}>{t.isReportCancel}</Button>
          <Button variant="danger" loading={send.isPending} onClick={() => { if (!reason) { setError(t.isReasonRequired); return; } send.mutate(); }}>{t.isReportSend}</Button>
        </>}
      >
        <RadioGroup legend={t.isReasonLegend} name={`report-reason-${name}`} value={reason} onChange={(v) => { setReason(v); setError(""); }} error={error}
          options={REASONS.map((r) => ({ value: r, label: label[r] }))} />
        <Textarea label={t.isReasonNote} optional rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Dialog>
    </>
  );
}
