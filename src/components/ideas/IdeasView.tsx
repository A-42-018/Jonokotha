"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import Button, { buttonClass } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tabs from "@/components/ui/Tabs";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { ideasFor, type Idea, type IdeaTab } from "@/lib/ideas";
import { CATEGORIES, type Category } from "@/lib/categories";
import { fetchIdeasPage } from "@/lib/ideas-api";
import QueryProvider from "../QueryProvider";
import IdeaCard from "./IdeaCard";

export default function IdeasView(props: { constituency: string; signedIn: boolean }) {
  return <QueryProvider><IdeasInner {...props} /></QueryProvider>;
}

function IdeasInner({ constituency, signedIn }: { constituency: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  // The server filters by area and category; search, tabs and "most supported" work on the pages loaded so far.
  const query = useInfiniteQuery({
    queryKey: ["ideas", constituency, category],
    queryFn: ({ pageParam }) => fetchIdeasPage(constituency, category, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const ideas = useMemo<Idea[]>(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const panel = (tab: IdeaTab) => {
    const rows = ideasFor(ideas, tab, q, "all", (c) => t.cats[c]);
    if (query.isPending) return <p role="status" className="text-sm text-muted">{t.exLoading}</p>;
    if (rows.length === 0) {
      const filtered = q || category !== "all";
      return <EmptyState variant={filtered ? "noResults" : "empty"} title={filtered ? t.idNoResultsTitle : t.idEmptyTitle} body={filtered ? t.idNoResultsBody : t.idEmptyBody}
        action={filtered ? undefined : <Link href="/ideas/new" className={buttonClass()}>{t.idSubmit}</Link>} />;
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted" aria-live="polite">{fillNum(t.idCount, { n: rows.length }, lang)}</p>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((i) => <li key={i.id}><IdeaCard idea={i} signedIn={signedIn} /></li>)}</ul>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="jk-h1">{t.idTitle}</h1>
          <p className="text-muted">{t.idLead}</p>
        </div>
        <Link href="/ideas/new" className={buttonClass()}>{t.idSubmit}</Link>
      </div>
      {ideas.some((i) => i.sample) && <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.idSampleBanner}</p>}
      {query.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
          <p>{t.idLoadError}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>{t.exRetry}</Button>
        </div>
      )}
      <p className="text-sm text-muted">{t.idSupportNote}</p>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2">
        <Input label={t.idSearch} type="search" hint={t.srBanglish} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label={t.idCategory} value={category} onChange={(e) => setCategory(e.target.value as Category | "all")}
          options={[{ value: "all", label: t.idAll }, ...CATEGORIES.map((c) => ({ value: c, label: t.cats[c] }))]} />
      </form>
      <Tabs label={t.idTabsAria} tabs={[
        { id: "popular", label: t.idTabPopular, panel: panel("popular") },
        { id: "newest", label: t.idTabNewest, panel: panel("newest") },
        { id: "review", label: t.idTabReview, panel: panel("review") },
      ]} />
      {query.hasNextPage && (
        <div className="text-center">
          <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t.exLoadMore}</Button>
        </div>
      )}
    </div>
  );
}
