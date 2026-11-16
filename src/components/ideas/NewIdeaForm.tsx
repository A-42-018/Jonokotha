"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PublicNotice from "@/components/PublicNotice";
import Button, { buttonClass } from "@/components/ui/Button";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { costLabel } from "@/lib/country";
import { fillNum } from "@/lib/format";
import { fetchSimilar, ideaBody, postIdea } from "@/lib/ideas-api";
import { newId } from "@/lib/offline-queue";
import { CATEGORIES } from "@/lib/categories";
import QueryProvider from "../QueryProvider";

type Form = { title: string; problem: string; solution: string; benefit: string; area: string; category: string; cost: string; ack: boolean };
const EMPTY: Form = { title: "", problem: "", solution: "", benefit: "", area: "", category: "", cost: "", ack: false };

export function validateIdea(f: Form, t: { idErrTitle: string; idErrProblem: string; idErrSolution: string; idErrCategory: string; idErrAck: string }) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.title.trim().length < 5) e.title = t.idErrTitle;
  if (f.problem.trim().length < 10) e.problem = t.idErrProblem;
  if (f.solution.trim().length < 10) e.solution = t.idErrSolution;
  if (!f.category) e.category = t.idErrCategory;
  if (!f.ack) e.ack = t.idErrAck;
  return e;
}

export default function NewIdeaForm(props: { constituency: string; signedIn: boolean }) {
  return <QueryProvider><NewIdeaInner {...props} /></QueryProvider>;
}

/** Submit-an-idea form with similar-idea suggestions while typing. Posts to /api/v1/ideas; a moderator reviews it before it is public. */
function NewIdeaInner({ constituency, signedIn }: { constituency: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [done, setDone] = useState(false);
  const [removed, setRemoved] = useState(false);
  const key = useRef(newId()); // one Idempotency-Key per idea: a double tap does not post twice
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  // Similar ideas in the same area, looked up a moment after typing stops (the API wants at least 5 characters).
  const [probe, setProbe] = useState("");
  useEffect(() => {
    const text = `${f.title} ${f.problem} ${f.solution}`.trim();
    const id = setTimeout(() => setProbe(text.length >= 5 ? text.slice(0, 2000) : ""), 600);
    return () => clearTimeout(id);
  }, [f.title, f.problem, f.solution]);
  const similarQ = useQuery({ queryKey: ["ideas-similar", constituency, probe], queryFn: () => fetchSimilar(constituency, probe), enabled: probe.length > 0, staleTime: 60_000 });
  const similar = similarQ.data ?? [];

  const post = useMutation({
    mutationFn: () => {
      const cost = costLabel(f.cost, lang);
      const body = ideaBody(f, { problem: t.idFProblem, solution: t.idFSolution, benefit: t.idFBenefit, area: t.idFArea, cost: t.idCostBody }, cost);
      return postIdea(constituency, f, body, key.current);
    },
    onSuccess: (r) => { setRemoved(r.pii_removed.length > 0); setDone(true); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 401 ? t.idSupportNeedsSignIn : e instanceof ApiError && e.status === 429 ? t.idRateLimited : t.idSubmitFail),
  });

  if (!signedIn) {
    return <Card tone="info"><p className="mb-3">{t.idSupportNeedsSignIn}</p><Link href={`/login?need=1&next=${encodeURIComponent("/ideas/new")}`} className={buttonClass()}>{t.signIn}</Link></Card>;
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/illustrations/spot-idea.svg" alt="" className="mx-auto w-44" />
        <h1 role="status" className="text-2xl font-semibold text-civic">{t.idDoneTitle}</h1>
        <p>{t.idDoneBody}</p>
        <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.idDonePending}</p>
        {removed && <p role="status" className="text-sm text-muted">{t.idPiiRemoved}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/ideas" className={buttonClass()}>{t.idBack}</Link>
          <Button variant="secondary" onClick={() => { setF(EMPTY); setDone(false); key.current = newId(); }}>{t.idAnother}</Button>
        </div>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateIdea(f, t);
    setErrors(errs);
    if (Object.keys(errs).length) { document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(); return; }
    post.mutate();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-civic">{t.idNewTitle}</h1>
        <p className="text-muted">{t.idNewLead}</p>
      </div>
      <Input label={t.idFTitle} maxLength={120} value={f.title} error={errors.title} onChange={(e) => set("title", e.target.value)} />
      {similar.length > 0 && (
        <section aria-live="polite" className="space-y-2 rounded-2xl border border-amber/60 bg-amber/10 p-3">
          <h2 className="font-semibold">{t.idSimilarTitle}</h2>
          <p className="text-sm">{t.idSimilarBody}</p>
          <ul className="space-y-1">{similar.map((i) => <li key={i.ref}><Link href={`/ideas/${encodeURIComponent(i.ref)}`} className="underline">{i.title}</Link> <span className="text-sm text-muted">· {fillNum(t.idSupportCount, { n: i.support_count }, lang)}</span></li>)}</ul>
        </section>
      )}
      <Textarea label={t.idFProblem} rows={4} maxLength={700} value={f.problem} error={errors.problem} onChange={(e) => set("problem", e.target.value)} />
      <Textarea label={t.idFSolution} rows={4} maxLength={700} value={f.solution} error={errors.solution} onChange={(e) => set("solution", e.target.value)} />
      <Textarea label={t.idFBenefit} optional rows={3} maxLength={300} value={f.benefit} onChange={(e) => set("benefit", e.target.value)} />
      <Input label={t.idFArea} optional maxLength={120} value={f.area} onChange={(e) => set("area", e.target.value)} />
      <Select label={t.idFCategory} placeholder={t.idChoose} required value={f.category} error={errors.category} onChange={(e) => set("category", e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: t.cats[c] }))} />
      <Select label={t.idFCost} optional hint={t.idFCostHint} value={f.cost} onChange={(e) => set("cost", e.target.value)}
        options={[{ value: "", label: t.idCostNone }, { value: "s", label: costLabel("s", lang) }, { value: "m", label: costLabel("m", lang) }, { value: "l", label: costLabel("l", lang) }]} />
      <PlannedPanel as="h2" title={t.idAttachTitle} body={t.idAttachBody} />
      <Checkbox label={t.idFAck} checked={f.ack} error={errors.ack} onChange={(e) => set("ack", e.target.checked)} />
      <PublicNotice kind="idea" />
      <Button type="submit" size="lg" full loading={post.isPending}>{post.isPending ? t.idPublishing : t.idPublish}</Button>
    </form>
  );
}
