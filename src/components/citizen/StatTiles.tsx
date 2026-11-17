import { fmtNum, type Dict, type Lang } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";
import { IssuesIcon, ProgressIcon, ResolvedIcon } from "@/components/ui/TileIcons";

/** Three counts taken from the area's real case list (no invented figures); the note says where they come from. */
export default function StatTiles({ t, lang, cases }: { t: Dict; lang: Lang; cases: CaseRecord[] }) {
  if (cases.length === 0) return null; // no zero tiles on an empty area: they only confuse
  const resolved = cases.filter((c) => c.status === "resolved").length;
  const progress = cases.filter((c) => c.status === "acknowledged" || c.status === "referred").length;
  const tiles = [
    { label: t.rfStatIssues, n: cases.length, icon: <IssuesIcon className="size-10" /> },
    { label: t.rfStatResolved, n: resolved, icon: <ResolvedIcon className="size-10" /> },
    { label: t.rfStatProgress, n: progress, icon: <ProgressIcon className="size-10" /> },
  ];
  return (
    <section aria-label={t.rfStatsAria} className="space-y-2">
      <dl className="grid grid-cols-3 gap-3 lg:gap-5">
        {tiles.map((x) => (
          <div key={x.label} className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
            {x.icon}
            <dd className="order-2 text-2xl font-semibold text-foreground">{fmtNum(x.n, lang)}</dd>
            <dt className="order-3 text-sm text-muted">{x.label}</dt>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">{t.rfStatNote}</p>
    </section>
  );
}
