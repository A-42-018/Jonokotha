"use client";
import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { decide, type AuditRow, type ReviewItem, type ReviewKind } from "@/lib/admin";
import { fillNum, fmtDate } from "@/lib/format";

const AUDIT_KEY = "jonokotha:admin-audit:v1";
const NO_AUDIT: AuditRow[] = [];
const ACTIONS: Record<ReviewKind, string[]> = { verification: ["approve", "reject"], moderation: ["approve", "request_edit", "hide", "reject", "escalate"] };

/** Verification / moderation queue. Every action needs a reason and writes an audit row (device-local until the API exists). */
export default function ReviewQueue({ kind, items }: { kind: ReviewKind; items: ReviewItem[] }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [audit, setAudit] = useLocalValue(AUDIT_KEY, NO_AUDIT);
  const [open, setOpen] = useState<{ id: string; action: string } | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const decided = new Set(audit.map((a) => a.itemId));
  const label = (a: string) => ({ approve: t.adActApprove, reject: t.adActReject, request_edit: t.adActRequestEdit, hide: t.adActHide, escalate: t.adActEscalate }[a] ?? a);
  const list = items.filter((i) => i.kind === kind);
  const pending = list.filter((i) => !decided.has(i.id));
  const mine = audit.filter((a) => list.some((i) => i.id === a.itemId));

  function close() { setOpen(null); setReason(""); setErr(""); }
  function confirm() {
    if (!open) return;
    const row = decide(open.id, open.action, reason, new Date().toISOString());
    if (!row) { setErr(t.adReasonRequired); return; }
    setAudit([...audit, row]);
    toast("success", t.adDone);
    close();
  }

  return (
    <div className="space-y-4">
      {kind === "moderation" && <p className="rounded-xl border border-civic/30 bg-civic/5 p-3 text-sm font-medium">{t.adAiNeverDecides}</p>}
      {pending.length === 0 ? <EmptyState variant="officeEmpty" title={t.adEmptyTitle} body={t.adEmptyBody} /> : (
        <ul className="space-y-3">
          {pending.map((i) => (
            <li key={i.id}>
              <Card as="article" className="space-y-2">
                <h2 className="font-semibold">{lang === "bn" ? i.titleBn : i.titleEn}</h2>
                <p>{lang === "bn" ? i.detailBn : i.detailEn}</p>
                <p className="text-sm text-muted">{fmtDate(i.at, lang)}</p>
                {i.risks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{t.adRisk}:</span>
                    {i.risks.map((r) => <Badge key={r} tone="warning" icon="⚠">{t[`adRisk_${r}` as keyof typeof t] as string}</Badge>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {ACTIONS[kind].map((a) => <Button key={a} variant={a === "approve" ? "success" : a === "reject" ? "danger" : "secondary"} onClick={() => setOpen({ id: i.id, action: a })}>{label(a)}</Button>)}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby={`audit-${kind}`} className="space-y-2">
        <h2 id={`audit-${kind}`} className="font-semibold">{t.adAuditTitle}</h2>
        {mine.length === 0 ? <p className="text-muted">{t.adAuditEmpty}</p> : (
          <ul className="space-y-1 text-sm">{mine.map((a) => <li key={a.id}><b>{label(a.action)}</b> · {a.reason} · {fmtDate(a.at, lang)}</li>)}</ul>
        )}
        <p className="text-xs text-muted">{t.adAuditLocal}</p>
      </section>
      <Dialog open={!!open} onClose={close} title={fillNum(t.adDialogTitle, { action: open ? label(open.action) : "" }, lang)} description={t.adDialogBody}
        actions={<><Button variant="ghost" onClick={close}>{t.adCancel}</Button><Button onClick={confirm}>{t.adConfirm}</Button></>}>
        <Textarea label={t.adReason} rows={3} maxLength={500} value={reason} error={err} onChange={(e) => { setReason(e.target.value); setErr(""); }} />
      </Dialog>
    </div>
  );
}
