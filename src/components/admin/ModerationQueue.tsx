"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { REASON_MIN, validReason } from "@/lib/admin";
import { actionsFor, fetchModerationQueue, moderate, type ModAction, type QueueItem } from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDate } from "@/lib/format";

export default function ModerationQueue() {
  return <QueryProvider><QueueInner /></QueryProvider>;
}

const keyOf = (i: QueueItem) => `${i.kind}:${i.target_type}:${i.target_ref}`;

/** Moderation queue from /admin/moderation. Every decision needs a reason and is audited by the server. The queue shows excerpts of public content only. */
function QueueInner() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["moderation"], queryFn: fetchModerationQueue });
  const [open, setOpen] = useState<{ item: QueueItem; action: ModAction } | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const label = (a: ModAction) => ({ hide: t.adActHide, dismiss: t.adActDismiss, publish: t.adActPublish, reject: t.adActReject }[a]);
  function close() { setOpen(null); setReason(""); setErr(""); }
  const decide = useMutation({
    mutationFn: () => moderate(open!.item, open!.action, reason),
    onSuccess: () => { toast("success", t.adDone); close(); void qc.invalidateQueries({ queryKey: ["moderation"] }); },
    onError: (e) => { close(); toast("error", e instanceof ApiError && e.status === 403 ? t.ofToastForbidden : t.ofToastFail); },
  });
  function confirm() {
    if (!validReason(reason)) { setErr(fillNum(t.adReasonRequired, { min: REASON_MIN }, lang)); return; }
    decide.mutate();
  }

  if (q.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (q.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
        <p>{q.error instanceof ApiError && q.error.status === 403 ? t.ofToastForbidden : t.adLoadError}</p>
        <Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-civic/30 bg-civic/5 p-3 text-sm font-medium">{t.adAiNeverDecides}</p>
      {q.data.length === 0 ? <EmptyState variant="officeEmpty" title={t.adEmptyTitle} body={t.adEmptyBody} /> : (
        <ul className="space-y-3">
          {q.data.map((i) => (
            <li key={keyOf(i)}>
              <Card as="article" className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={i.kind === "report" ? "warning" : "info"}>{t[`adKind_${i.kind}` as keyof typeof t] as string}</Badge>
                  <Badge tone="neutral">{t[`adType_${i.target_type}` as keyof typeof t] as string}</Badge>
                  <span className="text-sm text-muted">{i.target_ref}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{i.excerpt ?? t.adNoExcerpt}</p>
                <p className="text-sm text-muted">{fmtDate(i.oldest, lang)}</p>
                {i.kind === "report" && (
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{t.adRisk}:</span>
                    {i.reasons.map((r) => <Badge key={r} tone="warning" icon="⚠">{t[`adRC_${r}` as keyof typeof t] as string ?? r}</Badge>)}
                    <span className="text-sm">{fillNum(t.adReportCount, { n: i.report_count }, lang)}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {actionsFor(i.kind).map((a) => <Button key={a} variant={a === "publish" ? "success" : a === "reject" || a === "hide" ? "danger" : "secondary"} onClick={() => setOpen({ item: i, action: a })}>{label(a)}</Button>)}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!open} onClose={() => !decide.isPending && close()} busy={decide.isPending} title={fillNum(t.adDialogTitle, { action: open ? label(open.action) : "" }, lang)} description={t.adDialogBody}
        actions={<><Button variant="ghost" disabled={decide.isPending} onClick={close}>{t.adCancel}</Button><Button loading={decide.isPending} onClick={confirm}>{t.adConfirm}</Button></>}>
        <Textarea label={t.adReason} rows={3} maxLength={500} value={reason} error={err} onChange={(e) => { setReason(e.target.value); setErr(""); }} />
      </Dialog>
    </div>
  );
}
