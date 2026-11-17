"use client";
import ReadAloud from "@/components/ui/ReadAloud";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fetchMyQuestions, fetchThread, postReply, type MyQuestion, type QuestionStatus } from "@/lib/ask-api";
import { fmtDate } from "@/lib/format";
import { newId } from "@/lib/offline-queue";

const TONE: Record<QuestionStatus, BadgeTone> = { pending_review: "warning", open: "info", answered: "success", closed: "neutral", hidden: "neutral" };

export default function AskInbox() {
  return <QueryProvider><InboxInner /></QueryProvider>;
}

/** Private inbox: your questions from /me/questions, with the office's replies and your follow-up messages. */
function InboxInner() {
  const t = useT();
  const lang = useLang();
  const list = useQuery({ queryKey: ["my-questions"], queryFn: fetchMyQuestions });
  const statusLabel = (s: QuestionStatus) => t[`askStatus_${s}` as keyof typeof t] as string;

  if (list.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (list.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
        <p>{list.error instanceof ApiError && list.error.status === 401 ? t.askNeedsSignIn : t.askLoadError}</p>
        <Button variant="secondary" onClick={() => void list.refetch()}>{t.exRetry}</Button>
      </div>
    );
  }
  if (list.data.length === 0) return <EmptyState title={t.askInboxEmptyTitle} body={t.askInboxEmptyBody} action={<Link href="/ask" className={buttonClass()}>{t.askBackAsk}</Link>} />;
  return (
    <ul className="space-y-3">
      {list.data.map((q) => (
        <li key={q.ref}>
          <Card as="article">
            <h2 className="font-semibold">{q.title}</h2>
            <p className="text-sm text-muted">{fmtDate(q.created_at, lang)}</p>
            <div className="my-2 flex flex-wrap gap-2">
              <Badge tone="neutral">{q.visibility === "private" ? t.askPrivateTag : t.askPublicTag}</Badge>
              <Badge tone={TONE[q.status]}>{statusLabel(q.status)}</Badge>
            </div>
            <Thread q={q} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Thread({ q }: { q: MyQuestion }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const key = useRef(newId());
  const thread = useQuery({ queryKey: ["question", q.ref], queryFn: () => fetchThread(q.ref), enabled: open });
  const reply = useMutation({
    mutationFn: () => postReply(q.ref, text, key.current),
    onSuccess: () => { setText(""); key.current = newId(); void qc.invalidateQueries({ queryKey: ["question", q.ref] }); void qc.invalidateQueries({ queryKey: ["my-questions"] }); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 429 ? t.askLimit : t.askSendFail),
  });
  const canReply = q.status === "open" || q.status === "answered";
  return (
    <div className="space-y-3">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t.askHideThread : t.askShowThread}</Button>
      {open && (
        <div className="space-y-3" aria-live="polite">
          {thread.isPending && <p role="status" className="text-sm text-muted">{t.exLoading}</p>}
          {thread.isError && <p role="alert" className="text-sm">{t.askLoadError}</p>}
          {thread.data && (
            <>
              <ol className="space-y-2">
                {[{ author_kind: "citizen" as const, body: thread.data.body, created_at: thread.data.created_at }, ...thread.data.messages].map((m, i) => (
                  <li key={i} className={m.author_kind === "office" ? "rounded-xl border border-civic/30 bg-civic/5 p-3" : "rounded-xl border border-line/40 p-3"}>
                    <p className="text-sm font-medium">{m.author_kind === "office" ? t.askFromOffice : t.askFromYou} · <span className="font-normal text-muted">{fmtDate(m.created_at, lang)}</span></p>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    {m.author_kind === "office" && <ReadAloud text={m.body} what={t.raWhatMessage} />}
                  </li>
                ))}
              </ol>
              {canReply ? (
                <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) reply.mutate(); }} className="space-y-2">
                  <Textarea label={t.askReplyLabel} rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
                  <Button type="submit" loading={reply.isPending} disabled={!text.trim()}>{t.askReplySend}</Button>
                </form>
              ) : <p className="text-sm text-muted">{q.status === "pending_review" ? t.askWaitingReview : t.askThreadClosed}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
