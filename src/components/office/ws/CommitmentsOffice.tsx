"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { createCommitment, decideCommitment, fetchOfficeCommitments, setCommitmentStatus, statusProblem, type OfficeCommitment } from "@/lib/commitments-api";
import { fmtDay } from "@/lib/format";
import Boundary from "./Boundary";

/** Office: write down a commitment, publish it (with the MP's approval where the area needs it), and keep its status honest. Delivered needs proof; delayed and dropped need a public reason. */
export default function CommitmentsOffice(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

const NEXT = ["in_progress", "delivered", "delayed", "dropped"] as const;

function useFail() {
  const t = useT();
  const toast = useToast();
  return (e: unknown) => toast("error", e instanceof ApiError && e.status === 403 ? t.tkoNoAccess : t.r1FailMsg);
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-commitments"], queryFn: fetchOfficeCommitments, retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.tkPlannedTitle} body={t.r1PlannedBody} />;
  return (
    <div className="space-y-4">
      <NewCommitment constituency={constituency} />
      <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.tkoEmpty}>
        {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((c) => <li key={c.ref}><Row c={c} /></li>)}</ul> : null}
      </Boundary>
    </div>
  );
}

function NewCommitment({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const [f, setF] = useState({ title: "", desc: "", due: "", project: "", idea: "", ann: "" });
  const [publish, setPublish] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: () => createCommitment({ constituency, title: f.title.trim(), ...(f.desc.trim() ? { description: f.desc.trim() } : {}), ...(f.due ? { due_date: f.due } : {}), ...(f.project.trim() ? { project_ref: f.project.trim() } : {}), ...(f.idea.trim() ? { idea_ref: f.idea.trim() } : {}), ...(f.ann.trim() ? { announcement_ref: f.ann.trim() } : {}), publish }, key),
    onSuccess: (r) => { toast("success", r.status === "pending_approval" ? t.tkoWaiting : t.tkoCreated); setF({ title: "", desc: "", due: "", project: "", idea: "", ann: "" }); setPublish(false); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-commitments"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(""); };
  const ok = f.title.trim().length >= 5 && f.title.trim().length <= 150;
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); if (!ok) { setErr(t.tkoName); return; } if (!publish) m.mutate(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="jk-h2">{t.tkoNew}</h2>
      <Input label={t.tkoName} maxLength={150} value={f.title} error={err || undefined} onChange={set("title")} />
      <Textarea label={t.tkoDesc} optional rows={3} maxLength={1500} value={f.desc} onChange={set("desc")} />
      <Input type="date" label={t.tkoDue} optional value={f.due} onChange={set("due")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={t.tkoProject} optional hint={t.tkoLinkHint} value={f.project} onChange={set("project")} />
        <Input label={t.tkoIdea} optional value={f.idea} onChange={set("idea")} />
        <Input label={t.tkoAnn} optional value={f.ann} onChange={set("ann")} />
      </div>
      <Checkbox label={t.tkoPublishNow} hint={t.tkoPublishNote} checked={publish} onChange={(e) => setPublish(e.target.checked)} />
      {publish ? <ConfirmAction label={t.tkoCreate} body={t.tkoConfirmPublish} disabled={!ok} loading={m.isPending} onConfirm={() => m.mutateAsync()} /> : <Button type="submit" loading={m.isPending}>{t.tkoCreate}</Button>}
    </form>
  );
}

function Row({ c }: { c: OfficeCommitment }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const label = c.status === "draft" || c.status === "pending_approval" ? t[`tkoSt_${c.status}` as "tkoSt_draft"] : t[`tkSt_${c.status}` as "tkSt_planned"];
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={c.status === "delivered" ? "success" : c.status === "delayed" ? "warning" : c.status === "dropped" ? "danger" : "neutral"}>{label}</Badge>
        <p className="min-w-0 flex-1 break-words font-medium">{c.title}</p>
        {c.due_date && <span className="text-sm text-muted">{fmtDay(c.due_date, lang)}</span>}
      </div>
      {c.status === "pending_approval" && <Decision refId={c.ref} />}
      {c.published_at && <><Button variant="ghost" aria-expanded={open} onClick={() => setOpen((x) => !x)}>{t.tkoUpdate}</Button>{open && <StatusForm refId={c.ref} onDone={() => setOpen(false)} />}</>}
    </div>
  );
}

function Decision({ refId }: { refId: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const [note, setNote] = useState("");
  const m = useMutation({ mutationFn: (d: "approve" | "reject") => decideCommitment(refId, d, note.trim() || undefined), onSuccess: () => { toast("success", t.tkoDecided); void qc.invalidateQueries({ queryKey: ["office-commitments"] }); }, onError: fail });
  return (
    <div className="space-y-2">
      <Textarea label={t.tkoDecisionNote} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button loading={m.isPending} onClick={() => m.mutate("approve")}>{t.tkoApprove}</Button>
        <Button variant="danger" disabled={note.trim().length < 5} loading={m.isPending} onClick={() => m.mutate("reject")}>{t.tkoReject}</Button>
      </div>
    </div>
  );
}

function StatusForm({ refId, onDone }: { refId: string; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const [s, setS] = useState<(typeof NEXT)[number]>("in_progress");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const problem = statusProblem(s, note, url, text);
  const m = useMutation({
    mutationFn: () => setCommitmentStatus(refId, { status: s, ...(note.trim() ? { note: note.trim() } : {}), ...(s === "delivered" && url.trim() ? { evidence_url: url.trim() } : {}), ...(s === "delivered" && text.trim() ? { evidence_text: text.trim() } : {}) }),
    onSuccess: () => { toast("success", t.tkoUpdated); void qc.invalidateQueries({ queryKey: ["office-commitments"] }); onDone(); },
    onError: fail,
  });
  return (
    <div className="space-y-3">
      <Select label={t.tkoNewStatus} value={s} onChange={(e) => setS(e.target.value as typeof s)} options={NEXT.map((x) => ({ value: x, label: t[`tkSt_${x}` as "tkSt_planned"] }))} />
      <Textarea label={t.tkoNote} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} error={problem === "note" ? t.tkoNoteNeeded : undefined} />
      {s === "delivered" && (
        <>
          <Input label={t.tkoEvUrl} inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} error={problem === "url" ? t.tkoEvUrlBad : undefined} />
          <Textarea label={t.tkoEvText} hint={t.tkoEvNeeded} rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        </>
      )}
      <ConfirmAction label={t.tkoUpdate} body={t.tkoUpdateConfirm} disabled={problem !== null} loading={m.isPending} onConfirm={() => m.mutateAsync()} />
    </div>
  );
}
