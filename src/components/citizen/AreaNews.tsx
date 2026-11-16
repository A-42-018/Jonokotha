"use client";
import Link from "next/link";
import StatusChip from "@/components/ui/StatusChip";
import { cx, focusRing } from "@/components/ui/cx";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { CATEGORIES } from "@/lib/categories";
import type { ExploreIssue } from "@/lib/explore";
import { feedFor, FOLLOWS_KEY, isFollowing, NO_FOLLOWS, toggleFollow } from "@/lib/follows";
import { fmtAgo } from "@/lib/format";

/**
 * One news section for the home page: the area's latest problems (real reports first, then labelled samples), narrowed by the
 * categories the person picks. Replaces the old pair "your news" + "recent problems", which contradicted each other.
 * Sample rows carry one small tag each plus a single note for the whole list; real rows link to their page.
 */
export default function AreaNews({ issues, now, failed }: { issues: ExploreIssue[]; now: number; failed: boolean }) {
  const t = useT();
  const lang = useLang();
  const [f, setF] = useLocalValue(FOLLOWS_KEY, NO_FOLLOWS);
  const any = f.areas.length + f.categories.length + f.issues.length > 0;
  const rows = (any ? feedFor(f, issues, 6) : [...issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6));
  const hasSample = rows.some((r) => r.sample);
  return (
    <section aria-labelledby="home-news" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-news" className="text-xl font-semibold text-foreground">{t.rfNewsTitle}</h2>
        <Link href="/area" className={cx("inline-flex min-h-11 items-center text-civic underline", focusRing)}>{t.rfNewsAll}</Link>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">{t.rfFilterHint}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = isFollowing(f, "categories", c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setF(toggleFollow(f, "categories", c))}
                className={cx("min-h-11 rounded-full border px-4 text-sm font-medium", on ? "border-civic bg-civic/10 text-civic ring-1 ring-civic" : "border-line bg-white text-foreground hover:bg-slate-50", focusRing)}>
                {on ? "✓ " : ""}{t.cats[c]}
              </button>
            );
          })}
        </div>
      </fieldset>
      {failed && <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.rfNewsError}</p>}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-muted">{any ? t.fdNothingMatch : t.rfNewsEmptyReal}</p>
      ) : (
        <>
          {hasSample && <p className="text-sm text-muted">{t.rfNewsSample}</p>}
          <ul className="space-y-2">
            {rows.map((i) => {
              const body = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={`/illustrations/cat-${i.category}.svg`} alt="" className="size-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{i.title}</span>
                    <span className="block text-sm text-muted">{t.cats[i.category]} · {i.area} · {fmtAgo(i.updatedAt, now, lang)}{i.sample ? ` · ${t.rfSampleTag}` : ""}</span>
                  </span>
                  <StatusChip status={i.status} label={t.statuses[i.status]} />
                </>
              );
              const cls = "flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3";
              return (
                <li key={i.ref}>
                  {i.sample ? <div className={cls}>{body}</div> : <Link href={`/issue/${i.ref}`} className={cx(cls, "hover:bg-slate-50", focusRing)}>{body}</Link>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
