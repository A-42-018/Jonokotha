import Link from "next/link";
import { fmtDate, type Dict, type Lang } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";

export default function RecentIssues({ t, lang, cases, failed }: { t: Dict; lang: Lang; cases: CaseRecord[]; failed: boolean }) {
  return (
    <section aria-labelledby="home-recent" className="space-y-3">
      <h2 id="home-recent" className="text-xl font-semibold text-slate-800">{t.homeRecentTitle}</h2>
      {failed ? (
        <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-4 text-slate-700">{t.homeRecentError}</p>
      ) : cases.length === 0 ? (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/empty-no-reports.svg" alt="" className="h-20 w-20 shrink-0" />
          <p className="text-slate-600">{t.homeRecentEmpty}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.ref}>
              <Link href={`/issue/${c.ref}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-civic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/illustrations/cat-${c.category}.svg`} alt="" className="h-12 w-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800">{c.title}</span>
                  <span className="block truncate text-sm text-slate-600">{t.cats[c.category]}{c.area && ` · ${c.area}`} · {fmtDate(c.createdAt, lang)}</span>
                </span>
                <span className="shrink-0 rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 text-xs text-teal">{t.statuses[c.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
