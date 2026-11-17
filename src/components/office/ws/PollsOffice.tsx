"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { createPoll, fetchOfficePolls, officePollResults, pollAction, type OfficePoll } from "@/lib/polls-api";
import { createSurvey, fetchOfficeSurveys, setSurveyStatus, type NewQuestion, type OfficeSurvey } from "@/lib/surveys-api";
import { lines } from "@/lib/consult-api";
import Boundary from "./Boundary";

/** Office: create, open and close polls (B5.5) and, from Release 1.1, surveys (B7.6). Opening and closing ask first: citizens see the result at once. */
export default function PollsOffice({ constituency, surveys }: { constituency: string; surveys: boolean }) {
  return <QueryProvider><div className="space-y-6"><Polls constituency={constituency} />{surveys && <Surveys constituency={constituency} />}</div></QueryProvider>;
}

const TONE = { draft: "neutral", open: "success", closed: "neutral", cancelled: "danger" } as const;
const future = (day: string) => day === "" || Date.parse(day) > Date.now();
const closesAt = (day: string) => (day ? { closes_at: `${day}T23:59:00+06:00` } : {});

function useFail() {
  const t = useT();
  const toast = useToast();
  return (e: unknown) => toast("error", e instanceof ApiError && e.status === 403 ? t.ospNoAccess : t.r1FailMsg);
}

function Polls({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-polls"], queryFn: fetchOfficePolls, retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.owPollsPlannedTitle} body={t.owPollsPlannedBody} />;
  return (
    <section aria-labelledby="osp-polls" className="space-y-3">
      <h2 id="osp-polls" className="text-xl font-semibold">{t.ospPollsH}</h2>
      <NewPoll constituency={constituency} />
      <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.ospEmpty}>
        {(d) => d.kind === "ok" ? <ul className="space-y-2">{d.data.map((p) => <li key={p.ref}><PollRow p={p} /></li>)}</ul> : null}
      </Boundary>
    </section>
  );
}

function NewPoll({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const name = useId();
  const [f, setF] = useState({ question: "", options: "", day: "", vis: "after_close" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: () => createPoll({ constituency, question: f.question.trim(), options: lines(f.options, 10), results_visibility: f.vis as "after_close", ...closesAt(f.day) }, key),
    onSuccess: () => { toast("success", t.ospCreated); setF({ question: "", options: "", day: "", vis: "after_close" }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-polls"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  function submit() {
    const x: Record<string, string> = {};
    const qn = f.question.trim().length, opts = lines(f.options, 11);
    if (qn < 5 || qn > 200) x.question = t.ospBadQuestion;
    if (opts.length < 2 || opts.length > 10 || opts.some((o) => o.length > 100)) x.options = t.ospBadOptions;
    if (!future(f.day)) x.day = t.ospBadDate;
    setErr(x);
    if (!Object.keys(x).length) m.mutate();
  }
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h3 className="text-lg font-semibold">{t.ospPollNew}</h3>
      <Input label={t.ospQuestion} maxLength={200} value={f.question} error={err.question} onChange={set("question")} />
      <Textarea label={t.ospOptions} rows={4} value={f.options} error={err.options} onChange={set("options")} />
      <Input type="date" label={t.ospCloses} optional value={f.day} error={err.day} onChange={set("day")} />
      <RadioGroup legend={t.ospResultsWhen} name={name} value={f.vis} onChange={(v) => setF((s) => ({ ...s, vis: v }))} options={[{ value: "after_close", label: t.ospResultsAfter }, { value: "always", label: t.ospResultsAlways }]} />
      <Button type="submit" loading={m.isPending}>{t.ospCreate}</Button>
    </form>
  );
}

function PollRow({ p }: { p: OfficePoll }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const [show, setShow] = useState(false);
  const act = useMutation({ mutationFn: (a: "publish" | "close" | "cancel") => pollAction(p.ref, a), onSuccess: () => { toast("success", t.ospDone); void qc.invalidateQueries({ queryKey: ["office-polls"] }); }, onError: fail });
  const res = useQuery({ queryKey: ["office-poll-results", p.ref], queryFn: () => officePollResults(p.ref), enabled: show, retry: false });
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[p.status]}>{t[`ospSt_${p.status}` as "ospSt_open"]}</Badge>
        <p className="min-w-0 flex-1 break-words font-medium">{p.question}</p>
        {p.closes_at && <span className="text-sm text-muted">{fillNum(t.r1Closes, { date: fmtDay(p.closes_at, lang) }, lang)}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {p.status === "draft" && <ConfirmAction label={t.ospPublish} body={t.ospPublishConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("publish")} />}
        {p.status === "open" && <ConfirmAction variant="secondary" label={t.ospClose} body={t.ospCloseConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("close")} />}
        {(p.status === "draft" || p.status === "open") && <ConfirmAction variant="danger" label={t.ospCancel} body={t.ospCancelConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("cancel")} />}
        {p.status !== "draft" && p.status !== "cancelled" && <Button variant="ghost" aria-expanded={show} onClick={() => setShow((x) => !x)}>{t.ospResults}</Button>}
      </div>
      {show && res.data && (
        <div role="status" className="text-sm">
          <p>{fillNum(t.ospTotal, { n: res.data.total_votes }, lang)}</p>
          <ul>{(res.data.options ?? []).map((o) => <li key={o.id}>{o.label}: {fillNum(t.pvShare, { votes: o.votes, pc: res.data.total_votes ? Math.round((o.votes / res.data.total_votes) * 100) : 0 }, lang)}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// Surveys -------------------------------------------------------------------------------------------------------------------------------------------
interface QDraft { kind: "rating" | "choice"; prompt: string; options: string }

function Surveys({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-surveys"], queryFn: fetchOfficeSurveys, retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.r1PlannedTitle} body={t.r1PlannedBody} />;
  return (
    <section aria-labelledby="osp-sv" className="space-y-3">
      <h2 id="osp-sv" className="text-xl font-semibold">{t.ospSurveysH}</h2>
      <p className="text-sm text-muted">{t.ospFreeTextNote}</p>
      <NewSurvey constituency={constituency} />
      <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.ospSurveyEmpty}>
        {(d) => d.kind === "ok" ? <ul className="space-y-2">{d.data.map((s) => <li key={s.ref}><SurveyRow s={s} /></li>)}</ul> : null}
      </Boundary>
    </section>
  );
}

function NewSurvey({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const [f, setF] = useState({ title: "", desc: "", day: "" });
  const [qs, setQs] = useState<QDraft[]>([{ kind: "rating", prompt: "", options: "" }]);
  const [err, setErr] = useState<Record<string, string>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const questions = (): NewQuestion[] => qs.map((x) => (x.kind === "rating" ? { kind: "rating", prompt: x.prompt.trim() } : { kind: "choice", prompt: x.prompt.trim(), options: lines(x.options, 8) }));
  const m = useMutation({
    mutationFn: () => createSurvey({ constituency, title: f.title.trim(), ...(f.desc.trim() ? { description: f.desc.trim() } : {}), questions: questions(), ...closesAt(f.day) }, key),
    onSuccess: () => { toast("success", t.ospCreated); setF({ title: "", desc: "", day: "" }); setQs([{ kind: "rating", prompt: "", options: "" }]); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-surveys"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  const setQ = (i: number, patch: Partial<QDraft>) => setQs((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  function submit() {
    const x: Record<string, string> = {};
    const n = f.title.trim().length;
    if (n < 5 || n > 150) x.title = t.ospTitleBad;
    if (qs.length < 1 || qs.length > 8) x.qs = t.ospNoQuestions;
    else if (qs.some((q) => q.prompt.trim().length < 5 || q.prompt.trim().length > 200 || (q.kind === "choice" && (lines(q.options, 9).length < 2 || lines(q.options, 9).length > 8)))) x.qs = t.ospQBad;
    if (!future(f.day)) x.day = t.ospBadDate;
    setErr(x);
    if (!Object.keys(x).length) m.mutate();
  }
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h3 className="text-lg font-semibold">{t.ospSurveyNew}</h3>
      <Input label={t.ospSurveyTitle} maxLength={150} value={f.title} error={err.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} />
      <Textarea label={t.ospSurveyDesc} optional rows={2} maxLength={600} value={f.desc} onChange={(e) => setF((s) => ({ ...s, desc: e.target.value }))} />
      <fieldset className="space-y-3 border-0 p-0">
        <legend className="font-medium">{t.ospQuestionsH}</legend>
        {qs.map((x, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-medium">{x.kind === "rating" ? t.ospQKindRating : t.ospQKindChoice}</p>
            <Input label={fillNum(t.ospQPrompt, { i: i + 1 }, lang)} maxLength={200} value={x.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} />
            {x.kind === "choice" && <Textarea label={t.ospQOptions} rows={3} value={x.options} onChange={(e) => setQ(i, { options: e.target.value })} />}
            {qs.length > 1 && <Button variant="ghost" onClick={() => setQs((a) => a.filter((_, j) => j !== i))}>{fillNum(t.ospQRemove, { i: i + 1 }, lang)}</Button>}
          </div>
        ))}
        {err.qs && <p role="alert" className="text-sm text-danger">{err.qs}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={qs.length >= 8} onClick={() => setQs((a) => [...a, { kind: "rating", prompt: "", options: "" }])}>{t.ospAddRating}</Button>
          <Button variant="secondary" disabled={qs.length >= 8} onClick={() => setQs((a) => [...a, { kind: "choice", prompt: "", options: "" }])}>{t.ospAddChoice}</Button>
        </div>
      </fieldset>
      <Input type="date" label={t.ospCloses} optional value={f.day} error={err.day} onChange={(e) => setF((s) => ({ ...s, day: e.target.value }))} />
      <Button type="submit" loading={m.isPending}>{t.ospCreate}</Button>
    </form>
  );
}

function SurveyRow({ s }: { s: OfficeSurvey }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const act = useMutation({ mutationFn: (st: "open" | "closed" | "cancelled") => setSurveyStatus(s.ref, st), onSuccess: () => { toast("success", t.ospDone); void qc.invalidateQueries({ queryKey: ["office-surveys"] }); }, onError: fail });
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[s.status]}>{t[`ospSt_${s.status}` as "ospSt_open"]}</Badge><p className="min-w-0 flex-1 break-words font-medium">{s.title}</p></div>
      <div className="flex flex-wrap gap-2">
        {s.status === "draft" && <ConfirmAction label={t.ospPublish} body={t.ospPublishConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("open")} />}
        {s.status === "open" && <ConfirmAction variant="secondary" label={t.ospClose} body={t.ospCloseConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("closed")} />}
        {(s.status === "draft" || s.status === "open") && <ConfirmAction variant="danger" label={t.ospCancel} body={t.ospCancelConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("cancelled")} />}
      </div>
    </div>
  );
}
