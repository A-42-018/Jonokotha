import Link from "next/link";
import OnboardingCard from "@/components/citizen/OnboardingCard";
import AreaNews from "@/components/citizen/AreaNews";
import FollowedFeed from "@/components/citizen/FollowedFeedLazy";
import HomeFooter from "@/components/citizen/HomeFooter";
import ActionCards from "@/components/citizen/ActionCards";
import HomeHero from "@/components/citizen/HomeHero";
import StatTiles from "@/components/citizen/StatTiles";
import RepresentativeCard from "@/components/citizen/RepresentativeCard";
import { findConstituency } from "@/lib/constituency";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { dict, getLang } from "@/lib/i18n";
import { nowMs } from "@/lib/explore";
import { listCases } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import type { CaseRecord } from "@/lib/types";

export default async function Home() {
  const lang = await getLang();
  const t = dict[lang];
  const area = findConstituency(await getConstituencyId()) ?? DEMO_CONSTITUENCY;

  let cases: CaseRecord[] = [];
  let allCases: CaseRecord[] = [];
  let failed = false;
  let isStaff = false;
  let signedIn = false;
  try {
    const { sb, user, isStaff: staff } = await currentUser();
    isStaff = staff;
    signedIn = !!user;
    allCases = (await listCases(sb)).filter((c) => c.constituencyId === area.id);
    cases = allCases.slice(0, 5);
  } catch {
    failed = true;
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <HomeHero t={t} />
      <OnboardingCard />
      <ActionCards t={t} />
      <StatTiles t={t} lang={lang} cases={allCases} />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          {signedIn ? <FollowedFeed signedIn /> : <AreaNews t={t} lang={lang} cases={cases} failed={failed} now={nowMs()} />}
        </div>
        <div className="space-y-6">
          <RepresentativeCard t={t} areaName={lang === "bn" ? area.nameBn : area.nameEn} />
          {isStaff && <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline">{t.officeCta}</Link>}
        </div>
      </div>
      <HomeFooter t={t} />
    </div>
  );
}
