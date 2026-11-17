"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { decideSuggestion, runCopilot, runDuplicates, runRouting, type Citation, type DecisionKind, type DuplicatesResult, type RoutingResult, type Suggestion } from "@/lib/office-api";
import { missingInfo } from "@/lib/office";
import { safeHref } from "@/lib/safe";
import type { Agency, CaseRecord } from "@/lib/types";

type Dict = ReturnType<typeof useT>;
type Decided = Record<string, "accepted" | "edited" | "dismissed">;

/** Decision buttons for one AI suggestion. Without a suggestion id there is nothing to decide (plain information). */
function Decide({ t, id, decided, busy, onDecide, onEdit }: { t: Dict; id?: string | null; decided?: Decided[string]; busy: boolean; onDecide: (d: DecisionKind) => void; onEdit?: () => void }) {
  if (!id) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={busy || !!decided} onClick={() => onDecide("accept")}>{t.cpAccept}</Button>
      {onEdit && <Button variant="secondary" disabled={busy || !!decided} onClick={onEdit}>{t.cpEdit}</Button>}
      <Button variant="ghost" disabled={busy || !!decided} onClick={() => onDecide("dismiss")}>{t.cpDismiss}</Button>
      {decided && <Badge tone={decided === "dismissed" ? "neutral" : "success"} icon={decided === "dismissed" ? "✕" : "✓"}>{t[`cpDecision_${decided}` as keyof typeof t] as string}</Badge>}
    </div>
  );
}

function Cites({ t, list }: { t: Dict; list: Citation[] }) {
  if (list.length === 0) return null;
  return <p className="text-xs text-muted">{t.cpCites}: {list.map((c) => c.label).join(", ")}</p>;
}

export default function Copilot(props: { c: CaseRecord; agency?: Agency; onAskInfo?: ReactNode }) {
  return <QueryProvider><CopilotInner {...props} /></QueryProvider>;
}

/**
 * AI copilot panel (staff only). The suggestions come from the server on request, each with the facts it cites and a Accept / Edit / Dismiss
 * decision that is audited. Nothing here changes a case: a public reply is posted by staff in the notes block, and status changes use the action buttons.
 * Without a suggestion the blocks show what the case already has (stored summary, rule-based missing-information check).
 */
function CopilotInner({ c, agency, onAskInfo }: { c: CaseRecord; agency?: Agency; onAskInfo?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [sugg, setSugg] = useState<Suggestion[]>();
  const [source, setSource] = useState<"ai" | "fallback">();
  const [routing, setRouting] = useState<RoutingResult>();
  const [dups, setDups] = useState<DuplicatesResult>();
  const [decided, setDecided] = useState<Decided>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const missing = missingInfo(c);
  const pct = Math.round(c.ai.confidence * 100);
  const by = (type: Suggestion["type"]) => sugg?.find((s) => s.type === type);
  const fail = (e: unknown) => toast("error", e instanceof ApiError && e.code === "unavailable" ? t.cpUnavailable : e instanceof ApiError && e.status === 403 ? t.ofToastForbidden : e instanceof ApiError && e.status === 429 ? t.askLimit : t.ofToastFail);

  const ask = useMutation({
    mutationFn: async () => {
      const [cp, rt, dp] = await Promise.allSettled([runCopilot(c.ref), runRouting(c.ref), runDuplicates(c.ref)]);
      if (cp.status === "rejected") throw cp.reason;
      return { cp: cp.value, rt: rt.status === "fulfilled" ? rt.value : undefined, dp: dp.status === "fulfilled" ? dp.value : undefined };
    },
    onSuccess: ({ cp, rt, dp }) => {
      setSugg(cp.suggestions); setSource(cp.source); setRouting(rt); setDups(dp); setDecided({});
      setDraft(String(cp.suggestions.find((s) => s.type === "reply_draft")?.payload.text ?? ""));
      void qc.invalidateQueries({ queryKey: ["office-issue", c.ref] });
    },
    onError: fail,
  });
  const decide = useMutation({
    mutationFn: ({ id, d, final }: { id: string; d: DecisionKind; final?: Record<string, unknown> }) => decideSuggestion(id, d, final),
    onSuccess: (r, v) => setDecided((x) => ({ ...x, [v.id]: r.decision as Decided[string] })),
    onError: (e) => { if (e instanceof ApiError && e.code === "rule_not_met") toast("error", t.cpAlreadyDecided); else fail(e); },
  });
  const D = (id: string | null | undefined, onEdit?: () => void) => (
    <Decide t={t} id={id} decided={id ? decided[id] : undefined} busy={decide.isPending} onEdit={onEdit} onDecide={(d) => decide.mutate({ id: id!, d })} />
  );

  const summary = by("summary"), miss = by("missing_information"), reply = by("reply_draft");
  const missItems = (miss?.payload.items as { bn: string; en?: string }[] | undefined) ?? [];

  return (
    <section aria-labelledby="cp-h" className="space-y-5 rounded-xl border border-teal/40 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cp-h" className="font-semibold text-teal-strong"><span aria-hidden>✨ </span>{t.cpTitle2}</h2>
        <Badge tone="warning" icon="🔒">{t.ofStaffOnly}</Badge>
      </div>
      <p className="-mt-3 text-xs text-muted">{t.ofStaffOnlyHint} {t.cpHuman}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" loading={ask.isPending} onClick={() => ask.mutate()}>{sugg ? t.cpRefresh : t.cpGet}</Button>
        {source === "fallback" && <Badge tone="warning">{t.cpFallback}</Badge>}
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t.aiSummary}</h3>
        <p>{summary ? String(summary.payload.text ?? "") : c.ai.summary || <span className="text-sm text-muted">{t.noAiSummary}</span>}</p>
        {summary && <Cites t={t} list={summary.citations} />}
        {D(summary?.id)}
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t.cpMissingTitle}</h3>
        {miss ? (
          missItems.length === 0 ? <p className="text-sm text-muted">{t.cpMissingNone}</p> : <ul className="list-disc space-y-1 ps-5">{missItems.map((m, i) => <li key={i}>{lang === "en" && m.en ? m.en : m.bn}</li>)}</ul>
        ) : missing.length === 0 ? <p className="text-sm text-muted">{t.cpMissingNone}</p> : (
          <ul className="list-disc space-y-1 ps-5">{missing.map((m) => <li key={m}>{t[`cpMissing_${m}` as keyof typeof t] as string}</li>)}</ul>
        )}
        {miss && <Cites t={t} list={miss.citations} />}
        {D(miss?.id)}
        {(miss ? missItems.length > 0 : missing.length > 0) && onAskInfo}
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t.similar}</h3>
        {dups && dups.available && dups.candidates.length > 0 ? (
          <ul className="space-y-2">{dups.candidates.map((d) => (
            <li key={d.suggestion_id} className="space-y-1">
              <Link href={`/office/${d.ref}`} className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-civic underline">{d.ref}</Link>
              {D(d.suggestion_id)}
            </li>
          ))}</ul>
        ) : c.ai.similarRefs.length ? (
          <ul className="flex flex-wrap gap-2">{c.ai.similarRefs.map((r) => (
            <li key={r}><Link href={`/office/${r}`} className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-civic underline">{r}</Link></li>
          ))}</ul>
        ) : <p className="text-sm text-muted">{dups && !dups.available ? t.cpDupOff : t.noSimilar}</p>}
        <p className="text-xs text-muted">{t.cpDupNote}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t.routing}</h3>
        {routing?.suggestion ? (
          <>
            <p>{lang === "bn" ? routing.suggestion.agency_name_bn : routing.suggestion.agency_name_en}</p>
            {routing.suggestion.reason && <p className="text-sm">{routing.suggestion.reason}</p>}
            <ul className="text-xs text-muted">{routing.suggestion.citations.map((s, i) => (
              <li key={i}>{t.source}: {safeHref(s.source_url ?? undefined) ? <a href={safeHref(s.source_url ?? undefined)} className="underline" target="_blank" rel="noreferrer">{s.source_name}</a> : s.source_name}{s.fetched_at ? ` (${s.fetched_at.slice(0, 10)})` : ""}</li>
            ))}</ul>
            {D(routing.suggestion.id)}
          </>
        ) : routing ? <p className="text-sm text-muted">{t.cpNoRouting}</p> : agency ? (
          <>
            <p>{lang === "bn" ? agency.nameBn : agency.nameEn}</p>
            <p className="text-xs text-muted">{t.source}: {safeHref(agency.url) ? <a href={safeHref(agency.url)} className="underline" target="_blank" rel="noreferrer">{agency.source}</a> : agency.source}{agency.checkedAt ? ` (${agency.checkedAt})` : ""} · {t.confidence}: {pct}%</p>
          </>
        ) : <p className="text-xs text-muted">{t.confidence}: {pct}%</p>}
      </div>

      {reply && (
        <div className="space-y-2">
          <h3 className="font-medium">{t.cpReplyTitle}</h3>
          <p className="text-xs text-muted">{t.cpReplyNote}</p>
          <Textarea label={t.cpReplyLabel} rows={5} maxLength={2000} value={draft} readOnly={!editing} onChange={(e) => setDraft(e.target.value)} />
          <Cites t={t} list={reply.citations} />
          <p className="text-xs text-muted">{t.cpReplyCopy}</p>
          <div className="flex flex-wrap gap-2">
            {!editing && reply.id && !decided[reply.id] && <Button variant="secondary" onClick={() => setEditing(true)}>{t.cpEdit}</Button>}
            {editing && reply.id && !decided[reply.id] && <Button variant="secondary" loading={decide.isPending} onClick={() => decide.mutate({ id: reply.id!, d: "edit", final: { text: draft.trim() } })}>{t.cpSaveEdit}</Button>}
          </div>
          {D(reply.id)}
        </div>
      )}
    </section>
  );
}
