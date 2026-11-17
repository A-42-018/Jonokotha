"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay, fmtNum } from "@/lib/format";
import { fetchClusters } from "@/lib/heatmap-api";
import { isOff } from "@/lib/r11";
import { EXPORT_DAYS, fetchBriefs, fetchExport, fetchKpis, KPI_ORDER, narrativeOk, RATE_KPIS, reviewBrief, type Brief, type ExportFormat, type ExportKind } from "@/lib/office-r11-api";
import Boundary from "./Boundary";

/** Release 1.1 tools on the office analytics page: weekly briefs (B7.9), report downloads (B7.10), indicators (B7.13). Each says "not switched on" when the server has no route. */
export default function OfficeR11({ constituency }: { constituency: string }) {
  return <QueryProvider><div className="space-y-6"><Kpis constituency={constituency} /><Clusters constituency={constituency} /><WeeklyBriefs /><Exports constituency={constituency} /></div></QueryProvider>;
}

// KPIs ---------------------------------------------------------------------------------------------------------------------------------------------
function Kpis({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["r11-kpis", constituency], queryFn: () => fetchKpis(constituency), retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.kpPlanned} body={t.r1PlannedBody} />;
  const forbidden = q.error instanceof ApiError && q.error.status === 403;
  return (
    <section aria-labelledby="kp-h" className="space-y-3">
      <h2 id="kp-h" className="jk-h2">{t.kpTitle}</h2>
      <p className="text-muted">{t.kpLead}</p>
      {forbidden ? <p role="alert">{t.kpNoAccess}</p> : (
        <Boundary q={q} emptyTitle={t.kpNone}>
          {(d) => d.kind === "ok" ? (
            <>
              <p className="text-sm text-muted">{fillNum(t.kpPeriod, { n: d.data.period_days }, lang)}</p>
              <ul className="grid gap-3 md:grid-cols-2">
                {KPI_ORDER.filter((k) => d.data.kpis[k]).map((k) => {
                  const m = d.data.kpis[k];
                  const rate = RATE_KPIS.includes(k);
                  const shown = m.value === null || m.value === undefined ? null : rate ? `${fmtNum(Math.round(m.value * 100), lang)}%` : fmtNum(k === "satisfaction_average" ? Math.round(m.value * 10) / 10 : m.value, lang);
                  return (
                    <li key={k}>
                      <Card as="div" className="space-y-1">
                        <h3 className="text-sm font-medium text-muted">{t[`kp_${k}` as "kp_survey_responses"]}</h3>
                        <p className="text-2xl font-semibold">{shown ?? <span className="text-base font-normal">{m.suppressed ? t.kpFew : t.kpNone}</span>}</p>
                        {shown !== null && typeof m.n === "number" && <p className="text-sm text-muted">{fillNum(t.kpOf, { n: m.n }, lang)}</p>}
                        <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">{t.kpDefinition}</summary><p lang="en" className="text-muted">{m.definition}</p></details>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </Boundary>
      )}
    </section>
  );
}

// Clusters ---------------------------------------------------------------------------------------------------------------------------------------------
function Clusters({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["r11-clusters", constituency], queryFn: () => fetchClusters(constituency), retry: false });
  if (q.isError && isOff(q.error)) return <PlannedPanel title={t.hmoPlanned} body={t.r1PlannedBody} />;
  if (q.isError && q.error instanceof ApiError && q.error.status === 403) return <p role="alert">{t.hmoNoAccess}</p>;
  return (
    <section aria-labelledby="hmo-h" className="space-y-2">
      <h2 id="hmo-h" className="jk-h2">{t.hmoTitle}</h2>
      <p className="text-muted">{t.hmoLead}</p>
      <Boundary q={q} emptyTitle={t.hmNone}>
        {(d) => (
          <div className="space-y-3">
            {d.cells.length === 0 ? <p>{t.hmNone}</p> : <ol className="space-y-1 text-sm">{d.cells.slice(0, 10).map((c, i) => <li key={`${c.lat},${c.lng}`}>{fillNum(t.hmCellAt, { i: i + 1 }, lang)}: {c.top_category ? fillNum(t.hmCell, { n: c.count, cat: (t.cats as Record<string, string>)[c.top_category] ?? c.top_category }, lang) : fillNum(t.hmCellNoCat, { n: c.count }, lang)}{c.emerging ? ` · ${t.hmEmerging}` : ""}</li>)}</ol>}
            {d.cells_hidden > 0 && <p className="text-sm text-muted">{fillNum(t.hmHidden, { n: d.cells_hidden }, lang)}</p>}
            {(d.category_clusters?.length ?? 0) > 0 && (
              <div><h3 className="font-medium">{t.hmoCategories}</h3><ul className="text-sm">{d.category_clusters!.map((c) => <li key={c.category}>{fillNum(t.hmoCatRow, { cat: (t.cats as Record<string, string>)[c.category] ?? c.category, n: c.count }, lang)}</li>)}</ul></div>
            )}
            <p className="text-xs text-muted">{t.hmNote}</p>
          </div>
        )}
      </Boundary>
    </section>
  );
}

// Weekly briefs -------------------------------------------------------------------------------------------------------------------------------------
function WeeklyBriefs() {
  const t = useT();
  const q = useQuery({ queryKey: ["r11-briefs"], queryFn: fetchBriefs, retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.wbPlanned} body={t.r1PlannedBody} />;
  return (
    <section aria-labelledby="wb-h" className="space-y-3">
      <h2 id="wb-h" className="jk-h2">{t.wbTitle}</h2>
      <p className="text-muted">{t.wbLead}</p>
      <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.wbEmpty}>
        {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((b) => <li key={b.id}><BriefCard b={b} /></li>)}</ul> : null}
      </Boundary>
    </section>
  );
}

function BriefCard({ b }: { b: Brief }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState(b.narrative ?? b.narrative_draft ?? "");
  const p = b.payload ?? {};
  const num = (n: number | null | undefined, tpl: string) => (n === null || n === undefined ? t.wbFew : fillNum(tpl, { n }, lang));
  const act = useMutation({
    mutationFn: (d: "approve" | "withdraw") => reviewBrief(b.id, d, d === "approve" ? text : undefined),
    onSuccess: () => { toast("success", t.wbDone); void qc.invalidateQueries({ queryKey: ["r11-briefs"] }); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 403 ? t.wbNoAccess : t.r1FailMsg),
  });
  const draft = b.status === "draft";
  return (
    <Card as="article" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={b.status === "approved" ? "success" : b.status === "draft" ? "warning" : "neutral"}>{t[`wbSt_${b.status}` as "wbSt_draft"]}</Badge>
        <span className="text-sm text-muted">{fillNum(t.wbWeek, { date: fmtDay(b.week_start, lang) }, lang)}</span>
      </div>
      <ul className="space-y-0.5 text-sm">
        <li>{p.received === undefined ? "" : p.received === null ? `${fillNum(t.wbReceived, { n: "–" }, lang)} (${t.wbFew})` : fillNum(t.wbReceived, { n: p.received }, lang)}</li>
        {"previous_week_received" in p && <li>{p.previous_week_received === null ? `${fillNum(t.wbPrev, { n: "–" }, lang)} (${t.wbFew})` : fillNum(t.wbPrev, { n: p.previous_week_received ?? 0 }, lang)}</li>}
        {"resolved" in p && <li>{p.resolved === null ? `${fillNum(t.wbResolved, { n: "–" }, lang)} (${t.wbFew})` : fillNum(t.wbResolved, { n: p.resolved ?? 0 }, lang)}</li>}
        {typeof p.hotspot_cells === "number" && <li>{num(p.hotspot_cells, t.wbHotspots)}</li>}
        {typeof p.satisfaction_average === "number" && typeof p.satisfaction_ratings === "number" && <li>{fillNum(t.wbSat, { avg: fmtNum(p.satisfaction_average, lang), n: p.satisfaction_ratings }, lang)}</li>}
        {typeof p.ideas_awaiting_response === "number" && <li>{num(p.ideas_awaiting_response, t.wbAwaiting)}</li>}
        {typeof p.ideas_overdue === "number" && <li>{num(p.ideas_overdue, t.wbOverdue)}</li>}
        {typeof p.consultations_open === "number" && <li>{num(p.consultations_open, t.wbConsults)}</li>}
        {typeof p.commitments_delayed === "number" && <li>{num(p.commitments_delayed, t.wbDelayed)}</li>}
      </ul>
      {(p.top_categories?.length ?? 0) > 0 && (
        <div><p className="text-sm font-medium">{t.wbTop}</p><ul className="text-sm">{p.top_categories!.map((c) => <li key={c.category}>{fillNum(t.wbCatRow, { cat: (t.cats as Record<string, string>)[c.category] ?? c.category, n: c.count }, lang)}</li>)}</ul></div>
      )}
      {draft ? (
        <>
          {b.narrative_draft ? <p className="rounded-xl bg-slate-100 p-2 text-sm">{t.wbHelperNote}</p> : <p className="text-sm text-muted">{t.wbNoNarrative}</p>}
          <Textarea label={t.wbNarrative} rows={5} maxLength={1500} value={text} error={narrativeOk(text) ? undefined : t.wbNarrativeBad} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <ConfirmAction label={t.wbApprove} body={t.wbApproveConfirm} disabled={!narrativeOk(text)} loading={act.isPending} onConfirm={() => act.mutateAsync("approve")} />
            <ConfirmAction variant="secondary" label={t.wbWithdraw} body={t.wbWithdrawConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("withdraw")} />
          </div>
        </>
      ) : b.narrative && <p className="whitespace-pre-line break-words">{b.narrative}</p>}
    </Card>
  );
}

// Exports -------------------------------------------------------------------------------------------------------------------------------------------
function Exports({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [kind, setKind] = useState<ExportKind>("cases");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  async function run(format: ExportFormat) {
    // The print page opens in a tab that is made now, inside the click, because browsers refuse a tab opened after a wait.
    const tab = format === "html" ? window.open("about:blank", "_blank") : null;
    if (format === "html" && !tab) { toast("error", t.xpPopup); return; }
    setBusy(format);
    try {
      const { blob, filename } = await fetchExport({ kind, constituency, days: Number(days), format });
      const url = URL.createObjectURL(blob);
      if (format === "csv") {
        const a = document.createElement("a");
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        toast("success", t.xpDone);
      } else if (tab) {
        tab.opener = null;
        tab.location.href = url;
        toast("success", t.xpOpened);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      toast("error", e instanceof ApiError && e.status === 403 ? t.xpNoAccess : e instanceof ApiError && e.status === 429 ? t.xpLimit : t.xpFail);
    } finally { setBusy(null); }
  }
  return (
    <Card as="section" title={t.xpTitle}>
      <div className="space-y-3">
        <p className="text-muted">{t.xpLead}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t.xpKind} value={kind} onChange={(e) => setKind(e.target.value as ExportKind)} options={[{ value: "cases", label: t.xpKind_cases }, { value: "ideas", label: t.xpKind_ideas }]} />
          <Select label={t.xpDays} value={days} onChange={(e) => setDays(e.target.value)} options={EXPORT_DAYS.map((n) => ({ value: String(n), label: fillNum(t.xpDaysN, { n }, lang) }))} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === "csv"} disabled={busy !== null} onClick={() => void run("csv")}>{busy === "csv" ? t.xpBusy : t.xpCsv}</Button>
          <Button variant="secondary" loading={busy === "html"} disabled={busy !== null} onClick={() => void run("html")}>{busy === "html" ? t.xpBusy : t.xpPrint}</Button>
        </div>
        <p className="text-sm text-muted">{t.xpCsvNote}</p>
        <p className="text-sm text-muted">{t.xpPrintNote}</p>
        <p className="text-sm text-muted">{t.xpAudited}</p>
      </div>
    </Card>
  );
}
