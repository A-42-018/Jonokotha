"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { createPb, num, fetchOfficePb, fetchOfficePbs, fetchPb, fetchPbList, money, pbAct, pbProblem, submitBallot, type OfficePb, type PbFull } from "@/lib/r2-api";
import { Gate, useR2Fail } from "./bits";

/** Participatory budgeting (F8.6). Always labelled advisory until the office records that it will follow the result; the pledge is the office's own statement. */
export function PbList({ constituency }: { constituency: string }) {
  return <QueryProvider><List constituency={constituency} /></QueryProvider>;
}

function List({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["pb-list", constituency], queryFn: () => fetchPbList(constituency), retry: false });
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
      <Gate data={q.data}>
        {(rows) => rows.length === 0 ? <EmptyState title={t.r2PbEmpty} /> : (
          <ul className="space-y-3">{rows.map((c) => (
            <li key={c.ref}>
              <Card as="article" title={c.title} headingAs="h2">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={c.status === "open" ? "success" : "neutral"}>{t[`r2PbStatus_${c.status}`]}</Badge>
                  <Badge tone="warning">{t.r2PbAdvisory}</Badge>
                  {c.is_sample && <CapabilityLabel status="sample" />}
                </div>
                <p>{t.r2PbBudget}: <strong>{money(c.budget_amount, c.currency, lang)}</strong></p>
                <p className="text-sm text-muted">{fillNum(t.r2PbCloses, { date: fmtDay(c.closes_at, lang) }, lang)}</p>
                <Link href={`/budgeting/${encodeURIComponent(c.ref)}`} className={`${buttonClass({ variant: "secondary" })} mt-3`}>{t.r2PbSee}</Link>
              </Card>
            </li>
          ))}</ul>
        )}
      </Gate>
    </AsyncBlock>
  );
}

export function PbDetail({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  return <QueryProvider><Detail refId={refId} signedIn={signedIn} /></QueryProvider>;
}

function Detail({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pb", refId], queryFn: () => fetchPb(refId), retry: false });
  const [picked, setPicked] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<"none" | "many" | null>(null);
  const vote = useMutation({
    mutationFn: (ids: string[]) => submitBallot(refId, ids),
    onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["pb", refId] }); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 403 ? t.r2PbFollow : t.r2Fail),
  });
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
      {q.data && (() => {
        const c: PbFull = q.data;
        const open = c.status === "open";
        const sel = picked ?? c.my_ballot?.option_ids ?? [];
        const toggle = (id: string) => { setProblem(null); setPicked(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]); };
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={open ? "success" : "neutral"}>{t[`r2PbStatus_${c.status}`]}</Badge>
              <Badge tone="warning">{t.r2PbAdvisory}</Badge>
              {c.is_sample && <CapabilityLabel status="sample" />}
            </div>
            {c.description && <p>{c.description}</p>}
            <Card title={t.r2PbPledge} headingAs="h2" tone="info">
              <p className="break-words">{c.pledge}</p>
              <p className="mt-2 text-sm text-muted">{t.r2PbPledgeNote}</p>
            </Card>
            <p>{t.r2PbBudget}: <strong>{money(c.budget_amount, c.currency, lang)}</strong> · {fillNum(t.r2PbCloses, { date: fmtDay(c.closes_at, lang) }, lang)}</p>
            {!open && (
              <div className="space-y-1 text-sm">
                {c.result_valid === false ? <p role="status">{t.r2PbInvalid}</p> : c.participants !== null && <p>{fillNum(t.r2PbParticipants, { n: c.participants }, lang)}</p>}
                <p className="text-muted">{t.r2PbRule}</p>
                <p role="status" className="font-medium">{c.followed_result === true ? t.r2PbFollowed : c.followed_result === false ? fillNum(t.r2PbNotFollowed, { reason: c.deviation_reason ?? "" }, lang) : t.r2PbNoOutcome}</p>
              </div>
            )}
            <fieldset className="space-y-2" disabled={!open || !signedIn}>
              <legend className="font-semibold">{open ? fillNum(t.r2PbChoose, { n: c.max_choices }, lang) : t.r2PbClosed}</legend>
              {c.options.map((o) => {
                const on = sel.includes(o.id);
                return (
                  <div key={o.id} className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                    {open && <input id={`o-${o.id}`} type="checkbox" className="mt-1 size-6 shrink-0" checked={on} onChange={() => toggle(o.id)} />}
                    <label htmlFor={`o-${o.id}`} className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{o.title}</span>
                      {o.description && <span className="block text-sm text-muted">{o.description}</span>}
                      <span className="block text-sm">{fillNum(t.r2PbCost, { amount: money(o.cost, c.currency, lang) }, lang)}</span>
                      {o.approvals !== null && <span className="block text-sm text-muted">{fillNum(t.r2PbApprovals, { n: o.approvals }, lang)}</span>}
                      {o.funded !== null && <Badge tone={o.funded ? "success" : "neutral"} icon={o.funded ? "✓" : "○"}>{o.funded ? t.r2PbFunded : t.r2PbNotFunded}</Badge>}
                    </label>
                  </div>
                );
              })}
            </fieldset>
            {open && !signedIn && <p><Link href={`/login?next=/budgeting/${encodeURIComponent(refId)}`} className="text-civic underline">{t.r2SignIn}</Link> · {t.r2PbFollow}</p>}
            {open && signedIn && (
              <div className="space-y-2">
                {c.my_ballot && <p role="status" className="text-sm">{t.r2PbVoted}</p>}
                {problem && <p role="alert" className="text-sm text-danger">{problem === "none" ? t.r2PbNone : fillNum(t.r2PbTooMany, { n: c.max_choices }, lang)}</p>}
                <Button loading={vote.isPending} onClick={() => { if (sel.length < 1) return setProblem("none"); if (sel.length > c.max_choices) return setProblem("many"); vote.mutate(sel); }}>{c.my_ballot ? t.r2PbChange : t.r2PbVote}</Button>
              </div>
            )}
            <Link href="/budgeting" className="inline-flex min-h-11 items-center text-civic underline">{t.r2Back}</Link>
          </div>
        );
      })()}
    </AsyncBlock>
  );
}

// Office ----------------------------------------------------------------------------------------------------------------------------------------------
export function PbOffice({ constituency }: { constituency: string }) {
  return <QueryProvider><OfficeInner constituency={constituency} /></QueryProvider>;
}

function OfficeInner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-pb"], queryFn: fetchOfficePbs, retry: false });
  return (
    <Gate data={q.data}>
      {() => (
        <div className="space-y-4">
          <NewCycle constituency={constituency} />
          <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.r2PbEmpty}>
            {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((c) => <li key={c.ref}><Row c={c} /></li>)}</ul> : null}
          </Boundary>
        </div>
      )}
    </Gate>
  );
}

const nextMonth = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

function NewCycle({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [f, setF] = useState({ src: "", title: "", desc: "", budget: "", pledge: "", max: "3", closes: nextMonth() });
  const [opts, setOpts] = useState([{ title: "", cost: "" }, { title: "", cost: "" }]);
  const [err, setErr] = useState<ReturnType<typeof pbProblem> | "src">(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(null); };
  const parsed = opts.map((o) => ({ title: o.title, cost: num(o.cost) }));
  const m = useMutation({
    mutationFn: () => createPb({ constituency, budget_source_ref: f.src.trim(), title: f.title.trim(), ...(f.desc.trim() ? { description: f.desc.trim() } : {}), budget_amount: num(f.budget), pledge: f.pledge.trim(), max_choices: num(f.max), closes_at: `${f.closes}T23:59:00+06:00`, options: parsed.filter((o) => o.title.trim()).map((o) => ({ title: o.title.trim(), cost: o.cost })) }, key),
    onSuccess: () => { toast("success", t.r2Done); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-pb"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  const submit = () => {
    if (!f.src.trim()) { setErr("src"); return; }
    const p = pbProblem({ title: f.title, budget: num(f.budget), pledge: f.pledge, maxChoices: num(f.max), options: parsed });
    setErr(p);
    if (!p) m.mutate();
  };
  const e = (k: Exclude<typeof err, null | "src">) => (err === k ? t[`r2PbErr_${k}`] : undefined);
  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); submit(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{t.r2PbNew}</h2>
      <Input label={t.r2PbSrc} value={f.src} onChange={set("src")} error={err === "src" ? t.r2PbSrc : undefined} />
      <Input label={t.r2PbName} value={f.title} onChange={set("title")} error={e("title")} />
      <Textarea label={t.r2PbDesc} optional rows={2} value={f.desc} onChange={set("desc")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={t.r2PbAmount} inputMode="decimal" value={f.budget} onChange={set("budget")} error={e("budget")} />
        <Input label={t.r2PbMax} inputMode="numeric" value={f.max} onChange={set("max")} error={e("choices")} />
        <Input type="date" label={t.r2PbCloseAt} value={f.closes} onChange={set("closes")} />
      </div>
      <Textarea label={t.r2PbPledgeField} rows={3} maxLength={1000} value={f.pledge} onChange={set("pledge")} error={e("pledge")} />
      <fieldset className="space-y-2">
        <legend className="font-medium">{t.r2PbOptions}</legend>
        {opts.map((o, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_10rem]">
            <Input label={`${t.r2PbOptTitle} ${i + 1}`} value={o.title} onChange={(ev) => setOpts((a) => a.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
            <Input label={t.r2PbOptCost} inputMode="decimal" value={o.cost} onChange={(ev) => setOpts((a) => a.map((x, j) => (j === i ? { ...x, cost: ev.target.value } : x)))} />
          </div>
        ))}
        {(err === "options" || err === "cost") && <p role="alert" className="text-sm text-danger">{e(err)}</p>}
        {opts.length < 30 && <Button variant="secondary" onClick={() => setOpts((a) => [...a, { title: "", cost: "" }])}>{t.r2PbAddOpt}</Button>}
      </fieldset>
      <Button type="submit" loading={m.isPending}>{t.r2PbCreate}</Button>
    </form>
  );
}

function Row({ c }: { c: OfficePb }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const label = (t as unknown as Record<string, string>)[`r2PbOfficeStatus_${c.status}`] ?? c.status;
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={c.status === "open" ? "success" : "neutral"}>{label}</Badge>
        <p className="min-w-0 flex-1 break-words font-medium">{c.title}</p>
        <span className="text-sm text-muted">{fmtDay(c.closes_at, lang)}</span>
      </div>
      <Button variant="ghost" aria-expanded={open} onClick={() => setOpen((x) => !x)}>{t.r2PbSee}</Button>
      {open && <Manage refId={c.ref} />}
    </div>
  );
}

function Manage({ refId }: { refId: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const v = useQuery({ queryKey: ["office-pb", refId], queryFn: () => fetchOfficePb(refId), retry: false });
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const act = useMutation({
    mutationFn: (a: { action: Parameters<typeof pbAct>[1]; body?: Record<string, unknown> }) => pbAct(refId, a.action, a.body),
    onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["office-pb"] }); },
    onError: fail,
  });
  if (!v.data) return <p role="status">{t.r1Loading}</p>;
  const c = v.data;
  return (
    <div className="space-y-3">
      <p className="text-sm">{t.r2PbBudget}: {money(c.budget_amount, "BDT", lang)} · {fillNum(t.r2PbLive, { n: c.participants }, lang)}</p>
      <p className="break-words text-sm text-muted">{c.pledge}</p>
      {(c.status === "draft") && <ConfirmAction label={t.r2PbReqOpen} body={t.r2PbReqOpenBody} loading={act.isPending} onConfirm={() => act.mutateAsync({ action: "request-open" })} />}
      {c.status === "pending_approval" && (
        <div className="space-y-2">
          <Textarea label={t.r2Reason} optional rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button loading={act.isPending} onClick={() => act.mutate({ action: "decision", body: { decision: "approve", ...(note.trim() ? { note: note.trim() } : {}) } })}>{t.r2PbApprove}</Button>
            <Button variant="danger" disabled={note.trim().length < 5} loading={act.isPending} onClick={() => act.mutate({ action: "decision", body: { decision: "reject", note: note.trim() } })}>{t.r2PbRejectBtn}</Button>
          </div>
        </div>
      )}
      {c.status === "open" && <ConfirmAction label={t.r2PbCloseBtn} body={t.r2PbCloseBody} loading={act.isPending} onConfirm={() => act.mutateAsync({ action: "close" })} />}
      {c.status === "closed" && !c.outcome_recorded && c.followed_result === null && (
        <div className="space-y-2">
          <Textarea label={t.r2PbOutcomeReason} optional rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <ConfirmAction label={t.r2PbFollowedYes} body={t.r2PbOutcomeBody} loading={act.isPending} onConfirm={() => act.mutateAsync({ action: "outcome", body: { followed: true } })} />
            <ConfirmAction label={t.r2PbFollowedNo} variant="danger" body={t.r2PbOutcomeBody} disabled={reason.trim().length < 10} loading={act.isPending} onConfirm={() => act.mutateAsync({ action: "outcome", body: { followed: false, reason: reason.trim() } })} />
          </div>
        </div>
      )}
      {(c.status === "draft" || c.status === "pending_approval" || c.status === "open") && (
        <div className="space-y-2">
          <Textarea label={t.r2Reason} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <ConfirmAction label={t.r2PbCancel} variant="danger" body={t.r2PbCancelBody} disabled={reason.trim().length < 5} loading={act.isPending} onConfirm={() => act.mutateAsync({ action: "cancel", body: { reason: reason.trim() } })} />
        </div>
      )}
    </div>
  );
}
