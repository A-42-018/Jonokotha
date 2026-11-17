"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchKpis, kpiValue } from "@/lib/admin-api";
import { fillNum, fmtDate, fmtNum } from "@/lib/format";

export default function KpiPanel() {
  return <QueryProvider><KpiInner /></QueryProvider>;
}

const PCT = new Set(["abuse_report_rate_pct", "ai_error_rate_pct", "notification_delivery"]);

/** Platform KPIs from /admin/kpis: each shows its definition and the period; a small group is hidden, never shown as zero. */
function KpiInner() {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["admin-kpis"], queryFn: () => fetchKpis(30) });
  if (q.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (q.isError) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t.adLoadError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button></div>;
  const k = q.data;
  return (
    <section aria-labelledby="kpi-h" className="space-y-3">
      <h2 id="kpi-h" className="jk-h2">{t.adKpiTitle}</h2>
      <p className="text-sm text-muted">{fillNum(t.adKpiPeriod, { n: k.period_days, date: fmtDate(k.generated_at, lang) }, lang)} · <Link href="/metrics" className="text-civic underline">{t.mxHow}</Link></p>
      <ul className="grid gap-3 md:grid-cols-2">
        {Object.entries(k.metrics).map(([key, m]) => {
          const v = kpiValue(m);
          return (
            <li key={key}>
              <Card title={(t[`adKpi_${key}` as keyof typeof t] as string) ?? key} headingAs="h3">
                <p className="text-3xl font-semibold text-civic">{v === null ? <span className="text-base font-normal text-muted">{t.adKpiHidden}</span> : `${fmtNum(v, lang)}${PCT.has(key) ? "%" : ""}`}</p>
                <p lang="en" className="mt-1 text-xs text-muted">{m.definition}</p>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
