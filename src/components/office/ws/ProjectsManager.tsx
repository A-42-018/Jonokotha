"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { fetchProject, fetchProjects, MILESTONE_STATUSES, PROJECT_STATUSES, type ProjectItem } from "@/lib/projects-api";
import { addMilestone, createProject, milestoneNeedsNote, projectBody, setMilestone, sourceNeedsDate } from "@/lib/office-workspace-api";
import Boundary, { label, saveError } from "./Boundary";

export default function ProjectsManager({ constituency }: { constituency: string }) {
  return <QueryProvider><Inner constituency={constituency} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-projects", constituency], queryFn: () => fetchProjects(constituency), retry: false });
  return (
    <div className="space-y-4">
      <NewProjectForm constituency={constituency} />
      <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.owPEmpty}>
        {(rows) => <ul className="space-y-3">{rows.map((p) => <li key={p.ref}><ProjectCard p={p} /></li>)}</ul>}
      </Boundary>
      <div className="grid gap-3 md:grid-cols-2">
        <PlannedPanel as="h2" title={t.owPEvidenceTitle} body={t.owPEvidenceBody} />
        <PlannedPanel as="h2" title={t.owMpTitle} body={t.owMpBody} />
      </div>
    </div>
  );
}

function NewProjectForm({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({ status: "planned" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => createProject(projectBody(f, constituency), key),
    onSuccess: () => { toast("success", t.owSaved); setF({ status: "planned" }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-projects", constituency] }); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if ((f.title ?? "").trim().length < 5) e.title = t.owPNameShort;
    if (sourceNeedsDate(f)) e.source_checked_at = t.owPSourceNeedsDate;
    setErr(e);
    if (Object.keys(e).length === 0) m.mutate();
  };
  return (
    <form noValidate className="space-y-3 rounded-2xl border border-line bg-white p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h2 className="jk-h2">{t.owPNew}</h2>
      <Input label={t.owPName} value={f.title ?? ""} onChange={set("title")} maxLength={150} error={err.title} />
      <Textarea label={t.owPDesc} value={f.description ?? ""} onChange={set("description")} rows={3} maxLength={3000} optional />
      <Select label={t.owPStatus} value={f.status} onChange={set("status")} options={PROJECT_STATUSES.map((s) => ({ value: s, label: label(t, "owPStatus_", s) }))} />
      <Input label={t.owPBudget} hint={t.owPBudgetHint} value={f.budget_text ?? ""} onChange={set("budget_text")} maxLength={200} optional />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t.owPStart} type="date" value={f.start_date ?? ""} onChange={set("start_date")} optional />
        <Input label={t.owPEnd} type="date" value={f.expected_end_date ?? ""} onChange={set("expected_end_date")} optional />
        <Input label={t.owPSource} type="url" dir="ltr" value={f.source_url ?? ""} onChange={set("source_url")} maxLength={500} optional />
        <Input label={t.owPChecked} type="date" value={f.source_checked_at ?? ""} onChange={set("source_checked_at")} error={err.source_checked_at} optional />
      </div>
      <p className="text-sm text-muted">{t.owPublicWarn}</p>
      <Button type="submit" disabled={m.isPending}>{t.owPCreate}</Button>
    </form>
  );
}

function ProjectCard({ p }: { p: ProjectItem }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{label(t, "owPStatus_", p.status)}</Badge>
        {p.is_sample && <Badge>{t.owSample}</Badge>}
      </div>
      <h2 className="jk-h2">{p.title}</h2>
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{t.owMilestones}<span className="sr-only">: {p.title}</span></Button>
      {open && <Milestones refId={p.ref} />}
    </article>
  );
}

function Milestones({ refId }: { refId: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["office-project", refId], queryFn: () => fetchProject(refId), retry: false });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["office-project", refId] }); };
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const add = useMutation({
    mutationFn: () => addMilestone(refId, title, due),
    onSuccess: () => { toast("success", t.owSaved); setTitle(""); setDue(""); refresh(); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  return (
    <div className="space-y-3 border-t border-line pt-3">
      <Boundary q={q} emptyTitle={t.owMsNone}>
        {(d) => (
          <>
            {d.milestones.length === 0 && <p className="text-muted">{t.owMsNone}</p>}
            <ul className="space-y-3">{d.milestones.map((m) => <li key={m.id}><MilestoneRow refId={refId} m={m} onDone={refresh} /></li>)}</ul>
          </>
        )}
      </Boundary>
      <form className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (title.trim().length >= 3) add.mutate(); }}>
        <Input label={t.owMsTitle} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        <Input label={t.owMsDue} type="date" value={due} onChange={(e) => setDue(e.target.value)} optional />
        <Button type="submit" disabled={add.isPending || title.trim().length < 3}>{t.owMsAdd}</Button>
      </form>
    </div>
  );
}

function MilestoneRow({ refId, m, onDone }: { refId: string; m: { id: string; title: string; status: string; note: string | null }; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const [s, setS] = useState<string>(m.status);
  const [note, setNote] = useState(m.note ?? "");
  const [err, setErr] = useState("");
  const save = useMutation({
    mutationFn: () => setMilestone(refId, m.id, s, note),
    onSuccess: () => { toast("success", t.owSaved); onDone(); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  return (
    <form className="space-y-2 rounded-xl bg-slate-50 p-3" onSubmit={(e) => { e.preventDefault(); if (milestoneNeedsNote(s) && !note.trim()) { setErr(t.owMsNoteNeeded); return; } setErr(""); save.mutate(); }}>
      <h3 className="font-medium">{m.title}</h3>
      <Select label={t.owMsStatus} value={s} onChange={(e) => setS(e.target.value)} options={MILESTONE_STATUSES.map((x) => ({ value: x, label: label(t, "owMs_", x) }))} />
      <Textarea label={t.owMsNote} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} error={err || undefined} optional={!milestoneNeedsNote(s)} />
      <Button type="submit" variant="secondary" disabled={save.isPending}>{t.owMsSave}</Button>
    </form>
  );
}
