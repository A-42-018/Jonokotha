import Link from "next/link";
import type { ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Agency, CaseRecord } from "@/lib/types";

/** AI suggestions for staff. Clearly labelled so it is never mistaken for a citizen-facing or final answer. */
export default function AiPanel({ c, agency, t, lang, children }: { c: CaseRecord; agency?: Agency; t: Dict; lang: Lang; children?: ReactNode }) {
  const pct = Math.round(c.ai.confidence * 100);
  return (
    <section aria-labelledby="ai-title" className="space-y-4 rounded-xl border border-teal/40 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-title" className="font-semibold text-teal"><span aria-hidden>✨ </span>{t.aiSummary}</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber/60 bg-amber/20 px-2.5 py-0.5 text-xs font-medium text-amber-900">
          <span aria-hidden>🔒</span>{t.ofStaffOnly}
        </span>
      </div>
      <p className="-mt-2 text-xs text-slate-500">{t.ofStaffOnlyHint} {t.ofAiSuggestion}</p>

      <p>{c.ai.summary || <span className="text-sm text-slate-500">{t.noAiSummary}</span>}</p>

      <div>
        <h3 className="font-medium">{t.similar}</h3>
        {c.ai.similarRefs.length ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {c.ai.similarRefs.map((r) => (
              <li key={r}>
                <Link href={`/office/${r}`} aria-label={`${t.ofSimilarOpen} ${r}`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm text-civic underline focus-visible:outline-2 focus-visible:outline-civic">{r}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t.noSimilar}</p>
        )}
      </div>

      <div>
        <h3 className="font-medium">{t.routing}</h3>
        {agency ? (
          <>
            <p>{lang === "bn" ? agency.nameBn : agency.nameEn}</p>
            <p className="text-xs text-slate-500">
              {t.source}: {agency.url ? <a href={agency.url} className="underline" target="_blank" rel="noreferrer">{agency.source}</a> : agency.source} · {t.confidence}: {pct}%
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500">{t.confidence}: {pct}%</p>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-3">
        <h3 className="font-medium">{t.ofActions}</h3>
        <p className="text-xs text-amber-800">{t.humanOnly}</p>
        {children}
      </div>
    </section>
  );
}
