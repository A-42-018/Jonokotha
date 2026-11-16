"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import StatusChip from "@/components/ui/StatusChip";
import { cx, focusRing } from "@/components/ui/cx";
import { useFollows } from "@/components/ui/useFollows";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { useToast } from "@/components/ui/Toast";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { CATEGORIES } from "@/lib/categories";
import { fetchFeed } from "@/lib/feed-api";
import { fmtAgo } from "@/lib/format";

const PERSONAL_KEY = "jonokotha:feed-personalized:v1";

export default function FollowedFeed({ signedIn }: { signedIn: boolean }) {
  return <QueryProvider><FeedInner signedIn={signedIn} /></QueryProvider>;
}

/** Home feed from GET /me/feed: what you follow first, then newest; never by popularity. "Why am I seeing this" on every item; the ordering can be switched off. */
function FeedInner({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [personalized, setPersonalized] = useLocalValue<boolean>(PERSONAL_KEY, true);
  const { isFollowing, toggle } = useFollows(signedIn);
  const feed = useQuery({ queryKey: ["feed", personalized], queryFn: () => fetchFeed(personalized), enabled: signedIn });
  const why = (w: "issue" | "area" | "category" | null) => (w ? (t[`fdWhy_${w}` as keyof typeof t] as string) : t.fdWhy_none);

  if (!signedIn) {
    return (
      <section aria-labelledby="home-feed" className="space-y-3">
        <h2 id="home-feed" className="text-xl font-semibold text-foreground">{t.fdTitle}</h2>
        <Card tone="info"><p className="mb-3">{t.fdNeedsSignIn}</p><Link href={`/login?need=1&next=${encodeURIComponent("/")}`} className={buttonClass()}>{t.signIn}</Link></Card>
      </section>
    );
  }
  const rows = feed.data ?? [];
  return (
    <section aria-labelledby="home-feed" className="space-y-3">
      <h2 id="home-feed" className="text-xl font-semibold text-foreground">{t.fdTitle}</h2>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t.fdPickCats}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = isFollowing("category", c);
            return (
              <button key={c} type="button" aria-pressed={on} disabled={toggle.isPending}
                onClick={() => toggle.mutate({ type: "category", target: c }, { onError: () => toast("error", t.enActionFail) })}
                className={cx("min-h-11 rounded-full border px-4 text-sm font-medium", on ? "border-civic bg-civic/10 text-civic ring-1 ring-civic" : "border-line bg-white text-foreground hover:bg-slate-50", focusRing)}>
                {on ? "✓ " : ""}{t.cats[c]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" aria-pressed={personalized} onClick={() => setPersonalized(!personalized)}>{personalized ? t.fdPersonalOff : t.fdPersonalOn}</Button>
        <span className="text-sm text-muted">{personalized ? t.fdOrderFollowed : t.fdOrderNewest}</span>
      </div>
      {feed.isPending && <p role="status" className="text-sm text-muted">{t.exLoading}</p>}
      {feed.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
          <p>{t.fdLoadError}</p>
          <Button variant="secondary" onClick={() => void feed.refetch()}>{t.exRetry}</Button>
        </div>
      )}
      {feed.isSuccess && rows.length === 0 && <Card tone="info"><p className="font-medium">{t.fdEmptyTitle}</p><p className="text-sm">{t.fdEmptyBody}</p></Card>}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((i) => (
            <li key={i.ref}>
              <Card as="article" padded={false} className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={`/illustrations/cat-${i.category}.svg`} alt="" className="size-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-medium"><Link href={`/issue/${i.ref}`} className="underline-offset-2 hover:underline">{i.title}</Link></h3>
                  <p className="text-sm text-muted">{t.cats[i.category]}{i.area && ` · ${i.area}`} · {fmtAgo(i.createdAt, now, lang)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={i.status} label={t.statuses[i.status]} />
                    {i.sample && <CapabilityLabel status="sample" />}
                    <span className="text-xs text-muted">{why(i.why)}</span>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Link href="/area" className="inline-flex min-h-11 items-center text-civic underline">{t.fdSeeAll}</Link>
    </section>
  );
}
