"use client";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import StatusChip from "@/components/ui/StatusChip";
import { cx, focusRing } from "@/components/ui/cx";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import type { ExploreIssue } from "@/lib/explore";
import { feedFor, FOLLOWS_KEY, isFollowing, NO_FOLLOWS, toggleFollow } from "@/lib/follows";
import { fmtDate } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";

/** Personalised home feed from followed areas, categories and issues. Sample issues until the feed API exists. */
export default function FollowedFeed({ issues }: { issues: ExploreIssue[] }) {
  const t = useT();
  const lang = useLang();
  const [f, setF] = useLocalValue(FOLLOWS_KEY, NO_FOLLOWS);
  const rows = feedFor(f, issues);
  const any = f.areas.length + f.categories.length + f.issues.length > 0;
  return (
    <section aria-labelledby="home-feed" className="space-y-3">
      <h2 id="home-feed" className="text-xl font-semibold text-foreground">{t.fdTitle}</h2>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t.fdPickCats}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = isFollowing(f, "categories", c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setF(toggleFollow(f, "categories", c))}
                className={cx("min-h-11 rounded-full border px-4 text-sm font-medium", on ? "border-civic bg-civic text-white" : "border-line bg-white text-civic", focusRing)}>
                {on ? "✓ " : ""}{t.cats[c]}
              </button>
            );
          })}
        </div>
      </fieldset>
      {!any ? (
        <Card tone="info"><p className="font-medium">{t.fdEmptyTitle}</p><p className="text-sm">{t.fdEmptyBody}</p></Card>
      ) : rows.length === 0 ? (
        <p className="text-muted">{t.fdNothingMatch}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{t.fdSampleNote}</p>
          <ul className="space-y-2">
            {rows.map((i) => (
              <li key={i.ref}>
                <Card as="article" padded={false} className="space-y-1 p-3">
                  <h3 className="font-medium">{i.title}</h3>
                  <p className="text-sm text-muted">{t.cats[i.category]} · {i.area} · {fmtDate(i.updatedAt, lang)}</p>
                  <div className="flex flex-wrap gap-2"><StatusChip status={i.status} label={t.statuses[i.status]} />{i.sample && <Badge tone="warning">{t.exSample}</Badge>}</div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/area" className="inline-flex min-h-11 items-center text-civic underline">{t.fdSeeAll}</Link>
    </section>
  );
}
