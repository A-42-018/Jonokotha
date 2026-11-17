"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDay } from "@/lib/format";
import { withDigits } from "@/lib/numerals";
import { ENTRY_KINDS, fetchBudgetEntries, fetchBudgetSources, money, type EntryKind } from "@/lib/r2-api";
import type { BudgetEntry, BudgetSource } from "@/lib/types";
import { Ext, Gate } from "./bits";

/** Budget and expenditure pages (F8.1): verified documents and the figures quoted from them. No totals, no comparisons, no estimates. */
export default function BudgetPublic(props: { constituency: string; project?: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency, project }: { constituency: string; project?: string }) {
  const t = useT();
  const lang = useLang();
  const [fy, setFy] = useState("");
  const [kind, setKind] = useState<EntryKind | "">("");
  const src = useQuery({ queryKey: ["budget-sources", constituency], queryFn: () => fetchBudgetSources(constituency), retry: false });
  // A project link shows that project's figures even when the visitor's chosen area is another one.
  const area = project ? undefined : constituency;
  const ent = useQuery({ queryKey: ["budget-entries", area, fy, kind, project], queryFn: () => fetchBudgetEntries(area, { ...(fy ? { fiscal_year: fy } : {}), ...(kind ? { kind } : {}), ...(project ? { project } : {}) }), retry: false });
  const yearsFrom = project ? (ent.data?.kind === "ok" ? ent.data.data : []) : src.data?.kind === "ok" ? src.data.data : [];
  const years = [...new Set(yearsFrom.map((s) => s.fiscal_year))].sort().reverse();
  return (
    <AsyncBlock pending={src.isPending || ent.isPending} error={src.error ?? ent.error} onRetry={() => { void src.refetch(); void ent.refetch(); }}>
      <Gate data={src.data}>
        {(sources) => (
          <div className="space-y-4">
            <p className="rounded-xl border border-civic/30 bg-civic/5 p-3 text-sm">{t.r2BgNote}</p>
            {sources.length === 0 && !project ? <EmptyState title={t.r2BgNoSources} body={t.r2BgNoSourcesBody} /> : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label={t.r2Fy} value={fy} onChange={(e) => setFy(e.target.value)} options={[{ value: "", label: t.r2FyAll }, ...years.map((y) => ({ value: y, label: y }))]} />
                  <Select label={t.r2BgKinds} value={kind} onChange={(e) => setKind(e.target.value as EntryKind | "")} options={[{ value: "", label: t.r2FyAll }, ...ENTRY_KINDS.map((k) => ({ value: k, label: t[`r2BgKind_${k}`] }))]} />
                </div>
                <section aria-labelledby="bg-entries" className="space-y-3">
                  <h2 id="bg-entries" className="jk-h2">{t.r2BgEntries}</h2>
                  {ent.data?.kind === "ok" && ent.data.data.length === 0 ? <p className="text-muted">{t.r2BgNoEntries}</p> : (
                    <ul className="space-y-3">{(ent.data?.kind === "ok" ? ent.data.data : []).map((e) => <li key={e.id}><Entry e={e} lang={lang} /></li>)}</ul>
                  )}
                </section>
                {!project && (
                  <section aria-labelledby="bg-sources" className="space-y-3">
                    <h2 id="bg-sources" className="jk-h2">{t.r2BgSources}</h2>
                    <ul className="space-y-3">{sources.filter((s) => !fy || s.fiscal_year === fy).map((s) => <li key={s.ref}><Source s={s} lang={lang} /></li>)}</ul>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </Gate>
    </AsyncBlock>
  );
}

function Entry({ e, lang }: { e: BudgetEntry; lang: "bn" | "en" }) {
  const t = useT();
  return (
    <Card as="article">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone={e.kind === "spent" ? "warning" : e.kind === "released" ? "info" : "neutral"}>{t[`r2BgKind_${e.kind}`]}</Badge>
        <Badge tone="success" icon="✓">{t.r2Verified}</Badge>
        {e.is_sample && <CapabilityLabel status="sample" />}
        <span className="text-sm text-muted">{e.fiscal_year}</span>
      </div>
      <p className="break-words font-medium">{e.label}</p>
      <p className="text-xl font-semibold text-civic">{money(e.amount, e.currency, lang)}</p>
      <p className="mt-1 text-sm text-muted">
        {t.r2Source}: <Ext href={e.source_url}>{e.source_title}</Ext> · {fillNum(t.r2Page, { page: withDigits(e.source_page, lang) }, lang)} · {fillNum(t.r2Checked, { date: fmtDay(e.verified_at, lang) }, lang)}
      </p>
      {e.project_ref && <p className="text-sm text-muted">{fillNum(t.r2BgProject, { ref: e.project_ref }, lang)}</p>}
    </Card>
  );
}

function Source({ s, lang }: { s: BudgetSource; lang: "bn" | "en" }) {
  const t = useT();
  return (
    <Card as="article" title={s.title} headingAs="h3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone="teal">{t[`r2BgDoc_${s.doc_kind}`]}</Badge>
        <Badge tone="success" icon="✓">{t.r2Verified}</Badge>
        {s.is_sample && <CapabilityLabel status="sample" />}
        <span className="text-sm text-muted">{s.fiscal_year}</span>
      </div>
      <p className="text-sm text-muted">{fillNum(t.r2BgPublisher, { name: s.publisher }, lang)} · {fillNum(t.r2Checked, { date: fmtDay(s.verified_at, lang) }, lang)}</p>
      <p className="mt-1"><Ext href={s.source_url}>{t.r2OpenSource}</Ext></p>
      {s.doc_sha256 && <p className="mt-1 break-all text-xs text-muted">{t.r2BgHash}: {s.doc_sha256}</p>}
    </Card>
  );
}
