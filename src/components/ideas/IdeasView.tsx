"use client";
import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tabs from "@/components/ui/Tabs";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { ideasFor, type Idea, type IdeaTab } from "@/lib/ideas";
import { CATEGORIES, type Category } from "@/lib/categories";
import IdeaCard from "./IdeaCard";

export default function IdeasView({ ideas, signedIn }: { ideas: Idea[]; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  const panel = (tab: IdeaTab) => {
    const rows = ideasFor(ideas, tab, q, category, (c) => t.cats[c]);
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
          <h1 className="text-2xl font-semibold text-civic">{t.idTitle}</h1>
          <p className="text-muted">{t.idLead}</p>
        </div>
        <Link href="/ideas/new" className={buttonClass()}>{t.idSubmit}</Link>
      </div>
      <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.idSampleBanner}</p>
      <p className="text-sm text-muted">{t.idSupportNote} {t.idSupportLocalNote}</p>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2">
        <Input label={t.idSearch} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label={t.idCategory} value={category} onChange={(e) => setCategory(e.target.value as Category | "all")}
          options={[{ value: "all", label: t.idAll }, ...CATEGORIES.map((c) => ({ value: c, label: t.cats[c] }))]} />
      </form>
      <Tabs label={t.idTabsAria} tabs={[
        { id: "popular", label: t.idTabPopular, panel: panel("popular") },
        { id: "newest", label: t.idTabNewest, panel: panel("newest") },
        { id: "review", label: t.idTabReview, panel: panel("review") },
      ]} />
    </div>
  );
}
