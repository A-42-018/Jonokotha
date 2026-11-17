"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchConsultations, type ConsultStatus } from "@/lib/consult-api";
import { fillNum, fmtDay } from "@/lib/format";

const TABS: ConsultStatus[] = ["open", "closed", "reported"];

/** Public list of consultations in the chosen area (F7.1). */
export default function ConsultationsList(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<ConsultStatus>("open");
  const q = useQuery({ queryKey: ["consultations", constituency, tab], queryFn: () => fetchConsultations(constituency, tab) });
  const label: Record<ConsultStatus, string> = { open: t.csTabOpen, closed: t.csTabClosed, reported: t.csTabReported };
  return (
    <div className="space-y-3">
      <div role="group" aria-label={t.csAllList} className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button key={s} type="button" aria-pressed={tab === s} onClick={() => setTab(s)} className={`min-h-11 rounded-full border px-4 ${tab === s ? "border-civic bg-civic text-white" : "border-civic bg-white text-civic"}`}>{label[s]}</button>
        ))}
      </div>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "planned" ? <PlannedPanel title={t.csPlannedTitle} body={t.csPlannedBody} /> : q.data && q.data.data.length === 0 ? (
          <EmptyState title={t.csEmpty} body={t.csEmptyBody} />
        ) : q.data && (
          <ul className="space-y-3">
            {q.data.data.map((c) => (
              <li key={c.ref}>
                <Card as="article" title={c.question} headingAs="h2">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={c.status === "open" ? "success" : c.status === "reported" ? "info" : "neutral"} icon={c.status === "open" ? "●" : c.status === "reported" ? "✓" : "○"}>{label[c.status]}</Badge>
                    {c.is_sample && <CapabilityLabel status="sample" />}
                    {c.closes_at && <span className="text-sm text-muted">{fillNum(c.status === "open" ? t.r1Closes : t.r1Closed, { date: fmtDay(c.closes_at, lang) }, lang)}</span>}
                  </div>
                  {c.description && <p className="mb-2 break-words">{c.description}</p>}
                  <p className="text-sm text-muted">
                    {c.statement_count !== null && fillNum(t.csStatements, { n: c.statement_count }, lang)}
                    {" · "}
                    {c.participant_count === null ? t.csPeopleFew : fillNum(t.csPeople, { n: c.participant_count }, lang)}
                  </p>
                  <div className="mt-3">
                    <Link href={`/consultations/${encodeURIComponent(c.ref)}`} className={buttonClass({ variant: c.status === "open" ? "primary" : "secondary" })}>{c.status === "open" ? t.csOpen : c.status === "reported" ? t.csSeeReport : t.csOpen}</Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </div>
  );
}
