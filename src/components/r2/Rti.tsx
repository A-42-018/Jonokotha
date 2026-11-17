"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { createRti, deleteRti, fetchRtiDrafts, fetchRtiGuide, patchRti, rtiProblem, type RtiInput } from "@/lib/r2-api";
import type { RtiDraft } from "@/lib/types";
import { Ext, Gate, useR2Fail } from "./bits";

/** Right to Information helper (F8.7): a guide, a draft with bracketed blanks, and self-reported dates. It never files or sends anything. */
export default function Rti({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><Inner signedIn={signedIn} /></QueryProvider>;
}

function Inner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const g = useQuery({ queryKey: ["rti-guide"], queryFn: fetchRtiGuide, retry: false });
  return (
    <AsyncBlock pending={g.isPending} error={g.error} onRetry={() => void g.refetch()}>
      <Gate data={g.data}>
        {(guide) => (
          <div className="space-y-4">
            <div className="rounded-xl border border-civic/30 bg-civic/5 p-3 text-sm"><p className="font-medium">{t.r2RtNever}</p><p>{t.r2RtNotLegal}</p></div>
            {!guide.reviewed && <p role="note" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.r2RtUnreviewed}</p>}
            <Card title={t.r2RtSteps} headingAs="h2"><ol className="list-decimal space-y-1 ps-5">{(lang === "bn" ? guide.steps_bn : guide.steps_en).map((s) => <li key={s}>{s}</li>)}</ol></Card>
            <Card title={t.r2RtDeadlines} headingAs="h2">
              <p>{fillNum(t.r2RtRespond, { n: guide.respond_working_days, m: guide.respond_working_days_multiple_units }, lang)}</p>
              <p>{fillNum(t.r2RtAppeal, { n: guide.appeal_days_after_decision }, lang)}</p>
            </Card>
            {guide.official_channels.length > 0 && (
              <Card title={t.r2RtChannels} headingAs="h2">
                <ul className="space-y-1">{guide.official_channels.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    {c.url ? <Ext href={c.url}>{(lang === "bn" ? c.name_bn : c.name_en) ?? c.name ?? c.url}</Ext> : <span>{(lang === "bn" ? c.name_bn : c.name_en) ?? c.name}</span>}
                    <Badge tone={c.verified ? "success" : "warning"}>{c.verified ? t.r2RtVerifiedChannel : t.r2RtUnverifiedChannel}</Badge>
                  </li>
                ))}</ul>
              </Card>
            )}
            {signedIn ? <><NewDraft /><Mine /></> : <p><a href="/login?next=/rti" className="text-civic underline">{t.r2SignIn}</a> · {t.r2RtSignIn}</p>}
          </div>
        )}
      </Gate>
    </AsyncBlock>
  );
}

function NewDraft() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [f, setF] = useState({ agency: "", subject: "", info: "", period: "", format: "electronic" as RtiInput["format"], language: lang });
  const [err, setErr] = useState<ReturnType<typeof rtiProblem>>(null);
  const [made, setMade] = useState<{ text: string; removed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(null); };
  const m = useMutation({
    mutationFn: () => createRti({ agency_name: f.agency.trim(), subject: f.subject.trim(), info_requested: f.info.trim(), ...(f.period.trim() ? { period: f.period.trim() } : {}), format: f.format, language: f.language }, key),
    onSuccess: (r) => { setMade({ text: r.draft_text, removed: r.personal_data_removed }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["rti-drafts"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); if (e instanceof ApiError && /limit|max/.test(e.fieldErrors._ ?? "")) toast("error", t.r2RtLimit); else fail(e); },
  });
  return (
    <div className="space-y-3">
      <form noValidate onSubmit={(e) => { e.preventDefault(); const p = rtiProblem(f); setErr(p); if (!p) m.mutate(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
        <h2 className="jk-h2">{t.r2RtNew}</h2>
        <Input label={t.r2RtAgency} maxLength={150} value={f.agency} onChange={set("agency")} error={err === "agency" ? t.r2RtErr_agency : undefined} />
        <Input label={t.r2RtSubject} maxLength={150} value={f.subject} onChange={set("subject")} error={err === "subject" ? t.r2RtErr_subject : undefined} />
        <Textarea label={t.r2RtInfo} rows={5} maxLength={2000} value={f.info} onChange={set("info")} error={err === "info" ? t.r2RtErr_info : undefined} />
        <Input label={t.r2RtPeriod} optional maxLength={100} value={f.period} onChange={set("period")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t.r2RtFormat} value={f.format} onChange={(e) => setF((s) => ({ ...s, format: e.target.value as RtiInput["format"] }))} options={(["electronic", "paper_copy", "inspection"] as const).map((k) => ({ value: k, label: t[`r2RtFormat_${k}`] }))} />
          <Select label={t.r2RtLang} value={f.language} onChange={(e) => setF((s) => ({ ...s, language: e.target.value as "bn" | "en" }))} options={[{ value: "bn", label: "বাংলা" }, { value: "en", label: "English" }]} />
        </div>
        <Button type="submit" loading={m.isPending}>{t.r2RtMake}</Button>
      </form>
      {made && (
        <section role="status" className="space-y-2 rounded-2xl border border-leaf/50 bg-leaf/10 p-4">
          <h3 className="font-semibold">{t.r2RtDraftReady}</h3>
          {made.removed && <p className="text-sm">{t.r2RtRemoved}</p>}
          <pre className="whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-sm">{made.text}</pre>
          <p className="text-sm">{t.r2RtPlaceholders}</p>
          <p className="text-sm font-medium">{t.r2RtNothingSent}</p>
          <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(made.text).then(() => setCopied(true)).catch(() => {}); }}>{copied ? t.r2RtCopied : t.r2RtCopy}</Button>
        </section>
      )}
    </div>
  );
}

function Mine() {
  const t = useT();
  const q = useQuery({ queryKey: ["rti-drafts"], queryFn: fetchRtiDrafts, retry: false });
  return (
    <section aria-labelledby="rti-mine" className="space-y-2">
      <h2 id="rti-mine" className="jk-h2">{t.r2RtMine}</h2>
      <Gate data={q.data}>{(rows) => rows.length === 0 ? <p className="text-muted">{t.r2RtNoDrafts}</p> : <ul className="space-y-3">{rows.map((d) => <li key={d.id}><Draft d={d} /></li>)}</ul>}</Gate>
    </section>
  );
}

function Draft({ d }: { d: RtiDraft }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState("");
  const [channel, setChannel] = useState("in_person");
  const [ref, setRef] = useState("");
  const done = () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["rti-drafts"] }); };
  const patch = useMutation({ mutationFn: (b: Parameters<typeof patchRti>[1]) => patchRti(d.id, b), onSuccess: done, onError: fail });
  const del = useMutation({ mutationFn: () => deleteRti(d.id), onSuccess: done, onError: fail });
  const tl = d.timeline;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card as="article" title={d.subject} headingAs="h3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={tl.state === "past_earliest_deadline" ? "warning" : tl.state === "answered" ? "success" : "neutral"}>{t[`r2RtState_${tl.state}`]}</Badge>
        <span className="text-sm text-muted">{d.agency_name} · {fmtDay(d.created_at, lang)}</span>
      </div>
      {tl.earliest_due_on && <p className="text-sm">{fillNum(t.r2RtDue, { date: fmtDay(tl.earliest_due_on, lang) }, lang)}</p>}
      {d.filed_on && <p className="text-sm text-muted">{t.r2RtFiledOn}: {fmtDay(d.filed_on, lang)}</p>}
      <p className="text-sm text-muted">{t.r2RtSelf}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" aria-expanded={open} onClick={() => setOpen((x) => !x)}>{t.r2PbSee}</Button>
        <ConfirmAction label={t.r2RtDelete} variant="danger" body={t.r2RtDeleteBody} loading={del.isPending} onConfirm={() => del.mutateAsync()} />
      </div>
      {open && (
        <div className="mt-2 space-y-3">
          <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm">{d.draft_text}</pre>
          {d.status === "draft" && (
            <div className="space-y-2">
              <Input type="date" label={t.r2RtFiledOn} max={today} value={on} onChange={(e) => setOn(e.target.value)} />
              <Select label={t.r2RtChannel} value={channel} onChange={(e) => setChannel(e.target.value)} options={(["in_person", "post", "email", "official_portal"] as const).map((k) => ({ value: k, label: t[`r2RtChannel_${k}`] }))} />
              <Input label={t.r2RtAgencyRef} optional maxLength={120} value={ref} onChange={(e) => setRef(e.target.value)} />
              <Button disabled={!on} loading={patch.isPending} onClick={() => patch.mutate({ action: "mark_filed", on, channel, ...(ref.trim() ? { agency_reference: ref.trim() } : {}) })}>{t.r2RtMarkFiled}</Button>
            </div>
          )}
          {d.status === "filed_by_me" && <div className="flex flex-wrap gap-2"><Button loading={patch.isPending} onClick={() => patch.mutate({ action: "mark_answered", on: today })}>{t.r2RtMarkAnswered}</Button><Button variant="secondary" loading={patch.isPending} onClick={() => patch.mutate({ action: "mark_appealed", on: today })}>{t.r2RtMarkAppealed}</Button></div>}
          {(d.status === "answered" || d.status === "appealed") && <Button variant="secondary" loading={patch.isPending} onClick={() => patch.mutate({ action: "close" })}>{t.r2RtClose}</Button>}
        </div>
      )}
    </Card>
  );
}
