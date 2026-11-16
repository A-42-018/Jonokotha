"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDate } from "@/lib/i18n";
import { SAMPLE_STAFF } from "@/lib/office";
import { ASSIGN_KEY } from "./CaseTable";

const NOTES_KEY = "jonokotha:office-notes:v1";
const ESC_KEY = "jonokotha:office-escalations:v1";
const NO_NOTES: Record<string, { text: string; at: string }[]> = {};
const NO_ASSIGN: Record<string, string> = {};
const NO_ESC: Record<string, { reason: string; at: string }[]> = {};
const REPLY_KEY = "jonokotha:office-replies:v1";

/**
 * Internal notes (office only) are a separate block from public replies, on purpose.
 * Assignment and escalation (reason required). All device-local until the API has these endpoints.
 */
export default function NotesAndAssign({ cref }: { cref: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [notes, setNotes] = useLocalValue(NOTES_KEY, NO_NOTES);
  const [assign, setAssign] = useLocalValue(ASSIGN_KEY, NO_ASSIGN);
  const [esc, setEsc] = useLocalValue(ESC_KEY, NO_ESC);
  const [replies] = useLocalValue<Record<string, { text: string; at: string }[]>>(REPLY_KEY, NO_NOTES);
  const [note, setNote] = useState("");
  const [who, setWho] = useState(assign[cref] ?? "");
  const [dlg, setDlg] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const current = SAMPLE_STAFF.find((s) => s.id === assign[cref]);

  function close() { setDlg(false); setReason(""); setErr(""); }
  function escalate() {
    if (reason.trim().length < 10) { setErr(t.cpReasonRequired); return; }
    setEsc({ ...esc, [cref]: [...(esc[cref] ?? []), { reason: reason.trim(), at: new Date().toISOString() }] });
    toast("success", fillNum(t.cpEscalated, { reason: reason.trim() }, lang));
    close();
  }

  return (
    <div className="space-y-4">
      <Card title={t.cpAssignTitle}>
        <div className="space-y-3">
          <Select label={t.cpAssignLabel} placeholder={t.odBulkPick} value={who} onChange={(e) => setWho(e.target.value)} options={SAMPLE_STAFF.map((s) => ({ value: s.id, label: s.name }))} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!who || who === assign[cref]} onClick={() => { setAssign({ ...assign, [cref]: who }); toast("success", t.odBulkDone.replace("{n}", "1")); }}>{t.cpAssignSave}</Button>
            <Button variant="secondary" onClick={() => setDlg(true)}>{t.cpEscalate}</Button>
          </div>
          {current && <p role="status" className="text-sm">{fillNum(t.cpAssigned, { name: current.name }, lang)}</p>}
          {(esc[cref] ?? []).map((e) => <p key={e.at} className="text-sm text-muted">⚑ {fillNum(t.cpEscalated, { reason: e.reason }, lang)} · {fmtDate(e.at, lang)}</p>)}
          <p className="text-xs text-muted">{t.odAssignLocal}</p>
        </div>
      </Card>

      <Card tone="warning" title={<><span aria-hidden>🔒 </span>{t.cpNotesTitle}</>}>
        <p className="mb-2 text-sm">{t.cpNotesHint}</p>
        {(notes[cref] ?? []).length === 0 ? <p className="text-sm text-muted">{t.cpNoteEmpty}</p> : (
          <ul className="mb-3 space-y-2">{(notes[cref] ?? []).map((n) => <li key={n.at} className="rounded-lg bg-white p-2"><p className="whitespace-pre-wrap break-words">{n.text}</p><p className="text-xs text-muted">{fmtDate(n.at, lang)}</p></li>)}</ul>
        )}
        <Textarea label={t.cpNoteLabel} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-2"><Button variant="secondary" disabled={note.trim().length < 3} onClick={() => { setNotes({ ...notes, [cref]: [...(notes[cref] ?? []), { text: note.trim(), at: new Date().toISOString() }] }); setNote(""); }}>{t.cpNoteAdd}</Button></div>
      </Card>

      <Card title={t.cpPublicTitle}>
        {(replies[cref] ?? []).length === 0 ? <p className="text-sm text-muted">{t.cpPublicEmpty}</p> : (
          <ul className="space-y-2">{(replies[cref] ?? []).map((r) => <li key={r.at}><p className="whitespace-pre-wrap break-words">{r.text}</p><p className="text-xs text-muted">{fmtDate(r.at, lang)}</p></li>)}</ul>
        )}
      </Card>

      <Dialog open={dlg} onClose={close} title={t.cpEscalateTitle} description={t.cpEscalateBody}
        actions={<><Button variant="ghost" onClick={close}>{t.cpCancel}</Button><Button onClick={escalate}>{t.cpEscalateSend}</Button></>}>
        <Textarea label={t.cpEscalateReason} rows={3} maxLength={500} value={reason} error={err} onChange={(e) => { setReason(e.target.value); setErr(""); }} />
      </Dialog>
    </div>
  );
}
