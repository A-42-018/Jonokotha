"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { similarIdeas, type Idea } from "@/lib/ideas";
import { CATEGORIES } from "@/lib/categories";
import IdeaCard from "./IdeaCard";

type Form = { title: string; problem: string; solution: string; benefit: string; area: string; category: string; cost: string; ack: boolean };
const EMPTY: Form = { title: "", problem: "", solution: "", benefit: "", area: "", category: "", cost: "", ack: false };
const NONE: (Form & { at: string })[] = [];
const KEY = "jonokotha:my-ideas:v1";

export function validateIdea(f: Form, t: { idErrTitle: string; idErrProblem: string; idErrSolution: string; idErrCategory: string; idErrAck: string }) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.title.trim().length < 5) e.title = t.idErrTitle;
  if (f.problem.trim().length < 10) e.problem = t.idErrProblem;
  if (f.solution.trim().length < 10) e.solution = t.idErrSolution;
  if (!f.category) e.category = t.idErrCategory;
  if (!f.ack) e.ack = t.idErrAck;
  return e;
}

/** Submit-an-idea form with similar-idea suggestions while typing. No ideas API yet: saved on this device only. */
export default function NewIdeaForm({ existing, signedIn }: { existing: Idea[]; signedIn: boolean }) {
  const t = useT();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [done, setDone] = useState(false);
  const [mine, setMine] = useLocalValue(KEY, NONE);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const similar = useMemo(() => similarIdeas(`${f.title} ${f.problem} ${f.solution}`, existing), [f.title, f.problem, f.solution, existing]);

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
        <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.idDoneLocal}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/ideas" className={buttonClass()}>{t.idBack}</Link>
          <Button variant="secondary" onClick={() => { setF(EMPTY); setDone(false); }}>{t.idAnother}</Button>
        </div>
        <p className="text-xs text-muted">{t.idMine}: {mine.length}</p>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateIdea(f, t);
    setErrors(errs);
    if (Object.keys(errs).length) { document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(); return; }
    setMine((m) => [...m, { ...f, at: new Date().toISOString() }]);
    setDone(true);
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
          <ul className="space-y-2">{similar.map((i) => <li key={i.id}><IdeaCard idea={i} signedIn={signedIn} heading="h3" /></li>)}</ul>
        </section>
      )}
      <Textarea label={t.idFProblem} rows={4} maxLength={1000} value={f.problem} error={errors.problem} onChange={(e) => set("problem", e.target.value)} />
      <Textarea label={t.idFSolution} rows={4} maxLength={1000} value={f.solution} error={errors.solution} onChange={(e) => set("solution", e.target.value)} />
      <Textarea label={t.idFBenefit} optional rows={3} maxLength={600} value={f.benefit} onChange={(e) => set("benefit", e.target.value)} />
      <Input label={t.idFArea} optional maxLength={120} value={f.area} onChange={(e) => set("area", e.target.value)} />
      <Select label={t.idFCategory} placeholder={t.idChoose} required value={f.category} error={errors.category} onChange={(e) => set("category", e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: t.cats[c] }))} />
      <Select label={t.idFCost} optional hint={t.idFCostHint} value={f.cost} onChange={(e) => set("cost", e.target.value)}
        options={[{ value: "", label: t.idCostNone }, { value: "s", label: t.idCostS }, { value: "m", label: t.idCostM }, { value: "l", label: t.idCostL }]} />
      <Checkbox label={t.idFAck} checked={f.ack} error={errors.ack} onChange={(e) => set("ack", e.target.checked)} />
      <Button type="submit" size="lg" full>{t.idPublish}</Button>
    </form>
  );
}
