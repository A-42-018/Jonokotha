"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ReadAloud from "@/components/ui/ReadAloud";
import Textarea from "@/components/ui/Textarea";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { useToast } from "@/components/ui/Toast";
import { addStatement, answered, fetchConsultation, isNotFound, nextStatement, voteStatement, type ConsultationFull, type VoteKind } from "@/lib/consult-api";
import { fillNum, fmtDay } from "@/lib/format";
import { writeProblem } from "@/lib/r11";
import { ApiError } from "@/lib/api-client";

const KINDS: VoteKind[] = ["agree", "disagree", "pass"];

/** One consultation: one statement at a time, three answers, an optional statement of your own (F7.1, masterplan 7.14). No replies, no counts before the report. */
export default function ConsultationView(props: { refId: string; signedIn: boolean; loginHref: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ refId, signedIn, loginHref }: { refId: string; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["consultation", refId], queryFn: () => fetchConsultation(refId), retry: (n, e) => !isNotFound(e) && n < 2 });
  const back = <Link href="/consultations" className="inline-flex min-h-11 items-center text-civic underline">← {t.csAllList}</Link>;
  if (q.error && isNotFound(q.error)) return <div className="space-y-3">{back}<EmptyState title={t.csNotFound} body={t.csNotFoundBody} /></div>;
  return (
    <div className="space-y-4">
      {back}
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data && (
          <>
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold text-civic">{q.data.question}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={q.data.status === "open" ? "success" : "neutral"} icon={q.data.status === "open" ? "●" : "○"}>{q.data.status === "open" ? t.csTabOpen : q.data.status === "reported" ? t.csTabReported : t.csTabClosed}</Badge>
                {q.data.is_sample && <CapabilityLabel status="sample" />}
                {q.data.closes_at && <span className="text-sm text-muted">{fillNum(q.data.status === "open" ? t.r1Closes : t.r1Closed, { date: fmtDay(q.data.closes_at, lang) }, lang)}</span>}
              </div>
              {q.data.description && <p className="break-words">{q.data.description}</p>}
              <p className="text-sm text-muted">{t.csScope}</p>
            </header>
            <Body c={q.data} refId={refId} signedIn={signedIn} loginHref={loginHref} />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}

function Body({ c, refId, signedIn, loginHref }: { c: ConsultationFull; refId: string; signedIn: boolean; loginHref: string }) {
  const t = useT();
  if (c.status === "reported") return <Card tone="info"><p>{t.csReportedNote}</p><Link href={`/consultations/${encodeURIComponent(refId)}/report`} className={`${buttonClass()} mt-3`}>{t.csSeeReport}</Link></Card>;
  if (c.status === "closed") return <Card tone="info"><p>{t.csClosedNote}</p></Card>;
  if (!signedIn) return <Card><p>{t.r1SignInTo}</p><Link href={loginHref} className={`${buttonClass()} mt-3`}>{t.r1SignIn}</Link></Card>;
  return <Open c={c} refId={refId} />;
}

function Open({ c, refId }: { c: ConsultationFull; refId: string }) {
  const t = useT();
  const lang = useLang();
  const qc = useQueryClient();
  const toast = useToast();
  const [changing, setChanging] = useState(false);
  const next = nextStatement(c);
  const done = answered(c);
  const vote = useMutation({
    mutationFn: (v: { id: string; vote: VoteKind }) => voteStatement(refId, v.id, v.vote),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["consultation", refId] }),
    onError: (e) => { const p = writeProblem(e); toast("error", p === "closed" ? t.r1ClosedMsg : p === "auth" ? t.r1AuthMsg : t.r1FailMsg); void qc.invalidateQueries({ queryKey: ["consultation", refId] }); },
  });
  if (c.statements.length === 0) return <><EmptyState title={t.csNoStatements} /><AddStatement refId={refId} /></>;
  return (
    <div className="space-y-4">
      {next && !changing ? (
        <Card as="section">
          <p className="text-sm text-muted" aria-live="polite">{fillNum(t.csStatementOf, { i: done + 1, n: c.statements.length }, lang)}</p>
          <p className="my-3 break-words text-xl font-medium" data-testid="statement">{next.statement.text}</p>
          <div className="mb-3"><ReadAloud text={next.statement.text} what={t.raWhatStatement} /></div>
          <VoteButtons current={null} busy={vote.isPending} onVote={(v) => vote.mutate({ id: next.statement.id, vote: v })} />
        </Card>
      ) : !next && !changing ? (
        <Card tone="info"><h2 className="text-lg font-semibold">{t.csDoneTitle}</h2><p>{t.csDoneBody}</p></Card>
      ) : null}
      {done > 0 && (
        <section className="space-y-2">
          <Button variant="secondary" aria-expanded={changing} onClick={() => setChanging((x) => !x)}>{changing ? t.csChangeHide : t.csChange}</Button>
          {changing && (
            <>
              <p className="text-sm text-muted">{t.csChangeNote}</p>
              <ul className="space-y-3">
                {c.statements.filter((s) => s.my_vote).map((s) => (
                  <li key={s.id} className="rounded-xl border border-line bg-white p-3">
                    <p className="break-words">{s.text}</p>
                    <p className="mb-2 text-sm text-muted">{t.csYouSaid} <strong>{t[`csVoted_${s.my_vote}` as "csVoted_agree"]}</strong></p>
                    <VoteButtons current={s.my_vote} busy={vote.isPending} onVote={(v) => vote.mutate({ id: s.id, vote: v })} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <p className="text-sm text-muted">{t.csNoCounts}</p>
      <AddStatement refId={refId} />
    </div>
  );
}

function VoteButtons({ current, busy, onVote }: { current: VoteKind | null; busy: boolean; onVote: (v: VoteKind) => void }) {
  const t = useT();
  const label: Record<VoteKind, string> = { agree: t.csAgree, disagree: t.csDisagree, pass: t.csPass };
  return (
    <div role="group" aria-label={t.csYouSaid} className="grid gap-2 sm:grid-cols-3">
      {KINDS.map((k) => (
        <Button key={k} variant={current === k ? "primary" : "secondary"} aria-pressed={current === k} disabled={busy} onClick={() => onVote(k)} className="w-full">{label[k]}</Button>
      ))}
    </div>
  );
}

function AddStatement({ refId }: { refId: string }) {
  const t = useT();
  const toast = useToast();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const key = useRef(crypto.randomUUID());
  const send = useMutation({
    mutationFn: () => addStatement(refId, text.trim(), key.current),
    onSuccess: () => { setText(""); setErr(""); key.current = crypto.randomUUID(); toast("success", t.csAddSent); },
    onError: (e) => {
      key.current = crypto.randomUUID();
      const p = writeProblem(e);
      setErr(p === "limit" ? t.csAddLimit : p === "duplicate" ? t.csAddDup : p === "closed" ? t.r1ClosedMsg : p === "auth" ? t.r1AuthMsg : t.r1FailMsg);
      if (e instanceof ApiError && e.fieldErrors._ === "statement_limit") setErr(t.csAddLimit);
    },
  });
  return (
    <Card as="section" title={t.csAddTitle} headingAs="h2">
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length < 5) { setErr(t.csAddShort); return; } setErr(""); send.mutate(); }} className="space-y-3">
        <Textarea label={t.csAddLabel} hint={t.csAddHint} value={text} maxLength={140} rows={3} error={err || undefined} onChange={(e) => setText(e.target.value)} />
        <p className="text-sm text-muted">{t.csAddNote}</p>
        <Button type="submit" loading={send.isPending}>{t.csAddSend}</Button>
      </form>
    </Card>
  );
}
