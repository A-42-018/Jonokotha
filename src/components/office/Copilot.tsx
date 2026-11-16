"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/format";
import { safeHref } from "@/lib/safe";
import { missingInfo, templateReply, type CopilotItem, type CopilotLog, type Decision } from "@/lib/office";
import type { Agency, CaseRecord } from "@/lib/types";

const LOG_KEY = "jonokotha:copilot-log:v1";
const NO_LOG: CopilotLog[] = [];
const REPLY_KEY = "jonokotha:office-replies:v1";
const NO_REPLIES: Record<string, { text: string; at: string }[]> = {};

type Dict = ReturnType<typeof useT>;
function Block({ t, title, decision, onDecide, onEdit, children }: { t: Dict; title: string; decision?: Decision; onDecide: (d: Decision) => void; onEdit?: () => void; children: ReactNode }) {
  return (
    <div className={`space-y-2 ${decision === "dismissed" ? "opacity-60" : ""}`}>
      <h3 className="font-medium">{title}</h3>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => onDecide("accepted")}>{t.cpAccept}</Button>
        {onEdit && <Button variant="secondary" onClick={() => { onEdit(); onDecide("edited"); }}>{t.cpEdit}</Button>}
        <Button variant="ghost" onClick={() => onDecide("dismissed")}>{t.cpDismiss}</Button>
        {decision && <Badge tone={decision === "dismissed" ? "neutral" : "success"} icon={decision === "dismissed" ? "✕" : "✓"}>{t[`cpDecision_${decision}` as keyof typeof t] as string}</Badge>}
      </div>
    </div>
  );
}

/**
 * Full AI copilot panel (staff only). Every item has Accept / Edit / Dismiss and the decision is logged.
 * Nothing here changes a case: only the staff action buttons do. Summary, similar cases and routing come from the API;
 * missing-info is a rule check; the reply draft is a template until the AI draft endpoint exists.
 */
export default function Copilot({ c, agency, onAskInfo }: { c: CaseRecord; agency?: Agency; onAskInfo?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [log, setLog] = useLocalValue(LOG_KEY, NO_LOG);
  const [replies, setReplies] = useLocalValue(REPLY_KEY, NO_REPLIES);
  const [draft, setDraft] = useState(() => templateReply(c, lang));
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const mine = log.filter((l) => l.ref === c.ref);
  const decision = (item: CopilotItem) => mine.filter((l) => l.item === item).at(-1)?.decision;
  const record = (item: CopilotItem, d: Decision) => setLog([...log, { ref: c.ref, item, decision: d, at: new Date().toISOString() }]);
  const pct = Math.round(c.ai.confidence * 100);
  const missing = missingInfo(c);

  const B = (item: CopilotItem, title: string, edit?: () => void) => ({ t, title, decision: decision(item), onDecide: (d: Decision) => record(item, d), onEdit: edit });

  function publish() {
    if (draft.trim().length < 10) { setErr(t.cpReplyTooShort); setConfirm(false); return; }
    setErr("");
    setReplies({ ...replies, [c.ref]: [...(replies[c.ref] ?? []), { text: draft.trim(), at: new Date().toISOString() }] });
    toast("success", t.cpReplySent);
    setConfirm(false);
  }

  return (
    <section aria-labelledby="cp-h" className="space-y-5 rounded-xl border border-teal/40 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cp-h" className="font-semibold text-teal-strong"><span aria-hidden>✨ </span>{t.cpTitle2}</h2>
        <Badge tone="warning" icon="🔒">{t.ofStaffOnly}</Badge>
      </div>
      <p className="-mt-3 text-xs text-muted">{t.ofStaffOnlyHint} {t.cpHuman}</p>

      <Block {...B("summary", t.aiSummary)}>
        <p>{c.ai.summary || <span className="text-sm text-muted">{t.noAiSummary}</span>}</p>
      </Block>

      <Block {...B("missing", t.cpMissingTitle)}>
        {missing.length === 0 ? <p className="text-sm text-muted">{t.cpMissingNone}</p> : (
          <ul className="list-disc space-y-1 ps-5">{missing.map((m) => <li key={m}>{t[`cpMissing_${m}` as keyof typeof t] as string}</li>)}</ul>
        )}
        {missing.length > 0 && onAskInfo}
      </Block>

      <Block {...B("similar", t.similar)}>
        {c.ai.similarRefs.length ? (
          <ul className="flex flex-wrap gap-2">{c.ai.similarRefs.map((r) => (
            <li key={r}><Link href={`/office/${r}`} className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-civic underline">{r}</Link></li>
          ))}</ul>
        ) : <p className="text-sm text-muted">{t.noSimilar}</p>}
      </Block>

      <Block {...B("routing", t.routing)}>
        {agency ? (
          <>
            <p>{lang === "bn" ? agency.nameBn : agency.nameEn}</p>
            <p className="text-xs text-muted">{t.source}: {safeHref(agency.url) ? <a href={safeHref(agency.url)} className="underline" target="_blank" rel="noreferrer">{agency.source}</a> : agency.source}{agency.checkedAt ? ` (${agency.checkedAt})` : ""} · {t.confidence}: {pct}%</p>
          </>
        ) : <p className="text-xs text-muted">{t.confidence}: {pct}%</p>}
      </Block>

      <Block {...B("reply", t.cpReplyTitle, () => setEditing(true))}>
        <Badge tone="warning">{t.exSample}</Badge>
        <p className="text-xs text-muted">{t.cpReplyNote}</p>
        <Textarea label={t.cpReplyLabel} rows={5} maxLength={2000} value={draft} readOnly={!editing} error={err} onChange={(e) => { setDraft(e.target.value); setErr(""); }} />
        <div className="flex flex-wrap gap-2">
          {!editing && <Button variant="secondary" onClick={() => setEditing(true)}>{t.cpEdit}</Button>}
          <Button onClick={() => setConfirm(true)}>{t.cpReplySend}</Button>
        </div>
        <p className="text-xs text-muted">{t.cpReplyLocal}</p>
      </Block>

      <div className="space-y-1 border-t border-line/30 pt-3">
        <h3 className="font-medium">{t.cpLog}</h3>
        {mine.length === 0 ? <p className="text-sm text-muted">{t.cpLogEmpty}</p> : (
          <ul className="space-y-1 text-sm">{mine.map((l, i) => <li key={i}>{t[`cpItem_${l.item}` as keyof typeof t] as string}: {t[`cpDecision_${l.decision}` as keyof typeof t] as string} · {fmtDate(l.at, lang)}</li>)}</ul>
        )}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t.cpReplyConfirmTitle} description={t.cpReplyConfirmBody}
        actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t.cpCancel}</Button><Button onClick={publish}>{t.cpReplySend}</Button></>}>
        <Card tone="info" padded><p className="whitespace-pre-wrap break-words">{draft}</p></Card>
      </Dialog>
    </section>
  );
}
