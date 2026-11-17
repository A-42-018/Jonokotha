"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchThread } from "@/lib/ask-api";
import { fmtDate } from "@/lib/format";
import { fetchMyId } from "@/lib/office-api";
import { assignQuestion, fetchOfficeQuestions, replyToQuestion, type OfficeQuestion } from "@/lib/office-workspace-api";
import Boundary, { label, saveError } from "./Boundary";

export default function QuestionsInbox() {
  return <QueryProvider><Inner /></QueryProvider>;
}

function Inner() {
  const t = useT();
  const q = useQuery({ queryKey: ["office-questions"], queryFn: fetchOfficeQuestions, retry: false });
  const me = useQuery({ queryKey: ["my-id"], queryFn: fetchMyId, retry: false });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t.owQAssignOther}</p>
      <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.owQEmpty}>
        {(rows) => <ul className="space-y-3">{rows.map((r) => <li key={r.ref}><Item q={r} myId={me.data} /></li>)}</ul>}
      </Boundary>
    </div>
  );
}

function Item({ q, myId }: { q: OfficeQuestion; myId?: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const mine = !!myId && q.assigned_to === myId;
  const owner = !q.assigned_to ? t.owQUnassigned : mine ? t.owQAssignedMe : t.owQAssignedOther;
  const thread = useQuery({ queryKey: ["office-thread", q.ref], queryFn: () => fetchThread(q.ref), enabled: open, retry: false });
  const assign = useMutation({
    mutationFn: () => assignQuestion(q.ref, mine ? null : myId!),
    onSuccess: () => { toast("success", t.owSaved); void qc.invalidateQueries({ queryKey: ["office-questions"] }); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  const reply = useMutation({
    mutationFn: () => replyToQuestion(q.ref, text, key),
    onSuccess: () => { toast("success", t.owSaved); setText(""); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-thread", q.ref] }); void qc.invalidateQueries({ queryKey: ["office-questions"] }); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  const canAssign = !!myId && (mine || !q.assigned_to);
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{q.status}</Badge>
        <Badge>{owner}</Badge>
        <span className="text-sm text-muted">{fmtDate(q.last_message_at, lang)}</span>
      </div>
      <h2 className="text-lg font-semibold">{q.title}</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{t.owQOpen}<span className="sr-only">: {q.title}</span></Button>
        {canAssign && <Button variant="secondary" disabled={assign.isPending} onClick={() => assign.mutate()}>{mine ? t.owQUnassign : t.owQAssignMe}</Button>}
      </div>
      {open && (
        <div className="space-y-3 border-t border-line pt-3">
          <p className="whitespace-pre-line">{q.body}</p>
          <Boundary q={thread} emptyTitle={t.owQEmpty}>
            {(d) => d.messages.length > 0 && (
              <section aria-label={t.owQThread}>
                <h3 className="font-medium">{t.owQThread}</h3>
                <ul className="space-y-2">{d.messages.map((m, i) => (
                  <li key={i} className="rounded-xl bg-slate-50 p-2 text-sm"><span className="font-medium">{label(t, "owQMessageBy_", m.author_kind)}:</span> {m.body}</li>
                ))}</ul>
              </section>
            )}
          </Boundary>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length < 10) { setErr(t.owQReplyShort); return; } setErr(""); reply.mutate(); }}>
            <Textarea label={t.owQReply} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} error={err || undefined} />
            <p className="text-sm text-muted">{t.owPublicWarn}</p>
            <Button type="submit" disabled={reply.isPending}>{t.owQReplySend}</Button>
          </form>
        </div>
      )}
    </article>
  );
}
