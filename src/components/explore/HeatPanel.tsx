"use client";
import Badge from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Choice";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { emergingCount, type Heatmap } from "@/lib/heatmap-api";
import { fillNum } from "@/lib/format";

/**
 * The switch and the text alternative for the map's density layer (F7.10). The list repeats everything the colours say, so the map is not the only way to read it. Not a ranking of areas.
 * `useHeat` (the data) is in `useHeat.ts`; ExploreView draws nothing here when the server has no heatmap route and says so when the call fails.
 */
export default function HeatPanel({ data, on, setOn }: { data: Heatmap; on: boolean; setOn: (v: boolean) => void }) {
  const t = useT();
  const lang = useLang();
  return (
    <section aria-labelledby="hm-h" className="space-y-2 rounded-2xl border border-line bg-white p-3">
      <h3 id="hm-h" className="sr-only">{t.hmTitle}</h3>
      <Checkbox label={t.hmToggle} hint={t.hmToggleHint} checked={on} onChange={(e) => setOn(e.target.checked)} />
      {on && <p className="text-sm text-muted">{t.hmLegend}</p>}
      <div role="status" aria-live="polite" className="text-sm">
        {data.cells.length === 0 ? <p>{t.hmNone}</p> : (
          <details open={on}>
            <summary className="min-h-11 cursor-pointer py-2 font-medium">{t.hmTitle} ({fillNum("{n}", { n: data.cells.length }, lang)}{emergingCount(data.cells) ? `, ${fillNum("{n}", { n: emergingCount(data.cells) }, lang)} ${t.hmEmerging}` : ""})</summary>
            <ol className="space-y-1">
              {data.cells.slice(0, 10).map((c, i) => (
                <li key={`${c.lat},${c.lng}`} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{fillNum(t.hmCellAt, { i: i + 1 }, lang)}:</span>
                  <span>{c.top_category ? fillNum(t.hmCell, { n: c.count, cat: (t.cats as Record<string, string>)[c.top_category] ?? c.top_category }, lang) : fillNum(t.hmCellNoCat, { n: c.count }, lang)}</span>
                  {c.emerging && <Badge tone="warning" icon="↗">{t.hmEmerging}</Badge>}
                </li>
              ))}
            </ol>
          </details>
        )}
        {data.cells_hidden > 0 && <p className="text-muted">{fillNum(t.hmHidden, { n: data.cells_hidden }, lang)}</p>}
      </div>
      <p className="text-xs text-muted">{t.hmNote} {fillNum(t.hmPeriod, { n: data.period_days }, lang)}</p>
    </section>
  );
}
