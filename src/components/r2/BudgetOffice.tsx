"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { addEntry, ascii, num, createSource, DOC_KINDS, ENTRY_KINDS, entryProblem, fetchAdminSources, fetchOfficeSources, sourceProblem, verifySource, withdrawSource, type EntryKind, type OfficeSource } from "@/lib/r2-api";
import { Ext, Gate, useR2Fail } from "./bits";
import type { BudgetDocKind } from "@/lib/types";

/** Office: record a budget document and the figures quoted from it (F8.1). Nothing is public until a different person verifies the document. */
export default function BudgetOffice(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

const STATUS_TONE = { pending: "warning", verified: "success", rejected: "danger", withdrawn: "neutral" } as const;

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-budget-sources"], queryFn: fetchOfficeSources, retry: false });
  return (
    <Gate data={q.data}>
      {() => (
        <div className="space-y-4">
          <NewSource constituency={constituency} />
          <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.r2Empty}>
            {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((s) => <li key={s.ref}><SourceRow s={s} /></li>)}</ul> : null}
          </Boundary>
        </div>
      )}
    </Gate>
  );
}

function NewSource({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [f, setF] = useState({ title: "", publisher: "", kind: "annual_budget" as BudgetDocKind, url: "", year: "", date: "", hash: "" });
  const [err, setErr] = useState<ReturnType<typeof sourceProblem>>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(null); };
  const m = useMutation({
    mutationFn: () => createSource({ constituency, title: f.title.trim(), publisher: f.publisher.trim(), doc_kind: f.kind, source_url: f.url.trim(), fiscal_year: ascii(f.year), ...(f.date ? { published_on: f.date } : {}), ...(f.hash.trim() ? { doc_sha256: f.hash.trim().toLowerCase() } : {}) }, key),
    onSuccess: () => { toast("success", t.r2Done); setF({ title: "", publisher: "", kind: "annual_budget", url: "", year: "", date: "", hash: "" }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-budget-sources"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  const msg = (k: NonNullable<typeof err>) => (err === k ? t[({ title: "r2BgErrTitle", publisher: "r2BgErrPublisher", url: "r2BgErrUrl", year: "r2BgErrYear", hash: "r2BgErrHash" } as const)[k]] : undefined);
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const p = sourceProblem({ title: f.title, publisher: f.publisher, source_url: f.url, fiscal_year: f.year, doc_sha256: f.hash }); setErr(p); if (!p) m.mutate(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{t.r2BgNewSource}</h2>
      <Input label={t.r2BgSrcTitle} maxLength={200} value={f.title} onChange={set("title")} error={msg("title")} />
      <Input label={t.r2BgSrcPublisher} maxLength={150} value={f.publisher} onChange={set("publisher")} error={msg("publisher")} />
      <Select label={t.r2BgSrcKind} value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value as BudgetDocKind }))} options={DOC_KINDS.map((k) => ({ value: k, label: t[`r2BgDoc_${k}`] }))} />
      <Input label={t.r2BgSrcUrl} inputMode="url" value={f.url} onChange={set("url")} error={msg("url")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t.r2BgSrcYear} value={f.year} onChange={set("year")} error={msg("year")} />
        <Input type="date" label={t.r2BgSrcDate} optional value={f.date} onChange={set("date")} />
      </div>
      <Input label={t.r2BgSrcHash} optional value={f.hash} onChange={set("hash")} error={msg("hash")} />
      <p className="text-sm text-muted">{t.r2BgNoteVerified}</p>
      <Button type="submit" loading={m.isPending}>{t.r2BgSrcAdd}</Button>
    </form>
  );
}

function SourceRow({ s }: { s: OfficeSource }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const w = useMutation({ mutationFn: () => withdrawSource(s.ref, reason.trim()), onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["office-budget-sources"] }); }, onError: fail });
  const live = s.status === "pending" || s.status === "verified";
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[s.status]}>{t[`r2BgStatus_${s.status}`]}</Badge>
        <p className="min-w-0 flex-1 break-words font-medium">{s.title}</p>
        <span className="text-sm text-muted">{s.fiscal_year} · {fillNum(t.r2BgEntryCount, { n: s.entries }, lang)}</span>
      </div>
      <p className="text-sm"><Ext href={s.source_url}>{t.r2OpenSource}</Ext></p>
      {s.verification_note && <p className="text-sm text-muted">{s.verification_note}</p>}
      {live && (
        <>
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen((x) => !x)}>{t.r2BgAddEntry}</Button>
          {open && <NewEntry source={s.ref} />}
          <div className="space-y-2">
            <Textarea label={t.r2Reason} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <ConfirmAction label={t.r2BgWithdraw} variant="danger" body={t.r2BgWithdrawBody} disabled={reason.trim().length < 5} loading={w.isPending} onConfirm={() => w.mutateAsync()} />
          </div>
        </>
      )}
    </div>
  );
}

function NewEntry({ source }: { source: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [f, setF] = useState({ kind: "allocated" as EntryKind, label: "", amount: "", page: "", project: "" });
  const [err, setErr] = useState<ReturnType<typeof entryProblem>>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(null); };
  const m = useMutation({
    mutationFn: () => addEntry(source, { kind: f.kind, label: f.label.trim(), amount: num(f.amount), source_page: f.page.trim(), ...(f.project.trim() ? { project_ref: f.project.trim() } : {}) }, key),
    onSuccess: () => { toast("success", t.r2Done); setF({ kind: "allocated", label: "", amount: "", page: "", project: "" }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-budget-sources"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const p = entryProblem({ label: f.label, amount: f.amount, source_page: f.page }); setErr(p); if (!p) m.mutate(); }} className="space-y-3 rounded-xl bg-slate-50 p-3">
      <Select label={t.r2BgEntryKind} value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value as EntryKind }))} options={ENTRY_KINDS.map((k) => ({ value: k, label: t[`r2BgKind_${k}`] }))} />
      <Input label={t.r2BgEntryLabel} maxLength={150} value={f.label} onChange={set("label")} error={err === "label" ? t.r2BgErrLabel : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t.r2BgEntryAmount} inputMode="decimal" value={f.amount} onChange={set("amount")} error={err === "amount" ? t.r2BgErrAmount : undefined} />
        <Input label={t.r2BgEntryPage} value={f.page} onChange={set("page")} error={err === "page" ? t.r2BgErrPage : undefined} />
      </div>
      <Input label={t.r2BgEntryProject} optional value={f.project} onChange={set("project")} />
      <Button type="submit" loading={m.isPending}>{t.r2BgAddEntry}</Button>
    </form>
  );
}

/** Moderator or administrator: the verification queue. A person cannot verify what they recorded themselves (the server enforces it; the message says why). */
export function BudgetAdmin() {
  return <QueryProvider><Queue /></QueryProvider>;
}

function Queue() {
  const t = useT();
  const q = useQuery({ queryKey: ["admin-budget-sources"], queryFn: fetchAdminSources, retry: false });
  return (
    <Gate data={q.data}>
      {() => (
        <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.filter((s) => s.status === "pending").length === 0} emptyTitle={t.r2BgQueueEmpty}>
          {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.filter((s) => s.status === "pending").map((s) => <li key={s.ref}><Review s={s} /></li>)}</ul> : null}
        </Boundary>
      )}
    </Gate>
  );
}

function Review({ s }: { s: OfficeSource }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [note, setNote] = useState("");
  const m = useMutation({ mutationFn: (d: "verify" | "reject") => verifySource(s.ref, d, note.trim() || undefined), onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["admin-budget-sources"] }); }, onError: fail });
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <p className="break-words font-medium">{s.title}</p>
      <p className="text-sm text-muted">{s.publisher} · {t[`r2BgDoc_${s.doc_kind}`]} · {s.fiscal_year} · {s.constituency} · {fillNum(t.r2BgEntryCount, { n: s.entries }, lang)}</p>
      <p className="text-sm"><Ext href={s.source_url}>{t.r2OpenSource}</Ext></p>
      <Textarea label={t.r2BgRejectNote} optional rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <ConfirmAction label={t.r2BgVerify} body={t.r2BgVerifyBody} loading={m.isPending} onConfirm={() => m.mutateAsync("verify")} />
        <Button variant="danger" disabled={note.trim().length < 5} loading={m.isPending} onClick={() => m.mutate("reject")}>{t.r2BgReject}</Button>
      </div>
    </div>
  );
}
