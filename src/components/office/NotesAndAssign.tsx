"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";
import { assignTo, currentAssignee, fetchMyId, fetchOfficeIssue, postNote, splitNotes } from "@/lib/office-api";

export default function NotesAndAssign({ cref }: { cref: string }) {
  return <QueryProvider><NotesInner cref={cref} /></QueryProvider>;
}

/**
 * Internal notes (office only) are a separate block from public replies, on purpose: a public reply is confirmed first because the
 * citizen sees it. Assignment is to yourself: the API has no staff directory yet, so assigning to a colleague is a backend gap.
 */
function NotesInner({ cref }: { cref: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["office-issue", cref], queryFn: () => fetchOfficeIssue(cref) });
  const me = useQuery({ queryKey: ["my-id"], queryFn: fetchMyId, staleTime: Infinity });
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [confirmReply, setConfirmReply] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["office-issue", cref] });
  const fail = (e: unknown) => toast("error", e instanceof ApiError && e.status === 403 ? t.ofToastForbidden : t.ofToastFail);

  const addNote = useMutation({ mutationFn: () => postNote(cref, note, false), onSuccess: () => { setNote(""); refresh(); }, onError: fail });
  const addReply = useMutation({ mutationFn: () => postNote(cref, reply, true), onSuccess: () => { setReply(""); setConfirmReply(false); toast("success", t.cpReplySent); refresh(); }, onError: (e) => { setConfirmReply(false); fail(e); } });
  const assign = useMutation({ mutationFn: () => assignTo(cref, me.data!), onSuccess: () => { toast("success", t.cpAssignedToMe); refresh(); }, onError: fail });

  const events = detail.data?.events ?? [];
  const { internal, publicReplies } = splitNotes(events);
  const assignee = detail.data ? currentAssignee(detail.data.assignments) : undefined;
  const mine = !!assignee && assignee === me.data;

  return (
    <div className="space-y-4">
      <Card title={t.cpAssignTitle}>
        <div className="space-y-3">
          {detail.isError && <p role="alert" className="text-sm">{t.ofToastFail}</p>}
          <p role="status" className="text-sm">{mine ? t.cpAssignedYou : assignee ? t.cpAssignedOther : t.odUnassignedLabel}</p>
          <Button variant="secondary" loading={assign.isPending} disabled={mine || !me.data} onClick={() => assign.mutate()}>{t.cpAssignMe}</Button>
          <p className="text-xs text-muted">{t.cpAssignNote}</p>
        </div>
      </Card>

      <Card tone="warning" title={<><span aria-hidden>🔒 </span>{t.cpNotesTitle}</>}>
        <p className="mb-2 text-sm">{t.cpNotesHint}</p>
        {internal.length === 0 ? <p className="text-sm text-muted">{t.cpNoteEmpty}</p> : (
          <ul className="mb-3 space-y-2">{internal.map((n) => <li key={n.created_at} className="rounded-lg bg-white p-2"><p className="whitespace-pre-wrap break-words">{n.internal_note}</p><p className="text-xs text-muted">{fmtDate(n.created_at, lang)}</p></li>)}</ul>
        )}
        <Textarea label={t.cpNoteLabel} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-2"><Button variant="secondary" loading={addNote.isPending} disabled={note.trim().length < 3} onClick={() => addNote.mutate()}>{t.cpNoteAdd}</Button></div>
      </Card>

      <Card title={t.cpPublicTitle}>
        {publicReplies.length === 0 ? <p className="text-sm text-muted">{t.cpPublicEmpty}</p> : (
          <ul className="mb-3 space-y-2">{publicReplies.map((r) => <li key={r.created_at}><p className="whitespace-pre-wrap break-words">{r.public_message}</p><p className="text-xs text-muted">{fmtDate(r.created_at, lang)}</p></li>)}</ul>
        )}
        <Textarea label={t.cpReplyLabel} rows={4} maxLength={1000} hint={t.cpPublicWarn} value={reply} onChange={(e) => setReply(e.target.value)} />
        <div className="mt-2"><Button disabled={reply.trim().length < 10} onClick={() => setConfirmReply(true)}>{t.cpReplySend}</Button></div>
      </Card>

      <Dialog open={confirmReply} onClose={() => setConfirmReply(false)} title={t.cpReplyConfirmTitle} description={t.cpReplyConfirmBody}
        actions={<><Button variant="ghost" onClick={() => setConfirmReply(false)}>{t.cpCancel}</Button><Button loading={addReply.isPending} onClick={() => addReply.mutate()}>{t.cpReplySend}</Button></>}>
        <Card tone="info" padded><p className="whitespace-pre-wrap break-words">{reply}</p></Card>
      </Dialog>
    </div>
  );
}
