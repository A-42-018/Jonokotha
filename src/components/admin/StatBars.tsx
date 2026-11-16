import { fillNum, fmtNum, type Lang } from "@/lib/i18n";

/** Horizontal bars with the number always printed (never colour or length alone). */
export default function StatBars({ rows, lang, countLabel }: { rows: { key: string; label: string; count: number; note?: string }[]; lang: Lang; countLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm"><span>{r.label}</span><span className="font-semibold">{fillNum(countLabel, { n: r.count }, lang) || fmtNum(r.count, lang)}</span></div>
          <div aria-hidden className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-civic" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          {r.note && <p className="text-xs text-muted">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}
