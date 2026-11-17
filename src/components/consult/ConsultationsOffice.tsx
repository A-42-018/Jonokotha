"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import Boundary from "@/components/office/ws/Boundary";
import {
  closesAtFromDay, createConsultation, decideConsultation, fetchOfficeConsultation, fetchOfficeConsultations, lines, makeSummary, moderateStatement, saveReport, setConsultationStatus,
  type OfficeConsultation,
} from "@/lib/consult-api";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { writeProblem } from "@/lib/r11";

/** Office side of consultations (F7.1): create, approve statements, open and close, MP approval, draft and publish the "you said, we did" report. */
export default function ConsultationsOffice(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

const STATUS_TONE = { draft: "neutral", pending_approval: "warning", open: "success", closed: "neutral", reported: "info", cancelled: "neutral" } as const;

function useFail() {
  const t = useT();
  const toast = useToast();
  return (e: unknown) => {
    if (e instanceof ApiError && e.status === 403) return toast("error", t.ofcNoAccess);
    const d = e instanceof ApiError ? e.fieldErrors._ : "";
    if (d === "not_enough_statements" || d === "no_statements") return toast("error", t.ofcNeed2);
    toast("error", writeProblem(e) === "auth" ? t.r1AuthMsg : t.r1FailMsg);
  };
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["office-consultations"], queryFn: fetchOfficeConsultations, retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.csPlannedTitle} body={t.csPlannedBody} />;
  return (
    <div className="space-y-4">
      {open ? <Detail refId={open} onBack={() => setOpen(null)} /> : (
        <>
          <NewForm constituency={constituency} onCreated={setOpen} />
          <section aria-labelledby="ofc-list" className="space-y-2">
            <h2 id="ofc-list" className="text-lg font-semibold">{t.ofcList}</h2>
            <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.ofcEmpty}>
              {(d) => d.kind === "ok" ? (
                <ul className="space-y-2">
                  {d.data.map((c) => (
                    <li key={c.ref} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
                      <div className="min-w-0 flex-1"><p className="break-words font-medium">{c.question}</p><p className="text-sm text-muted">{c.closes_at && fillNum(t.r1Closes, { date: fmtDay(c.closes_at, lang) }, lang)}</p></div>
                      <Badge tone={STATUS_TONE[c.status]}>{t[`ofcStatus_${c.status}` as "ofcStatus_open"]}</Badge>
                      <Button variant="secondary" onClick={() => setOpen(c.ref)}>{t.ofcOpenIt}</Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Boundary>
          </section>
        </>
      )}
    </div>
  );
}

function NewForm({ constituency, onCreated }: { constituency: string; onCreated: (ref: string) => void }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const [f, setF] = useState({ question: "", description: "", seeds: "", day: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: () => createConsultation({ constituency, question: f.question.trim(), ...(f.description.trim() ? { description: f.description.trim() } : {}), seed_statements: lines(f.seeds, 10), closes_at: closesAtFromDay(f.day) }, key),
    onSuccess: (r) => { toast("success", t.ofcCreated); setF({ question: "", description: "", seeds: "", day: "" }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-consultations"] }); onCreated(r.ref); },
    onError: (e) => {
      setKey(crypto.randomUUID());
      fail(e);
    },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = () => {
    const e: Record<string, string> = {};
    const qn = f.question.trim().length;
    if (qn < 10 || qn > 200) e.question = t.ofcQuestionHint;
    const seeds = lines(f.seeds, 11);
    if (seeds.length > 10 || seeds.some((s) => s.length < 5 || s.length > 140)) e.seeds = t.ofcSeedsHint;
    if (!f.day || Number.isNaN(Date.parse(f.day))) e.day = t.ofcClosesHint;
    else { const d = (Date.parse(f.day) - Date.now()) / 86_400_000; if (d < 0 || d > 120) e.day = t.ofcClosesHint; }
    setErr(e);
    if (Object.keys(e).length === 0) m.mutate();
  };
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{t.ofcNew}</h2>
      <Input label={t.ofcQuestion} hint={t.ofcQuestionHint} value={f.question} maxLength={200} error={err.question} onChange={set("question")} />
      <Textarea label={t.ofcDesc} optional rows={2} maxLength={1000} value={f.description} onChange={set("description")} />
      <Textarea label={t.ofcSeeds} hint={`${t.ofcSeedsHint} ${t.ofcNoSeeds}`} optional rows={5} value={f.seeds} error={err.seeds} onChange={set("seeds")} />
      <Input type="date" label={t.ofcCloses} hint={t.ofcClosesHint} value={f.day} error={err.day} onChange={set("day")} />
      <Button type="submit" loading={m.isPending}>{t.ofcCreate}</Button>
    </form>
  );
}

function Detail({ refId, onBack }: { refId: string; onBack: () => void }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-consultation", refId], queryFn: () => fetchOfficeConsultation(refId), retry: false });
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>← {t.ofcBack}</Button>
      <Boundary q={q} emptyTitle={t.ofcEmpty}>{(c) => <DetailBody c={c} />}</Boundary>
    </div>
  );
}

function DetailBody({ c }: { c: OfficeConsultation }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useFail();
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["office-consultation", c.ref] }); void qc.invalidateQueries({ queryKey: ["office-consultations"] }); };
  const approved = c.statements.filter((s) => s.status === "approved").length;
  const status = useMutation({
    mutationFn: (a: "open" | "close") => setConsultationStatus(c.ref, a),
    onSuccess: (r, a) => { toast("success", a === "close" ? t.ofcClosedOk : r.status === "pending_approval" ? t.ofcOpenedPending : t.ofcOpenedOk); refresh(); },
    onError: fail,
  });
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="break-words text-xl font-semibold">{c.question}</h2>
        <Badge tone={STATUS_TONE[c.status]}>{t[`ofcStatus_${c.status}` as "ofcStatus_open"]}</Badge>
        <p className="text-sm text-muted">{c.participants === null ? t.ofcParticipantsFew : fillNum(t.ofcParticipants, { n: c.participants }, "bn")}</p>
      </header>
      {c.status === "pending_approval" && <MpDecision refId={c.ref} onDone={refresh} />}
      <section aria-labelledby="ofc-st" className="space-y-2">
        <h3 id="ofc-st" className="text-lg font-semibold">{t.ofcStatements}</h3>
        {c.statements.length === 0 ? <p className="text-muted">{t.csNoStatements}</p> : <ul className="space-y-2">{c.statements.map((s) => <li key={s.id}><StatementRow refId={c.ref} s={s} onDone={refresh} /></li>)}</ul>}
      </section>
      <div className="flex flex-wrap gap-2">
        {c.status === "draft" && (approved < 2 ? <p className="text-sm text-muted">{t.ofcNeed2}</p> : <ConfirmAction label={t.ofcOpenNow} body={t.ofcOpenConfirm} loading={status.isPending} onConfirm={() => status.mutateAsync("open")} />)}
        {c.status === "open" && <ConfirmAction variant="secondary" label={t.ofcClose} body={t.ofcCloseConfirm} loading={status.isPending} onConfirm={() => status.mutateAsync("close")} />}
      </div>
      {(c.status === "open" || c.status === "closed" || c.status === "reported") && <ReportEditor c={c} onDone={refresh} />}
    </div>
  );
}

function StatementRow({ refId, s, onDone }: { refId: string; s: OfficeConsultation["statements"][number]; onDone: () => void }) {
  const t = useT();
  const fail = useFail();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const m = useMutation({ mutationFn: (a: "approve" | "reject") => moderateStatement(refId, s.id, a, a === "reject" ? reason.trim() : undefined), onSuccess: () => { setRejecting(false); onDone(); }, onError: fail });
  return (
    <Card as="div" className="space-y-2">
      <p className="break-words">{s.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={s.status === "approved" ? "success" : s.status === "rejected" ? "danger" : "warning"}>{t[`ofcStStatus_${s.status}` as "ofcStStatus_approved"]}</Badge>
        {s.status === "pending_review" && (
          <>
            <Button variant="secondary" loading={m.isPending && !rejecting} onClick={() => m.mutate("approve")}>{t.ofcApprove}</Button>
            <Button variant="ghost" onClick={() => setRejecting((x) => !x)}>{t.ofcReject}</Button>
          </>
        )}
      </div>
      {rejecting && (
        <div className="space-y-2">
          <Textarea label={t.ofcReasonLabel} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" disabled={reason.trim().length < 5} loading={m.isPending} onClick={() => m.mutate("reject")}>{t.ofcReject}</Button>
        </div>
      )}
      {s.status === "rejected" && s.reason && <p className="text-sm text-muted">{s.reason}</p>}
    </Card>
  );
}

function MpDecision({ refId, onDone }: { refId: string; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const fail = useFail();
  const [note, setNote] = useState("");
  const m = useMutation({ mutationFn: (d: "approve" | "reject") => decideConsultation(refId, d, note.trim() || undefined), onSuccess: () => { toast("success", t.ofcDecided); onDone(); }, onError: fail });
  return (
    <Card tone="warning" title={t.ofcDecisionTitle} headingAs="h3">
      <p className="mb-2">{t.ofcDecisionBody}</p>
      <Textarea label={t.ofcDecisionNote} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button loading={m.isPending} onClick={() => m.mutate("approve")}>{t.ofcApprove}</Button>
        <Button variant="danger" disabled={note.trim().length < 5} loading={m.isPending} onClick={() => m.mutate("reject")}>{t.ofcReject}</Button>
      </div>
    </Card>
  );
}

function ReportEditor({ c, onDone }: { c: OfficeConsultation; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const fail = useFail();
  const r = c.report;
  const [summary, setSummary] = useState(r?.summary_bn ?? "");
  const [said, setSaid] = useState(r?.you_said_we_did ?? "");
  const [actions, setActions] = useState((r?.actions ?? []).map((a) => a.text).join("\n"));
  const [aiNote, setAiNote] = useState<string | null>(null);
  const gen = useMutation({ mutationFn: () => makeSummary(c.ref), onSuccess: (d) => { setAiNote(d.ai_summary); if (d.ai_summary && !summary.trim()) setSummary(d.ai_summary); toast("success", t.ofcGenerated); onDone(); }, onError: fail });
  const save = useMutation({
    mutationFn: (publish: boolean) => saveReport(c.ref, { summary_bn: summary.trim(), ...(said.trim() ? { you_said_we_did: said.trim() } : {}), actions: lines(actions, 10).map((x) => ({ text: x })), publish }),
    onSuccess: (_d, publish) => { toast("success", publish ? t.ofcPublished : t.ofcSaved); onDone(); }, onError: fail,
  });
  const published = c.status === "reported";
  const canPublish = c.status === "closed" && summary.trim().length >= 10 && said.trim().length >= 20;
  return (
    <Card as="section" title={t.ofcReportTitle} headingAs="h3" className="space-y-3">
      {c.status === "closed" && <Button variant="secondary" loading={gen.isPending} onClick={() => gen.mutate()}>{gen.isPending ? t.ofcGenerating : t.ofcGenerate}</Button>}
      {(aiNote || r?.ai_summary) && <p className="rounded-xl bg-slate-100 p-3 text-sm"><span className="font-medium">{t.ofcAiNote}</span><br />{aiNote ?? r?.ai_summary}</p>}
      {!r && !published && <p className="text-muted">{t.ofcNoReport}</p>}
      {r && r.agreement.length > 0 && <p className="text-sm text-muted">{r.participants === null ? t.ofcParticipantsFew : fillNum(t.ofcParticipants, { n: r.participants }, "bn")}</p>}
      {!published && (
        <>
          <Textarea label={t.ofcSummary} rows={5} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} />
          <Textarea label={t.ofcYouSaid} hint={t.ofcYouSaidHint} rows={5} maxLength={3000} value={said} onChange={(e) => setSaid(e.target.value)} />
          <Textarea label={t.ofcActionsLabel} optional rows={3} value={actions} onChange={(e) => setActions(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={summary.trim().length < 10} loading={save.isPending} onClick={() => save.mutate(false)}>{t.ofcSaveDraft}</Button>
            <ConfirmAction label={t.ofcPublish} body={t.ofcPublishConfirm} disabled={!canPublish} loading={save.isPending} onConfirm={() => save.mutateAsync(true)} />
          </div>
        </>
      )}
    </Card>
  );
}
