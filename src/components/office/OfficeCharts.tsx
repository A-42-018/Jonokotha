import Card from "@/components/ui/Card";
import ColumnChart from "@/components/charts/ColumnChart";
import Donut from "@/components/charts/Donut";
import { fillNum, type Dict, type Lang } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";
import { areaCounts, categoryCounts, statusCounts } from "@/lib/office-charts";

/** Real counts from the cases the staff member can see: by category (donut), by status (bars) and most reported areas (columns). */
export default function OfficeCharts({ cases, t, lang }: { cases: CaseRecord[]; t: Dict; lang: Lang }) {
  const cats = categoryCounts(cases).map((c) => ({ key: c.key, label: t.cats[c.key as keyof typeof t.cats] ?? c.key, value: c.value }));
  const statuses = statusCounts(cases).map((s) => ({ key: s.key, label: t.statuses[s.key as keyof typeof t.statuses] ?? s.key, value: s.value }));
  const areas = areaCounts(cases, 5);
  const empty = <p className="text-sm text-muted">{t.rfChartEmpty}</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <Card as="section" title={t.rfChartCategory} headingAs="h2">
        {cats.length ? <Donut slices={cats} lang={lang} totalLabel={t.rfDonutTotal} summary={fillNum(t.rfDonutSummary, { n: cases.length }, lang)} /> : empty}
      </Card>
      <Card as="section" title={t.rfChartStatus} headingAs="h2">
        {statuses.length ? <ColumnChart rows={statuses} lang={lang} /> : empty}
      </Card>
      <Card as="section" title={t.rfChartAreas} headingAs="h2">
        {areas.length ? <ColumnChart rows={areas.map((a) => ({ key: a.key, label: a.key, value: a.value }))} lang={lang} /> : empty}
      </Card>
    </div>
  );
}
