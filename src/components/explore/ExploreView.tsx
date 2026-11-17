"use client";
import MetricNote from "@/components/ui/MetricNote";
import { useInfiniteQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusChip from "@/components/ui/StatusChip";
import Tabs from "@/components/ui/Tabs";
import { useLang } from "@/components/ui/useLang";
import { ApiError } from "@/lib/api-client";
import { useFollows } from "@/components/ui/useFollows";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { filterIssues, NO_FILTERS, sortIssues, type DateRange, type ExploreIssue, type Filters, type SortKey } from "@/lib/explore";
import { fillNum, fmtDate } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { type Status } from "@/lib/types";
import { fetchIssuesPage } from "@/lib/explore-api";
import QueryProvider from "../QueryProvider";

// The map (MapLibre, ~200 KB) loads only when the map view is opened.
const ExploreMap = dynamic(() => import("./ExploreMap"), { ssr: false });
const STATUSES: Status[] = ["received", "acknowledged", "referred", "resolved"];

/** Explore issues (§7.6): list/map toggle, search, filters, sort, "data last updated". Client-side over a public list. */
export default function ExploreView() {
  return <QueryProvider><ExploreInner /></QueryProvider>;
}

function ExploreInner() {
  const t = useT();
  const lang = useLang();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>("latest");
  const [origin, setOrigin] = useState<{ lat: number; lng: number }>();
  const [geo, setGeo] = useState<"idle" | "busy" | "denied">("idle");
  const [selected, setSelected] = useState<string>();
  const toast = useToast();
  const { isFollowing, toggle: toggleFollow, follows } = useFollows(true);
  const [now] = useState(() => Date.now());
  const AREA = "demo-1";
  const followingArea = isFollowing("area", AREA);

  // Category and date range are filtered by the server; status and text search work on what is loaded.
  const from = filters.range === "all" ? undefined : new Date(now - Number(filters.range) * 86_400_000).toISOString().slice(0, 10);
  const query = useInfiniteQuery({
    queryKey: ["issues", filters.category, from ?? "all"],
    queryFn: ({ pageParam }) => fetchIssuesPage(pageParam, filters.category, from),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const issues = useMemo<ExploreIssue[]>(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const loadFailed = query.isError;
  const hasSample = issues.some((i) => i.sample);

  const shown = useMemo(
    () => sortIssues(filterIssues(issues, filters, now, (c) => t.cats[c], (s) => t.statuses[s]), sort, origin),
    [issues, filters, now, sort, origin, t],
  );
  const updated = query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : undefined; // when this list was fetched
  const active = filters.q || filters.category !== "all" || filters.status !== "all" || filters.range !== "all";
  const pick = shown.find((i) => i.ref === selected);

  /** Location is requested only on this explicit click (never on page load). */
  function locate() {
    if (!navigator.geolocation) { setGeo("denied"); return; }
    setGeo("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeo("idle"); setSort("nearby"); },
      () => { setGeo("denied"); setSort("latest"); },
      { timeout: 10_000 },
    );
  }

  const list = shown.length === 0 ? (
    <EmptyState variant="noResults" title={t.exNoResultsTitle} body={t.exNoResultsBody} action={active ? <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>{t.exClear}</Button> : undefined} />
  ) : (
    <ul className="grid gap-2 xl:grid-cols-2">
      {shown.map((i) => (
        <li key={i.ref}>
          <Card as="article" padded={false} className={`p-3 ${i.ref === selected ? "ring-2 ring-civic" : ""}`}>
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={`/illustrations/cat-${i.category}.svg`} alt="" className="size-12 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-medium text-foreground">
                  <Link href={`/issue/${i.ref}`} className="underline-offset-2 hover:underline">{i.title}</Link>
                </h2>
                <p className="text-sm text-muted">{t.cats[i.category]}{i.area && ` · ${i.area}`} · {fmtDate(i.createdAt, lang)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={i.status} label={t.statuses[i.status]} />
                  {i.sample && <CapabilityLabel status="sample" />}
                  {i.supports !== undefined && <span className="text-sm text-muted">{fillNum(t.exSupports, { n: i.supports }, lang)}</span>}
                </div>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );

  const map = (
    <div className="space-y-3">
      <ExploreMap issues={shown} onSelect={setSelected} origin={origin} />
      <p className="text-sm text-muted">{t.exMapApprox} {t.exMapCredit}</p>
      {pick && (
        <Card title={pick.title} headingAs="h3">
          <p className="mb-2 text-sm text-muted">{t.cats[pick.category]} · {pick.area}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={pick.status} label={t.statuses[pick.status]} />
            {pick.sample && <CapabilityLabel status="sample" />}
            <Link href={`/issue/${pick.ref}`} className={buttonClass({ variant: "secondary" })}>{t.exOpen}</Link>
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{t.exTitle}</h1>
      {hasSample && <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.exSampleBanner}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={followingArea ? "success" : "secondary"} aria-pressed={followingArea} loading={toggleFollow.isPending || follows === undefined}
          onClick={() => toggleFollow.mutate({ type: "area", target: AREA }, {
            onError: (e) => toast("error", e instanceof ApiError && e.status === 401 ? t.enSignIn : t.enActionFail),
          })}>
          {followingArea ? t.enFollowingArea : t.enFollowArea}
        </Button>
        <span className="text-sm text-muted">{followingArea ? t.enFollowAreaOn : t.enFollowLocal}</span>
      </div>
      {loadFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
          <p>{t.exLoadError}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>{t.exRetry}</Button>
        </div>
      )}

      <form role="search" onSubmit={(e) => e.preventDefault()} className="space-y-3">
        <Input label={t.exSearch} type="search" hint={`${t.exSearchHint} ${t.srBanglish}`} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Select label={t.exCategory} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value as Filters["category"] })}
            options={[{ value: "all", label: t.exAll }, ...CATEGORIES.map((c) => ({ value: c, label: t.cats[c] }))]} />
          <Select label={t.exStatus} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}
            options={[{ value: "all", label: t.exAll }, ...STATUSES.map((s) => ({ value: s, label: t.statuses[s] }))]} />
          <Select label={t.exDate} value={filters.range} onChange={(e) => setFilters({ ...filters, range: e.target.value as DateRange })}
            options={[{ value: "all", label: t.exAll }, { value: "7", label: t.exDate7 }, { value: "30", label: t.exDate30 }, { value: "90", label: t.exDate90 }]} />
          <Select label={t.exSort} value={sort} onChange={(e) => (e.target.value === "nearby" && !origin ? locate() : setSort(e.target.value as SortKey))}
            options={[{ value: "latest", label: t.exSortLatest }, { value: "updated", label: t.exSortUpdated }, { value: "nearby", label: t.exSortNearby }]} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" loading={geo === "busy"} onClick={locate}>{geo === "busy" ? t.exLocating : t.exUseLocation}</Button>
          {geo === "denied" && <p role="status" className="text-sm text-muted">{t.exLocationDenied}</p>}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted" aria-live="polite">
        <span>{fillNum(t.exCount, { n: shown.length }, lang)}</span>
        {updated && <span>{fillNum(t.exUpdated, { date: fmtDate(updated, lang) }, lang)}</span>}
      </div>
      <MetricNote id="area" period={filters.range === "all" ? t.exAll : ({ "7": t.exDate7, "30": t.exDate30, "90": t.exDate90 } as Record<string, string>)[filters.range] ?? t.exAll} updated={updated} />

      {query.isPending && <p role="status" className="text-sm text-muted">{t.exLoading}</p>}
      <Tabs label={t.exViewAria} tabs={[{ id: "list", label: t.exViewList, panel: list }, { id: "map", label: t.exViewMap, panel: map }]} />
      {query.hasNextPage && (
        <div className="text-center">
          <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t.exLoading : t.exLoadMore}</Button>
        </div>
      )}
    </div>
  );
}
