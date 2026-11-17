"use client";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { commentsUnavailable, fetchComments, postComment, validComment, type IdeaComment } from "@/lib/comments-api";
import { fmtDate } from "@/lib/format";

/** Comments under one idea. Loaded only when opened. A new comment waits for a moderator, and the author sees it as "waiting for review". */
export default function IdeaComments({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div>
      <Button variant="ghost" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>{open ? t.cmHide : t.cmShow}</Button>
      <div id={panel} hidden={!open} className="mt-2">
        {open && <QueryProvider><CommentsInner refId={refId} signedIn={signedIn} /></QueryProvider>}
      </div>
    </div>
  );
}

function CommentsInner({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const key = ["idea-comments", refId];
  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchComments(refId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.next ?? undefined,
  });
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const idemKey = useRef(crypto.randomUUID()); // one key per attempt at the same text, so a retry cannot double-post
  const send = useMutation({
    mutationFn: () => postComment(refId, text, idemKey.current),
    onSuccess: (c) => {
      setText("");
      idemKey.current = crypto.randomUUID();
      toast("success", t.cmSent + (c.pii_removed?.length ? ` ${t.cmPii}` : ""));
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 429 ? t.cmTooMany : t.cmSendFail),
  });

  if (q.isPending) return <p role="status" className="text-sm text-muted">{t.cmLoading}</p>;
  if (q.isError && commentsUnavailable(q.error)) return <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">{t.cmUnavailable}</p>;
  if (q.isError) {
    return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t.cmLoadError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.cmRetry}</Button></div>;
  }
  const rows: IdeaComment[] = q.data.pages.flatMap((p) => p.items);
  return (
    <section aria-label={t.cmTitle} className="space-y-3">
      {rows.length === 0
        ? <EmptyState variant="empty" title={t.cmEmptyTitle} body={t.cmEmptyBody} />
        : <ul className="space-y-2">{rows.map((c) => <li key={c.id}><CommentRow c={c} lang={lang} /></li>)}</ul>}
      {q.hasNextPage && <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t.cmMore}</Button>}
      {signedIn ? (
        <form className="space-y-2" noValidate onSubmit={(e) => { e.preventDefault(); if (!validComment(text)) { setErr(t.cmTooShort); return; } setErr(""); send.mutate(); }}>
          <Textarea label={t.cmLabel} hint={t.cmHint} rows={3} maxLength={500} value={text} error={err || undefined} onChange={(e) => { setText(e.target.value); setErr(""); }} />
          <Button type="submit" loading={send.isPending}>{t.cmSend}</Button>
        </form>
      ) : (
        <Link href={`/login?need=1&next=${encodeURIComponent("/ideas")}`} className="inline-flex min-h-11 items-center text-civic underline">{t.cmSignIn}</Link>
      )}
    </section>
  );
}

/** One comment in one of its three states: published, waiting for review (author only) or removed by a moderator. */
function CommentRow({ c, lang }: { c: IdeaComment; lang: "bn" | "en" }) {
  const t = useT();
  return (
    <article className="rounded-xl border border-line bg-white p-3">
      <p className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{c.mine ? t.cmMine : t.cmCitizen}</span> · <time dateTime={c.created_at}>{fmtDate(c.created_at, lang)}</time>
        {c.status === "pending_review" && <Badge tone="warning" icon="⏳">{t.cmPending}</Badge>}
      </p>
      {c.status === "hidden" ? <p className="text-sm italic text-muted">{t.cmHidden}</p> : <p className="whitespace-pre-line break-words">{c.body}</p>}
    </article>
  );
}
