import { fmtNum, type Lang } from "@/lib/i18n";
import { CHART_COLORS } from "./Donut";

/** Vertical bars with the value printed above each bar and the label below (never colour or height alone). */
export default function ColumnChart({ rows, lang }: { rows: { key: string; label: string; value: number }[]; lang: Lang }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex h-44 items-end gap-3" role="list">
      {rows.map((r, i) => (
        <li key={r.key} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
          <span className="text-sm font-semibold">{fmtNum(r.value, lang)}</span>
          <span aria-hidden className="mx-auto mt-1 w-full max-w-10 rounded-t-lg" style={{ height: `${Math.max(4, (r.value / max) * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="mt-1 truncate text-xs text-muted" title={r.label}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
