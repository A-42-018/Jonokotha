"use client";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { ONBOARDED_KEY } from "./Onboarding";

/** Home card for first-time visitors; gone once the intro was finished or skipped. */
export default function OnboardingCard() {
  const t = useT();
  const [done] = useLocalValue(ONBOARDED_KEY, false);
  if (done) return null;
  return (
    <Card tone="info" className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-medium">{t.obCard}</p>
      <Link href="/welcome" className="inline-flex min-h-11 items-center rounded-xl bg-civic px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">{t.obCardCta}</Link>
    </Card>
  );
}
