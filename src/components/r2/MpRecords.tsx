"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDay } from "@/lib/format";
import { createMpRecord, draftMpSummary, fetchAdminMpRecords, fetchMpRecords, MP_KINDS, publishMpRecord, withdrawMpRecord, type AdminMpRecord } from "@/lib/r2-api";
import { Ext, Gate, useR2Fail } from "./bits";

/**
 * MP activity from official records (F8.8). One sourced event per card, newest first, a plain-language summary from the editorial team.
 * There is no count, rank, rating or score anywhere, no sort control, and the only filters are the member and the kind of event.
 */
export function MpRecords({ representativeId, name }: { representativeId?: string; name?: string }) {
  return <QueryProvider><List representativeId={representativeId} name={name} /></QueryProvider>;
}

function List({ representativeId, name }: { representativeId?: string; name?: string }) {
  const t = useT();
  const lang = useLang();
  const [kind, setKind] = useState("");
  const q = useQuery({ queryKey: ["mp-records", representativeId, kind], queryFn: () => fetchMpRecords({ ...(representativeId ? { representative_id: representativeId } : {}), ...(kind ? { kind } : {}) }), retry: false });
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
      <Gate data={q.data}>
        {(d) => (
          <div className="space-y-4">
            <p role="note" className="rounded-xl border border-civic/30 bg-civic/5 p-3 text-sm">{t.r2MrNeutral}</p>
            <Select label={t.r2MrKind} value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "", label: t.r2MrAll }, ...MP_KINDS.map((k) => ({ value: k, label: t[`r2MrKind_${k}`] }))]} />
            {name && <h2 className="text-lg font-semibold">{fillNum(t.r2MrFor, { name }, lang)}</h2>}
            {d.records.length === 0 ? <EmptyState title={t.r2MrEmpty} body={t.r2MrEmptyBody} /> : (
              <ul className="space-y-3">{d.records.map((r) => (
                <li key={r.ref}>
                  <Card as="article" title={r.title} headingAs="h3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone="teal">{t[`r2MrKind_${r.kind}`]}</Badge>
                      {r.is_sample && <CapabilityLabel status="sample" />}
                      {!representativeId && <span className="text-sm text-muted">{r.representative_name}</span>}
                    </div>
                    <p className="text-sm text-muted">{fillNum(t.r2MrOn, { date: fmtDay(r.occurred_on, lang) }, lang)}{r.session_label ? ` · ${fillNum(t.r2MrSession, { s: r.session_label }, lang)}` : ""}</p>
                    {r.summary_bn && <div className="mt-2"><p className="text-sm font-medium">{t.r2MrSummary}</p><p className="break-words">{r.summary_bn}</p></div>}
                    <p className="mt-2 text-sm text-muted">{fillNum(t.r2MrSourceName, { name: r.source_name }, lang)} · {fillNum(t.r2MrCheckedOn, { date: fmtDay(r.source_checked_at, lang) }, lang)}</p>
                    <p className="text-sm"><Ext href={r.source_url}>{t.r2MrOpenSource}</Ext></p>
                  </Card>
                </li>
              ))}</ul>
            )}
            <p className="text-sm text-muted">{t.r2MrNotAll}</p>
          </div>
        )}
      </Gate>
    </AsyncBlock>
  );
}

// Admin -----------------------------------------------------------------------------------------------------------------------------------------------
export function MpRecordsAdmin() {
  return <QueryProvider><Admin /></QueryProvider>;
}

function Admin() {
  const t = useT();
  const q = useQuery({ queryKey: ["admin-mp-records"], queryFn: fetchAdminMpRecords, retry: false });
  return (
    <Gate data={q.data}>
      {() => (
        <div className="space-y-4">
          <NewRecord />
          <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.r2MrEmpty}>
            {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((r) => <li key={r.ref}><AdminRow r={r} /></li>)}</ul> : null}
          </Boundary>
        </div>
      )}
    </Gate>
  );
}

function NewRecord() {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const today = new Date().toISOString().slice(0, 10);
  const blank = { rep: "", kind: "question_asked", title: "", on: "", session: "", source: "", url: "", checked: today, excerpt: "" };
  const [f, setF] = useState(blank);
  const [bad, setBad] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setBad(false); };
  const ok = f.rep.trim() && f.title.trim().length >= 5 && f.on && f.source.trim().length >= 2 && /^https:\/\/\S+$/.test(f.url.trim()) && f.checked;
  const m = useMutation({
    mutationFn: () => createMpRecord({ representative_id: f.rep.trim(), kind: f.kind, title: f.title.trim(), occurred_on: f.on, ...(f.session.trim() ? { session_label: f.session.trim() } : {}), source_name: f.source.trim(), source_url: f.url.trim(), source_checked_at: f.checked, ...(f.excerpt.trim() ? { excerpt: f.excerpt.trim() } : {}) }, key),
    onSuccess: () => { toast("success", t.r2Done); setF(blank); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["admin-mp-records"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); if (!ok) { setBad(true); return; } m.mutate(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{t.r2MrNewRecord}</h2>
      {bad && <p role="alert" className="text-sm text-danger">{t.r2MrErr}</p>}
      <Input label={t.r2MrRep} value={f.rep} onChange={set("rep")} />
      <Select label={t.r2MrKind} value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))} options={MP_KINDS.map((k) => ({ value: k, label: t[`r2MrKind_${k}`] }))} />
      <Input label={t.r2MrRecTitle} maxLength={200} value={f.title} onChange={set("title")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="date" label={t.r2MrRecDate} value={f.on} onChange={set("on")} />
        <Input label={t.r2MrRecSession} optional value={f.session} onChange={set("session")} />
      </div>
      <Input label={t.r2MrRecSource} value={f.source} onChange={set("source")} />
      <Input label={t.r2MrRecUrl} inputMode="url" value={f.url} onChange={set("url")} />
      <Input type="date" label={t.r2MrRecChecked} max={today} value={f.checked} onChange={set("checked")} />
      <Textarea label={t.r2MrRecExcerpt} optional rows={4} maxLength={1500} value={f.excerpt} onChange={set("excerpt")} />
      <Button type="submit" loading={m.isPending}>{t.r2MrAdd}</Button>
    </form>
  );
}

function AdminRow({ r }: { r: AdminMpRecord }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [summary, setSummary] = useState(r.summary_bn ?? r.summary_draft ?? "");
  const [fromDraft, setFromDraft] = useState(!!r.summary_draft && !r.summary_bn);
  const [reason, setReason] = useState("");
  const [none, setNone] = useState(false);
  const done = () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["admin-mp-records"] }); };
  const draft = useMutation({ mutationFn: () => draftMpSummary(r.ref), onSuccess: (d) => { if (d.summary_draft) { setSummary(d.summary_draft); setFromDraft(true); setNone(false); } else setNone(true); }, onError: fail });
  const pub = useMutation({ mutationFn: () => publishMpRecord(r.ref, summary.trim(), fromDraft && summary.trim() === r.summary_draft), onSuccess: done, onError: fail });
  const wd = useMutation({ mutationFn: () => withdrawMpRecord(r.ref, reason.trim()), onSuccess: done, onError: fail });
  const tone = r.status === "published" ? "success" : r.status === "withdrawn" ? "neutral" : "warning";
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{t[`r2MrSt_${r.status as "draft" | "published" | "withdrawn"}`] ?? r.status}</Badge>
        <Badge tone="teal">{t[`r2MrKind_${r.kind as "other"}`] ?? r.kind}</Badge>
        {r.created_by_me && <Badge tone="info">{t.r2MrMine}</Badge>}
        <span className="text-sm text-muted">{fmtDay(r.occurred_on, lang)}</span>
      </div>
      <p className="break-words font-medium">{r.title}</p>
      <p className="text-sm"><Ext href={r.source_url}>{t.r2MrOpenSource}</Ext></p>
      {r.status === "draft" && (
        <div className="space-y-2">
          {r.has_excerpt && <Button variant="secondary" loading={draft.isPending} onClick={() => draft.mutate()}>{t.r2MrDraft}</Button>}
          {none && <p role="status" className="text-sm">{t.r2MrDraftNone}</p>}
          {fromDraft && <p className="text-sm text-muted">{t.r2MrDraftNote}</p>}
          <Textarea label={t.r2MrSummaryField} rows={4} maxLength={800} value={summary} onChange={(e) => { setSummary(e.target.value); setFromDraft(false); }} />
          {r.created_by_me && <p className="text-sm text-muted">{t.r2MrSelfReview}</p>}
          <ConfirmAction label={t.r2MrPublish} body={t.r2MrPublishBody} disabled={summary.trim().length < 10 || r.created_by_me} loading={pub.isPending} onConfirm={() => pub.mutateAsync()} />
        </div>
      )}
      {r.status !== "withdrawn" && (
        <div className="space-y-2">
          <Textarea label={t.r2Reason} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <ConfirmAction label={t.r2MrWithdraw} variant="danger" body={t.r2MrWithdrawBody} disabled={reason.trim().length < 5} loading={wd.isPending} onConfirm={() => wd.mutateAsync()} />
        </div>
      )}
    </div>
  );
}
