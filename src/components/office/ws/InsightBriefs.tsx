"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchInsights, isNotOn, nextActions, reviewInsight, type InsightBrief } from "@/lib/ai-helpers-api";
import { featureStatus } from "@/lib/capability";
import { fillNum, fmtDate } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import Boundary, { saveError } from "./Boundary";

const STATUS = ["draft", "reviewed", "shared", "withdrawn"] as const;

/**
 * Insight Agent briefs for the office (F5.14, §17.2): the helper's draft, written from counted data, linked to the
 * cases behind it. Nothing reaches citizens until a person here shares it. Text only until B5.10 adds the routes
 * (`live` is for tests and for the day the flag flips).
 */
export default function InsightBriefs({ live = featureStatus("insightBrief") === "live" }: { live?: boolean }) {
  const t = useT();
  if (!live) return <PlannedPanel as="h2" title={t.inNotOnTitle} body={t.inNotOnBody} />;
  return <Inner />;
}

function Inner() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["office-insights"], queryFn: fetchInsights, retry: (n, e) => !isNotOn(e) && n < 1 });
  const act = useMutation({
    mutationFn: (v: { id: string; action: "share" | "withdraw" }) => reviewInsight(v.id, v.action),
    onSuccess: () => { toast("success", t.inDone); void qc.invalidateQueries({ queryKey: ["office-insights"] }); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  if (q.isError && isNotOn(q.error)) return <PlannedPanel as="h2" title={t.inNotOnTitle} body={t.inNotOnBody} />;
  return (
    <section aria-labelledby="in-h" className="space-y-3">
      <h2 id="in-h" className="text-xl font-semibold">{t.inTitle}</h2>
      <p className="text-muted">{t.inLead}</p>
      <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.inEmpty}>
        {(rows: InsightBrief[]) => (
          <ul className="space-y-2">{rows.map((b) => (
            <li key={b.id} className="space-y-2 rounded-2xl border border-line bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={b.status === "shared" ? "success" : b.status === "draft" ? "warning" : "neutral"}>{statusLabel(t, b.status)}</Badge>
                <span className="text-sm text-muted">{fillNum(t.inPeriod, { n: b.period_days }, lang)} · {fmtDate(b.created_at, lang)}</span>
              </div>
              <p className="whitespace-pre-line">{b.narrative}</p>
              <div className="text-sm">
                <p className="font-medium">{t.inCases}</p>
                {b.case_refs.length === 0 ? <p className="text-muted">{t.inNoCases}</p> : (
                  <ul className="flex flex-wrap gap-x-3">{b.case_refs.map((r) => <li key={r}><Link href={`/office/${encodeURIComponent(r)}`} className="inline-flex min-h-11 items-center text-civic underline">{r}</Link></li>)}</ul>
                )}
              </div>
              {b.status === "draft" && <p className="text-sm text-muted">{t.inShareWarn}</p>}
              <div className="flex flex-wrap gap-2">
                {nextActions(b.status).map((a) => (
                  <Button key={a} variant={a === "share" ? "primary" : "secondary"} disabled={act.isPending} onClick={() => act.mutate({ id: b.id, action: a })}>{a === "share" ? t.inShare : t.inWithdraw}</Button>
                ))}
              </div>
            </li>
          ))}</ul>
        )}
      </Boundary>
    </section>
  );
}

const statusLabel = (t: Dict, s: string) => (STATUS as readonly string[]).includes(s) ? (t[`inStatus_${s}` as keyof Dict] as string) : s;
