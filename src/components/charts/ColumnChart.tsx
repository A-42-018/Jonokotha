import { fmtNum, type Lang } from "@/lib/i18n";
import { CHART_COLORS } from "./Donut";

/** Vertical bars with the value printed above each bar and the label below (never colour or height alone). */
export default function ColumnChart({ rows, lang }: { rows: { key: string; label: string; value: number }[]; lang: Lang }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex h-44 items-end gap-3" role="list">
      {rows.map((r, i) => (
        <li key={r.key} className="flex h-full min-w-0 flex-1 flex-col text-center">
          {/* The bar area takes the height the label leaves, so a label that wraps to two lines never pushes the bars out of the chart. The value sits right above its bar (1.5rem reserved for it). */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-end">
            <span className="text-sm font-semibold leading-6">{fmtNum(r.value, lang)}</span>
            <span aria-hidden className="w-full max-w-10 rounded-t-lg" style={{ height: `max(4px, calc((100% - 1.5rem) * ${r.value / max}))`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
          </div>
          {/* Wraps (two lines) instead of cutting the label with an ellipsis: on a phone four columns are about 70px wide and the category name is the point of the chart. leading-5 keeps Bangla marks inside the clipped box. */}
          <span className="mt-1 line-clamp-2 min-h-10 break-words text-xs leading-5 text-muted">{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
