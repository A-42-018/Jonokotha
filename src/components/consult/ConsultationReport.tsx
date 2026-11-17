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
import { fetchConsultReport, groupName, isNotFound, type AgreementRow, type Pattern } from "@/lib/consult-api";
import { fillNum, fmtDay } from "@/lib/format";
import { pct } from "@/lib/r11";

/** "আপনারা বললেন, যা করা হলো" (F7.1): the published report. Aggregates only; the server hides every group and figure under 5 people. */
export default function ConsultationReport(props: { refId: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

const TONE: Record<Pattern, "success" | "warning" | "info" | "neutral"> = { common_ground: "success", divided: "warning", mixed: "info", low_support: "neutral" };
const ICON: Record<Pattern, string> = { common_ground: "✓", divided: "↔", mixed: "≈", low_support: "–" };

function Inner({ refId }: { refId: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["consultation-report", refId], queryFn: () => fetchConsultReport(refId), retry: (n, e) => !isNotFound(e) && n < 2 });
  const back = <Link href={`/consultations/${encodeURIComponent(refId)}`} className="inline-flex min-h-11 items-center text-civic underline">← {t.rpBack}</Link>;
  if (q.error && isNotFound(q.error)) return <div className="space-y-3">{back}<EmptyState title={t.rpNotFound} body={t.rpNotFoundBody} /></div>;
  const r = q.data;
  return (
    <div className="space-y-4">
      {back}
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {r && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {r.is_sample && <CapabilityLabel status="sample" />}
              {r.published_at && <span className="text-sm text-muted">{fillNum(t.rpPublished, { date: fmtDay(r.published_at, lang) }, lang)}</span>}
            </div>
            <p>{r.participants === null ? t.rpPeopleFew : fillNum(t.rpPeople, { n: r.participants }, lang)}</p>
            {r.summary_bn && <Card as="section" title={t.rpSummary}><p className="whitespace-pre-line break-words">{r.summary_bn}</p></Card>}
            {r.you_said_we_did && <Card as="section" tone="info" title={t.rpDidTitle}><p className="whitespace-pre-line break-words">{r.you_said_we_did}</p></Card>}
            {r.actions.length > 0 && (
              <section aria-labelledby="rp-actions" className="space-y-1">
                <h2 id="rp-actions" className="text-lg font-semibold">{t.rpActions}</h2>
                <ul className="list-disc space-y-1 ps-6">{r.actions.map((a, i) => <li key={i} className="break-words">{a.text}</li>)}</ul>
              </section>
            )}
            {r.groups.length > 0 && (
              <section aria-labelledby="rp-groups" className="space-y-1">
                <h2 id="rp-groups" className="text-lg font-semibold">{t.rpGroups}</h2>
                <ul className="flex flex-wrap gap-2">{r.groups.map((g) => <li key={g.group}><Badge tone="teal">{fillNum(t.rpGroup, { name: groupName(g.group, lang) }, lang)} · {fillNum(t.rpGroupSize, { n: g.size }, lang)}</Badge></li>)}</ul>
                {r.hidden_groups > 0 && <p className="text-sm text-muted">{fillNum(t.rpHidden, { n: r.hidden_groups }, lang)}</p>}
                <p className="text-sm text-muted">{t.rpAssoc}</p>
              </section>
            )}
            {r.agreement.length > 0 && (
              <section aria-labelledby="rp-st" className="space-y-2">
                <h2 id="rp-st" className="text-lg font-semibold">{t.rpStatements}</h2>
                <ul className="space-y-3">{r.agreement.map((a) => <li key={a.statement_id}><Row a={a} /></li>)}</ul>
                <p className="text-sm text-muted">{t.rpAside}</p>
              </section>
            )}
            <details className="rounded-xl border border-line bg-white p-3">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">{t.rpHow}</summary>
              <p className="mt-1 text-sm">{t.rpHowBody}</p>
            </details>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}

function Row({ a }: { a: AgreementRow }) {
  const t = useT();
  const lang = useLang();
  const agree = pct(a.agree_pct);
  return (
    <Card as="div" className="space-y-2">
      <h3 className="break-words font-medium">{a.text}</h3>
      {a.pattern && <Badge tone={TONE[a.pattern]} icon={ICON[a.pattern]}>{t[`rpPattern_${a.pattern}` as "rpPattern_mixed"]}</Badge>}
      {agree === null ? <p className="text-sm text-muted">{t.rpVotesFew}. {t.r1FewNote}</p> : (
        <>
          <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="bg-leaf-strong" style={{ width: `${agree}%` }} />
            <div className="bg-danger" style={{ width: `${pct(a.disagree_pct) ?? 0}%` }} />
          </div>
          <p className="text-sm">
            {fillNum(t.rpAgreeOf, { pc: agree }, lang)} · {fillNum(t.rpDisagreeOf, { pc: pct(a.disagree_pct) ?? 0 }, lang)} · {fillNum(t.rpPassOf, { pc: pct(a.pass_pct) ?? 0 }, lang)}
            {a.votes !== null && <span className="text-muted"> · {fillNum(t.rpVotes, { n: a.votes }, lang)}</span>}
          </p>
          {a.groups.some((g) => g.agree_pct !== null) && (
            <ul className="text-sm text-muted">{a.groups.filter((g) => g.agree_pct !== null).map((g) => <li key={g.group}>{fillNum(t.rpGroupAgree, { name: groupName(g.group, lang), pc: pct(g.agree_pct) ?? 0 }, lang)}</li>)}</ul>
          )}
        </>
      )}
    </Card>
  );
}
