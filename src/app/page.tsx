import Link from "next/link";
import OnboardingCard from "@/components/citizen/OnboardingCard";
import FollowedFeed from "@/components/citizen/FollowedFeedLazy";
import HomeFooter from "@/components/citizen/HomeFooter";
import IdeaCtaCard from "@/components/citizen/IdeaCtaCard";
import RecentIssues from "@/components/citizen/RecentIssues";
import ReportCtaCard from "@/components/citizen/ReportCtaCard";
import { ActivePolls, AreaRepCard, ExploreLinks, HomeSnapshot, PopularIdeas } from "@/components/citizen/HomeBlocks";
import { findConstituency } from "@/lib/constituency";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { dict, getLang } from "@/lib/i18n";
import { loadAreaRep, loadPopularIdeas, loadSnapshot, type HomeRep, type HomeIdea, type Loaded, type Snapshot } from "@/lib/home-data";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import type { CaseRecord } from "@/lib/types";

export default async function Home() {
  const lang = await getLang();
  const t = dict[lang];
  const area = findConstituency(await getConstituencyId()) ?? DEMO_CONSTITUENCY;

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
    <div className="space-y-8">
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img fetchPriority="high" decoding="async" width={2432} height={1792} src="/illustrations/hero-mobile.svg" alt="" className="mx-auto w-full max-w-md rounded-2xl" />
        <h1 className="text-center text-2xl font-semibold text-civic sm:text-3xl">{t.tagline}</h1>
      </div>
      <OnboardingCard />
      <div className="grid gap-4 sm:grid-cols-2">
        <ReportCtaCard t={t} />
        <IdeaCtaCard t={t} />
      </div>
      <HomeSnapshot t={t} lang={lang} snap={snap} areaName={lang === "bn" ? area.nameBn : area.nameEn} sample={"sample" in area && !!area.sample} />
      <FollowedFeed signedIn={signedIn} />
      <RecentIssues t={t} lang={lang} cases={cases} failed={failed} />
      <PopularIdeas t={t} lang={lang} ideas={ideas} />
      <AreaRepCard t={t} lang={lang} rep={rep} areaName={lang === "bn" ? area.nameBn : area.nameEn} />
      <ActivePolls t={t} />
      <ExploreLinks t={t} />
      {isStaff && <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline">{t.officeCta}</Link>}
      <HomeFooter t={t} />
    </div>
  );
}
