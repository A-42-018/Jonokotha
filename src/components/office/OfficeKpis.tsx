"use client";
import { useQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError, api } from "@/lib/api-client";
import { fillNum, fmtDate, fmtNum } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { OFFICE_KPI_KEYS } from "@/lib/metrics";

type Metric = { value?: unknown; suppressed?: boolean; definition: string; with_hours?: number | null; without_hours?: number | null; with_n?: number | null; without_n?: number | null };
export interface OfficeKpiData { constituency: string; is_sample: boolean; period_days: number; generated_at: string; min_group_size: number; metrics: Record<string, Metric> }
export const fetchOfficeKpis = (constituency: string, days = 30) => api<OfficeKpiData>(`/office/kpis?constituency=${encodeURIComponent(constituency)}&days=${days}`).then((r) => r.data);

export default function OfficeKpis({ constituency }: { constituency: string }) {
  return <QueryProvider><Inner constituency={constituency} /></QueryProvider>;
}

/** Office KPIs from /office/kpis. Each card shows its own definition from the server; a small group is hidden, never zero. */
function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["office-kpis", constituency], queryFn: () => fetchOfficeKpis(constituency, 30), retry: false });
  if (q.isPending) return <p role="status" className="text-muted">{t.mxOfficeLoading}</p>;
  if (q.isError) {
    const denied = q.error instanceof ApiError && (q.error.status === 403 || q.error.status === 404);
    return (
      <div role="alert" className="space-y-2">
        <p>{denied ? t.mxOfficeNo : t.mxOfficeError}</p>
        {!denied && <Button variant="secondary" onClick={() => void q.refetch()}>{t.mxOfficeRetry}</Button>}
      </div>
    );
  }
  const k = q.data;
  return (
    <section aria-labelledby="ok-h" className="space-y-3">
      <h2 id="ok-h" className="sr-only">{t.mxOfficeTitle}</h2>
      <p className="text-sm text-muted">{fillNum(t.mxOfficePeriod, { n: k.period_days, date: fmtDate(k.generated_at, lang) }, lang)} · <span>{t.mxNoRank}</span></p>
      <ul className="grid gap-3 md:grid-cols-2">
        {OFFICE_KPI_KEYS.filter((key) => k.metrics[key]).map((key) => {
          const m = k.metrics[key];
          return (
            <li key={key}>
              <Card title={t[`mxOffice_${key}` as const]} headingAs="h3">
                <Body kind={key} m={m} t={t} lang={lang} />
                <p lang="en" className="mt-2 text-xs text-muted">{m.definition}</p>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const hidden = (t: Dict) => <span className="text-base font-normal text-muted">{t.mxOfficeHidden}</span>;
const big = "text-3xl font-semibold text-civic";

function Body({ kind, m, t, lang }: { kind: string; m: Metric; t: Dict; lang: "bn" | "en" }) {
  const hours = (n: number) => fillNum(t.mxOfficeHours, { n: fmtNum(n, lang) }, lang);
  if (kind === "median_hours_in_status") {
    const rows = (m.value as { status: string; median_hours: number | null; suppressed: boolean }[]) ?? [];
    return (
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {rows.map((r) => <div key={r.status} className="contents"><dt>{t.statuses[r.status as keyof typeof t.statuses] ?? r.status}</dt><dd className="font-semibold">{r.suppressed || r.median_hours === null ? hidden(t) : hours(r.median_hours)}</dd></div>)}
      </dl>
    );
  }
  if (kind === "handling_time_with_copilot") {
    return (
      <div className="space-y-1">
        <p><span className="text-muted">{t.mxOfficeWith}: </span><span className="font-semibold">{m.with_hours == null ? hidden(t) : hours(m.with_hours)}</span></p>
        <p><span className="text-muted">{t.mxOfficeWithout}: </span><span className="font-semibold">{m.without_hours == null ? hidden(t) : hours(m.without_hours)}</span></p>
        <p className="text-sm text-muted">{t.mxOfficeAssoc}</p>
      </div>
    );
  }
  if (kind === "ai_acceptance") {
    const rows = (m.value as { agent: string; suggestions: number | null; accepted_or_edited_pct: number | null; suppressed: boolean }[]) ?? [];
    return (
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {rows.map((r) => <div key={r.agent} className="contents"><dt>{r.agent}</dt><dd className="font-semibold">{r.suppressed || r.suggestions === null || r.accepted_or_edited_pct === null ? hidden(t) : fillNum(t.mxOfficeAcceptance, { n: r.suggestions, pct: r.accepted_or_edited_pct }, lang)}</dd></div>)}
      </dl>
    );
  }
  if (m.suppressed || m.value === null || m.value === undefined) return <p className={big}>{hidden(t)}</p>;
  const v = Number(m.value);
  const pct = kind.endsWith("_pct");
  return <p className={big}>{kind.startsWith("median_hours") ? hours(v) : `${fmtNum(v, lang)}${pct ? "%" : ""}`}</p>;
}
