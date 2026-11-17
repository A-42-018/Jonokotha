"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchCommitment, isLate } from "@/lib/commitments-api";
import { fillNum, fmtDay } from "@/lib/format";
import { isNotFound } from "@/lib/consult-api";
import { safeHref } from "@/lib/safe";
import { ST_ICON, ST_TONE } from "./CommitmentsList";

/** One commitment with its append-only status history and the proof the office gave (F7.7). */
export default function CommitmentDetail(props: { refId: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ refId }: { refId: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["commitment", refId], queryFn: () => fetchCommitment(refId), retry: (n, e) => !isNotFound(e) && n < 2 });
  const back = <Link href="/commitments" className="inline-flex min-h-11 items-center text-civic underline">← {t.tkBack}</Link>;
  if (q.error && isNotFound(q.error)) return <div className="space-y-3">{back}<EmptyState title={t.tkNotFound} body={t.tkNotFoundBody} /></div>;
  const c = q.data;
  const label = (s: string | null) => (s ? (t[`tkSt_${s}` as "tkSt_planned"] ?? s) : t.tkStart);
  return (
    <div className="space-y-4">
      {back}
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {c && (
          <>
            <header className="space-y-2">
              <h1 className="break-words jk-h1">{c.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ST_TONE[c.status]} icon={ST_ICON[c.status]}>{t[`tkSt_${c.status}` as "tkSt_planned"]}</Badge>
                <Badge tone="teal">{t.tkLabel}</Badge>
                {c.is_sample && <CapabilityLabel status="sample" />}
                {isLate(c) && <Badge tone="warning" icon="!">{t.tkLate}</Badge>}
              </div>
              <p className="text-sm text-muted">{c.due_date && <span>{fillNum(t.tkDue, { date: fmtDay(c.due_date, lang) }, lang)} · </span>}{fillNum(t.tkUpdated, { date: fmtDay(c.updated_at, lang) }, lang)}</p>
              {c.description && <p className="whitespace-pre-line break-words">{c.description}</p>}
              <p className="rounded-xl bg-slate-100 p-2 text-sm">{t.tkNotChecked}</p>
            </header>
            {(c.project_ref || c.idea_ref || c.announcement_ref) && (
              <Card as="section" title={t.tkLinks} headingAs="h2">
                <ul className="space-y-1">
                  {c.project_ref && <li><Link href={`/projects/${encodeURIComponent(c.project_ref)}`} className="inline-flex min-h-11 items-center text-civic underline">{fillNum(t.tkProject, { ref: c.project_ref }, lang)}</Link></li>}
                  {c.idea_ref && <li><Link href={`/ideas/${encodeURIComponent(c.idea_ref)}`} className="inline-flex min-h-11 items-center text-civic underline">{fillNum(t.tkIdea, { ref: c.idea_ref }, lang)}</Link></li>}
                  {c.announcement_ref && <li className="min-h-11 py-2">{fillNum(t.tkAnnouncement, { ref: c.announcement_ref }, lang)}</li>}
                </ul>
              </Card>
            )}
            <section aria-labelledby="tk-hist" className="space-y-2">
              <h2 id="tk-hist" className="jk-h2">{t.tkHistory}</h2>
              {c.history.length === 0 ? <p className="text-muted">{t.tkHistoryEmpty}</p> : (
                <ol className="space-y-2">
                  {c.history.map((e, i) => {
                    const url = safeHref(e.evidence_url);
                    return (
                      <li key={i} className="rounded-xl border border-line bg-white p-3">
                        <p className="font-medium">{fillNum(t.tkFromTo, { from: label(e.from_status), to: label(e.to_status) }, lang)}<span className="ms-2 text-sm font-normal text-muted">{fmtDay(e.created_at, lang)}</span></p>
                        {e.note && <p className="break-words text-sm"><span className="font-medium">{t.tkReason} </span>{e.note}</p>}
                        {e.to_status === "delivered" && (url || e.evidence_text ? (
                          <p className="break-words text-sm"><span className="font-medium">{t.tkEvidence} </span>{e.evidence_text}{url && <> <a href={url} target="_blank" rel="noopener noreferrer" className="text-civic underline">{t.tkEvidenceLink}</a></>}</p>
                        ) : <p className="text-sm text-muted">{t.tkNoEvidence}</p>)}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
