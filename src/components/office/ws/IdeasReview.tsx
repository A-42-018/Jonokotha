"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtNum } from "@/lib/format";
import { toIdea, type ApiIdea } from "@/lib/ideas-api";
import { decideIdea, decisionNeedsNote, fetchIdeasForReview, IDEA_DECISIONS, type IdeaDecision } from "@/lib/office-workspace-api";
import Boundary, { label, saveError } from "./Boundary";

export default function IdeasReview({ constituency }: { constituency: string }) {
  return <QueryProvider><Inner constituency={constituency} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-ideas", constituency], queryFn: () => fetchIdeasForReview(constituency), retry: false });
  return (
    <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.owIdeasEmpty}>
      {(rows) => <ul className="space-y-3">{rows.map((r) => <li key={r.ref}><Row constituency={constituency} idea={r} /></li>)}</ul>}
    </Boundary>
  );
}

function Row({ constituency, idea }: { constituency: string; idea: ApiIdea }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [d, setD] = useState<IdeaDecision>("under_consideration");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const m = useMutation({
    mutationFn: () => decideIdea(idea.ref, d, note),
    onSuccess: () => { toast("success", t.owSaved); setNote(""); void qc.invalidateQueries({ queryKey: ["office-ideas", constituency] }); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  const i = toIdea(idea);
  const pastThreshold = !!idea.threshold_reached_at;   // B7.5: the server wants a reasoned note (20+) on an idea past the threshold
  const submit = () => {
    if (decisionNeedsNote(d) && note.trim().length < 5) { setErr(t.owIdeaReasonNeeded); return; }
    if (pastThreshold && note.trim().length < 20) { setErr(t.ipNeedLong); return; }
    setErr("");
    m.mutate();
  };
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{label(t, "idSub_", i.status)}</Badge>
        <span className="text-sm text-muted">{fmtNum(i.supports, lang)} {t.owIdeaSupports}</span>
        {pastThreshold && <Badge tone="warning" icon="⏳">{t.ipReached}</Badge>}
      </div>
      <h2 className="text-lg font-semibold">{i.title}</h2>
      <p className="whitespace-pre-line text-muted">{i.summary}</p>
      {i.reason && <p className="text-sm"><span className="font-medium">{t.owIdeaReason}:</span> {i.reason}</p>}
      <form className="space-y-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Select label={t.owIdeaDecision} value={d} onChange={(e) => setD(e.target.value as IdeaDecision)}
          options={IDEA_DECISIONS.map((x) => ({ value: x, label: label(t, "owDecision_", x) }))} />
        <Textarea label={t.owIdeaReason} hint={t.owIdeaReasonHint} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} error={err || undefined} optional={!decisionNeedsNote(d) && !pastThreshold} />
        <p className="text-sm text-muted">{t.owPublicWarn}</p>
        <Button type="submit" disabled={m.isPending}>{t.owIdeaSubmit}</Button>
      </form>
    </article>
  );
}
