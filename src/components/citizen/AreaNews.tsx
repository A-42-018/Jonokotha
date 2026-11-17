import Link from "next/link";
import StatusChip from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/Button";
import { fmtAgo, type Dict, type Lang } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";

/**
 * Home news for visitors who are not signed in (the signed-in feed is FollowedFeed, from GET /me/feed): the area's latest
 * real reports with a category icon, relative time and status, plus one line pointing to the personal feed. Real reports only.
 */
export default function AreaNews({ t, lang, cases, failed, now }: { t: Dict; lang: Lang; cases: CaseRecord[]; failed: boolean; now: number }) {
  return (
    <section aria-labelledby="home-news" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-news" className="text-xl font-semibold text-foreground">{t.rfNewsTitle}</h2>
        <Link href="/area" className="inline-flex min-h-11 items-center text-civic underline">{t.rfNewsAll}</Link>
      </div>
      {failed ? (
        <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.rfNewsError}</p>
      ) : cases.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-muted">{t.rfNewsEmptyReal}</p>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.ref}>
              <Link href={`/issue/${c.ref}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-civic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={`/illustrations/cat-${c.category}.svg`} alt="" className="size-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{c.title}</span>
                  <span className="block text-sm text-muted">{t.cats[c.category]}{c.area && ` · ${c.area}`} · {fmtAgo(c.timeline.at(-1)?.at ?? c.createdAt, now, lang)}</span>
                </span>
                <StatusChip status={c.status} label={t.statuses[c.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-civic/30 bg-civic/5 p-3">
        <p className="flex-1 text-sm">{t.fdNeedsSignIn}</p>
        <Link href={`/login?need=1&next=${encodeURIComponent("/")}`} className={buttonClass({ variant: "secondary" })}>{t.signIn}</Link>
      </div>
    </section>
  );
}
