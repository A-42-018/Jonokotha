import AdminShell from "@/components/admin/AdminShell";
import HotspotMapLive from "@/components/admin/HotspotMapLive";
import KpiPanel from "@/components/admin/KpiPanel";
import StatBars from "@/components/admin/StatBars";
import Card from "@/components/ui/Card";
import NoAccess from "@/components/ui/NoAccess";
import { analytics } from "@/lib/admin";
import { guardAdmin } from "@/lib/guard";
import { dict, fmtNum, getLang } from "@/lib/i18n";
import { listCases } from "@/lib/store";
import { CATEGORIES, type CaseRecord, type Status } from "@/lib/types";

const STATUSES: Status[] = ["received", "acknowledged", "referred", "resolved"];

/** Platform KPIs with definitions, counts from real cases, and a hotspot map of public issues at approximate positions. */
export default async function Stats() {
  const lang = await getLang();
  const t = dict[lang];
  const { sb, denied } = await guardAdmin("/admin/stats");
  if (denied) return <NoAccess t={t} email={denied.email} role={denied.role} next="/admin/stats" />;
  let cases: CaseRecord[] = [];
  let failed = false;
  try { cases = await listCases(sb); } catch { failed = true; }
  const a = analytics(cases);
  return (
    <AdminShell t={t} title={t.adStatsTitle} lead={t.adStatsLead} current="/admin/stats">
      {failed && <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.adLoadError}</p>}
      <KpiPanel />
      <Card title={t.adStatsTotal}><p className="text-4xl font-semibold text-civic">{fmtNum(a.total, lang)}</p></Card>
      {a.total === 0 ? <p className="text-muted">{t.adStatsNoData}</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={t.adStatsByStatus}><StatBars lang={lang} countLabel={t.adStatsCount} rows={STATUSES.map((s) => ({ key: s, label: t.statuses[s], count: a.byStatus[s] ?? 0 }))} /></Card>
          <Card title={t.adStatsByCategory}><StatBars lang={lang} countLabel={t.adStatsCount} rows={CATEGORIES.filter((c) => a.byCategory[c]).map((c) => ({ key: c, label: t.cats[c], count: a.byCategory[c] ?? 0 }))} /></Card>
          <Card title={t.adStatsHotspots} className="md:col-span-2"><StatBars lang={lang} countLabel={t.adStatsCount} rows={a.hotspots.slice(0, 10).map((h) => ({ key: h.area, label: h.area, count: h.count, note: h.weak ? t.adStatsWeak : undefined }))} /></Card>
        </div>
      )}
      <Card title={t.adStatsMap}>
        <p className="mb-2 text-sm text-muted">{t.adStatsMapNote}</p>
        <HotspotMapLive />
      </Card>
    </AdminShell>
  );
}
