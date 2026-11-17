import Link from "next/link";
import AreaNews from "@/components/citizen/AreaNews";
import FollowedFeed from "@/components/citizen/FollowedFeedLazy";
import ActionCards from "@/components/citizen/ActionCards";
import CategoryGrid from "@/components/citizen/CategoryGrid";
import HomeHero from "@/components/citizen/HomeHero";
import HowItWorks from "@/components/citizen/HowItWorks";
import { AreaRepCard, ExploreLinks, HomeSnapshot, PopularIdeas } from "@/components/citizen/HomeBlocks";
import { getArea } from "@/lib/constituency-server";
import { dict, getLang } from "@/lib/i18n";
import { nowMs } from "@/lib/explore";
import { loadAreaRep, loadPopularIdeas, loadSnapshot, type HomeRep, type HomeIdea, type Loaded, type Snapshot } from "@/lib/home-data";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import type { CaseRecord } from "@/lib/types";

/**
 * Home (docs/HOMEPAGE_REDESIGN_PLAN.md §4): hero with the voice-and-photo report button, three ways to take part, the area at a
 * glance, problem types, how it works, then news, ideas and the representative. Server components only (first-load JS budget).
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const lang = await getLang();
  const t = dict[lang];
  const area = await getArea();
  const areaName = lang === "bn" ? area.nameBn : area.nameEn;
  const trackError = (await searchParams).track === "invalid";

  let cases: CaseRecord[] = [];
  let failed = false;
  let isStaff = false;
  let signedIn = false;
  let snap: Loaded<Snapshot> = { ok: false };
  let ideas: Loaded<HomeIdea[]> = { ok: false };
  let rep: Loaded<HomeRep | null> = { ok: false };
  try {
    const { sb, user, isStaff: staff } = await currentUser();
    isStaff = staff;
    signedIn = !!user;
    cases = (await listCases(sb)).filter((c) => c.constituencyId === area.id).slice(0, 5);
    [snap, ideas, rep] = await Promise.all([loadSnapshot(sb, area.id), loadPopularIdeas(sb, area.id), loadAreaRep(sb, area.id)]);
  } catch {
    failed = true;
  }

  return (
    <div className="space-y-10 lg:space-y-14">
      {/* Hero and cards share a wrapper so the cards can lift over the hero's bottom edge on desktop. */}
      <div>
        <HomeHero t={t} />
        <ActionCards t={t} trackError={trackError} />
      </div>
      <HomeSnapshot t={t} lang={lang} snap={snap} areaName={areaName} sample={area.sample} />
      <CategoryGrid t={t} />
      <HowItWorks t={t} lang={lang} />
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-10">
          {signedIn ? <FollowedFeed signedIn /> : <AreaNews t={t} lang={lang} cases={cases} failed={failed} now={nowMs()} />}
          <PopularIdeas t={t} lang={lang} ideas={ideas} />
        </div>
        <div className="space-y-8">
          <AreaRepCard t={t} lang={lang} rep={rep} areaName={areaName} />
          <ExploreLinks t={t} />
          {isStaff && <Link href="/office" className="inline-flex min-h-11 items-center font-medium text-civic underline underline-offset-4">{t.officeCta}</Link>}
        </div>
      </div>
    </div>
  );
}
