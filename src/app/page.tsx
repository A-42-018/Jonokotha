import Link from "next/link";
import OnboardingCard from "@/components/citizen/OnboardingCard";
import FollowedFeed from "@/components/citizen/FollowedFeed";
import HomeFooter from "@/components/citizen/HomeFooter";
import IdeaCtaCard from "@/components/citizen/IdeaCtaCard";
import RecentIssues from "@/components/citizen/RecentIssues";
import ReportCtaCard from "@/components/citizen/ReportCtaCard";
import RepresentativeCard from "@/components/citizen/RepresentativeCard";
import { findConstituency } from "@/lib/constituency";
import { getConstituencyId } from "@/lib/constituency-server";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { dict, getLang } from "@/lib/i18n";
import { SAMPLE_ISSUES } from "@/lib/sample";
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
  try {
    const { sb, isStaff: staff } = await currentUser();
    isStaff = staff;
    cases = (await listCases(sb)).filter((c) => c.constituencyId === area.id).slice(0, 5);
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
      <FollowedFeed issues={SAMPLE_ISSUES} />
      <RecentIssues t={t} lang={lang} cases={cases} failed={failed} />
      <RepresentativeCard t={t} areaName={lang === "bn" ? area.nameBn : area.nameEn} />
      {isStaff && <Link href="/office" className="inline-flex min-h-11 items-center text-civic underline">{t.officeCta}</Link>}
      <HomeFooter t={t} />
    </div>
  );
}
