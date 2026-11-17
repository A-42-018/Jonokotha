import Link from "next/link";
import OnboardingCard from "@/components/citizen/OnboardingCard";
import AreaNews from "@/components/citizen/AreaNews";
import FollowedFeed from "@/components/citizen/FollowedFeedLazy";
import ActionCards from "@/components/citizen/ActionCards";
import HomeHero from "@/components/citizen/HomeHero";
import { ActivePolls, AreaRepCard, ExploreLinks, HomeSnapshot, PopularIdeas } from "@/components/citizen/HomeBlocks";
import { getArea } from "@/lib/constituency-server";
import { dict, getLang } from "@/lib/i18n";
import { nowMs } from "@/lib/explore";
import { loadAreaRep, loadPopularIdeas, loadSnapshot, type HomeRep, type HomeIdea, type Loaded, type Snapshot } from "@/lib/home-data";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import type { CaseRecord } from "@/lib/types";

export default async function Home() {
  const lang = await getLang();
  const t = dict[lang];
  const area = await getArea();
  const areaName = lang === "bn" ? area.nameBn : area.nameEn;

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
    <div className="space-y-6 lg:space-y-8">
      <HomeHero t={t} />
      <OnboardingCard />
      <ActionCards t={t} />
      <HomeSnapshot t={t} lang={lang} snap={snap} areaName={areaName} sample={area.sample} />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          {signedIn ? <FollowedFeed signedIn /> : <AreaNews t={t} lang={lang} cases={cases} failed={failed} now={nowMs()} />}
          <PopularIdeas t={t} lang={lang} ideas={ideas} />
        </div>
        <div className="space-y-6">
          <AreaRepCard t={t} lang={lang} rep={rep} areaName={areaName} />
          <ActivePolls t={t} />
          <ExploreLinks t={t} />
          {isStaff && <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline">{t.officeCta}</Link>}
        </div>
      </div>
    </div>
  );
}
