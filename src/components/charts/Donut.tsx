import { fmtNum, type Lang } from "@/lib/i18n";

export const CHART_COLORS = ["#1d5fa8", "#f2a33a", "#287a44", "#6d28d9", "#b42318", "#0b6b6d", "#64748b"];

export interface Slice { key: string; label: string; value: number }

/**
 * Donut with a legend that prints every label and number (colour is never the only carrier). Slices beyond `max` fold into
 * the last colour's "other" row by the caller; this component draws what it is given. The SVG has a text summary for screen readers.
 */
export default function Donut({ slices, lang, totalLabel, summary }: { slices: Slice[]; lang: Lang; totalLabel: string; summary: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  const shown = slices.filter((s) => s.value > 0);
  const offsets = shown.map((_, i) => shown.slice(0, i).reduce((a, s) => a + (s.value / total) * C, 0));
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" role="img" aria-label={summary} className="size-36 shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {shown.map((s, i) => {
          const len = (s.value / total) * C;
          return <circle key={s.key} cx="70" cy="70" r={R} fill="none" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 70 70)" />;
        })}
        <text x="70" y="70" textAnchor="middle" className="fill-foreground text-[22px] font-semibold">{fmtNum(total, lang)}</text>
        <text x="70" y="90" textAnchor="middle" className="fill-muted text-[13px]">{totalLabel}</text>
      </svg>
      <ul className="min-w-40 flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="flex-1">{s.label}</span>
            <span className="font-semibold">{fmtNum(s.value, lang)}</span>
            {total > 0 && <span className="w-10 text-end text-muted">{fmtNum(Math.round((s.value / total) * 100), lang)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
