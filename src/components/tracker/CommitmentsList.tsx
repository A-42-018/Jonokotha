"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { COMMITMENT_STATUSES, fetchCommitments, isLate, summary, type CommitmentStatus } from "@/lib/commitments-api";
import { fillNum, fmtDay } from "@/lib/format";

export const ST_TONE: Record<CommitmentStatus, BadgeTone> = { planned: "neutral", in_progress: "info", delivered: "success", delayed: "warning", dropped: "danger" };
export const ST_ICON: Record<CommitmentStatus, string> = { planned: "○", in_progress: "◐", delivered: "✓", delayed: "⚠", dropped: "✕" };

/** Public commitment tracker for the chosen area (F7.7). Labelled "office commitment" everywhere; the office's own record, not checked by Jonokotha. */
export default function CommitmentsList(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState<CommitmentStatus | "all">("all");
  const q = useQuery({ queryKey: ["commitments", constituency], queryFn: () => fetchCommitments(constituency), retry: false });
  const all = q.data?.kind === "ok" ? q.data.data : [];
  const counts = summary(all);
  const rows = filter === "all" ? all : all.filter((c) => c.status === filter);
  return (
    <div className="space-y-3">
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "planned" ? <PlannedPanel title={t.tkPlannedTitle} body={t.r1PlannedBody} /> : q.data && all.length === 0 ? <EmptyState title={t.tkEmpty} body={t.tkEmptyBody} /> : q.data && (
          <>
            <div role="group" aria-label={t.tkSummary} className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`min-h-11 rounded-full border px-4 ${filter === "all" ? "border-civic bg-civic text-white" : "border-civic bg-white text-civic"}`}>{t.tkAll} ({fillNum(t.tkCount, { n: all.length }, lang)})</button>
              {COMMITMENT_STATUSES.map((s) => (
                <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={`min-h-11 rounded-full border px-4 ${filter === s ? "border-civic bg-civic text-white" : "border-civic bg-white text-civic"}`}>{t[`tkSt_${s}` as "tkSt_planned"]} ({fillNum(t.tkCount, { n: counts[s] }, lang)})</button>
              ))}
            </div>
            <ul className="space-y-3">
              {rows.map((c) => (
                <li key={c.ref}>
                  <Card as="article" title={c.title}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={ST_TONE[c.status]} icon={ST_ICON[c.status]}>{t[`tkSt_${c.status}` as "tkSt_planned"]}</Badge>
                      <Badge tone="teal">{t.tkLabel}</Badge>
                      {c.is_sample && <CapabilityLabel status="sample" />}
                      {isLate(c) && <Badge tone="warning" icon="!">{t.tkLate}</Badge>}
                    </div>
                    <p className="text-sm text-muted">
                      {c.due_date && <span>{fillNum(t.tkDue, { date: fmtDay(c.due_date, lang) }, lang)} · </span>}
                      {fillNum(t.tkUpdated, { date: fmtDay(c.updated_at, lang) }, lang)}
                    </p>
                    <Link href={`/commitments/${encodeURIComponent(c.ref)}`} className={`${buttonClass({ variant: "secondary" })} mt-3`}>{t.tkSee}</Link>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">{t.tkNotChecked}</p>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
