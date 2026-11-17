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
import { RadioGroup } from "@/components/ui/Choice";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDay, fmtNum } from "@/lib/format";
import { fetchSatisfaction, fetchSurvey, fetchSurveyResults, fetchSurveys, missingAnswers, satisfactionView, submitSurvey, type Answer, type SurveyRow } from "@/lib/surveys-api";
import { writeProblem } from "@/lib/r11";

/** Surveys for citizens and the satisfaction summary (F7.6, B7.6). Rating or choice answers only; one response per verified account. */
export default function SurveysPanel(props: { signedIn: boolean; loginHref: string; constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ signedIn, loginHref, constituency }: { signedIn: boolean; loginHref: string; constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["surveys", constituency], queryFn: () => fetchSurveys(constituency), retry: false });
  return (
    <section aria-labelledby="sv-h" className="space-y-3">
      <h2 id="sv-h" className="jk-h2">{t.svSurveysTitle}</h2>
      <p className="text-muted">{t.svSurveysLead}</p>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "planned" ? <PlannedPanel as="h3" title={t.r1PlannedTitle} body={t.r1PlannedBody} /> : q.data && q.data.data.length === 0 ? <EmptyState title={t.svEmpty} body={t.svEmptyBody} /> : q.data && (
          <ul className="space-y-3">{q.data.data.map((s) => <li key={s.ref}><SurveyCard row={s} signedIn={signedIn} loginHref={loginHref} /></li>)}</ul>
        )}
      </AsyncBlock>
      {q.data?.kind === "ok" && <Satisfaction constituency={constituency} />}
    </section>
  );
}

function SurveyCard({ row, signedIn, loginHref }: { row: SurveyRow; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const open = row.status === "open";
  const d = useQuery({ queryKey: ["survey", row.ref], queryFn: () => fetchSurvey(row.ref) });
  const results = useQuery({ queryKey: ["survey-results", row.ref], queryFn: () => fetchSurveyResults(row.ref), enabled: !open, retry: false });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<"sent" | "again" | null>(null);
  const key = useRef(crypto.randomUUID());
  const send = useMutation({
    mutationFn: () => submitSurvey(row.ref, answers, key.current),
    onSuccess: () => { setDone("sent"); setMsg(""); toast("success", t.svSent); void qc.invalidateQueries({ queryKey: ["survey-results", row.ref] }); },
    onError: (e) => { key.current = crypto.randomUUID(); const p = writeProblem(e); setMsg(p === "again" ? t.svAgain : p === "closed" ? t.svClosedNow : p === "auth" ? t.r1AuthMsg : t.svFail); if (p === "again") setDone("again"); },
  });
  const qs = d.data?.questions ?? [];
  return (
    <Card as="section" title={row.title}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={open ? "success" : "neutral"} icon={open ? "●" : "○"}>{open ? t.svOpen : t.svClosed}</Badge>
        {row.is_sample && <CapabilityLabel status="sample" />}
        {row.closes_at && open && <span className="text-sm text-muted">{fillNum(t.r1Closes, { date: fmtDay(row.closes_at, lang) }, lang)}</span>}
      </div>
      {row.description && <p className="mb-2 break-words">{row.description}</p>}
      <AsyncBlock pending={d.isPending} error={d.error} onRetry={() => void d.refetch()}>
        {open ? (
          done ? <p role="status">{done === "sent" ? t.svSent : t.svAgain}</p> : !signedIn ? (
            <div className="space-y-2"><p>{t.svSignIn}</p><Link href={loginHref} className={buttonClass()}>{t.signIn}</Link></div>
          ) : (
            <form noValidate onSubmit={(e) => { e.preventDefault(); if (missingAnswers(qs, answers).length) { setMsg(t.svAnswerAll); return; } setMsg(""); send.mutate(); }} className="space-y-4">
              {qs.map((x, i) => (
                <RadioGroup key={x.id} legend={`${fillNum(t.svQuestionN, { i: i + 1 }, lang)}: ${x.prompt}`} name={`q-${x.id}`} value={answers[x.id] === undefined ? "" : String(answers[x.id])}
                  onChange={(v) => setAnswers((a) => ({ ...a, [x.id]: x.kind === "rating" ? Number(v) : v }))}
                  options={x.kind === "rating" ? [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: fillNum(t.svRating, { n }, lang) })) : (x.options ?? []).map((o) => ({ value: o, label: o }))} />
              ))}
              {qs.some((x) => x.kind === "rating") && <p className="text-sm text-muted">{t.svRatingHint}</p>}
              {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
              <Button type="submit" loading={send.isPending}>{t.svSubmit}</Button>
            </form>
          )
        ) : results.data?.results_shown && results.data.questions ? (
          <div className="space-y-3" aria-label={t.svResultsTitle}>
            <p className="text-sm">{fillNum(t.svRespondents, { n: results.data.respondents ?? 0 }, lang)}</p>
            {results.data.questions.map((x) => (
              <div key={x.id}>
                <p className="font-medium">{x.prompt}</p>
                {x.kind === "rating" && x.average !== null && <p className="text-sm">{fillNum(t.svAverage, { avg: fmtNum(Math.round(x.average * 10) / 10, lang) }, lang)}</p>}
                {x.kind === "choice" && <ul className="text-sm">{Object.entries(x.counts).map(([k, n]) => <li key={k}>{k}: {fmtNum(n, lang)}</li>)}</ul>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">{t.svResultsHidden}</p>}
      </AsyncBlock>
    </Card>
  );
}

function Satisfaction({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["satisfaction", constituency], queryFn: () => fetchSatisfaction(constituency), retry: false });
  if (!q.data || q.data.kind === "planned") return null;
  const v = satisfactionView(q.data.data);
  return (
    <Card as="section" title={t.svSatTitle} headingAs="h3">
      <p className="text-sm text-muted">{t.svSatLead}</p>
      {v ? (
        <>
          <p className="mt-2 font-medium">{fillNum(t.svSatAvg, { avg: fmtNum(v.average, lang), n: v.n }, lang)}</p>
          <ul className="text-sm">{v.dist.map(([r, n]) => <li key={r}>{fillNum(t.svSatRow, { r, n }, lang)}</li>)}</ul>
        </>
      ) : <p className="mt-2">{t.svSatFew}</p>}
      <p className="mt-1 text-xs text-muted">{fillNum(t.svSatPeriod, { n: q.data.data.days ?? 90 }, lang)}</p>
    </Card>
  );
}
