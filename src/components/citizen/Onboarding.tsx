"use client";
import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/i18n";

export const ONBOARDED_KEY = "jonokotha:onboarded:v1";
const ART = ["onboard-1-report", "onboard-2-track", "onboard-3-together"];

/** Three intro screens. Skippable at any step; finishing or skipping remembers it on this device. */
export default function Onboarding() {
  const t = useT();
  const lang = useLang();
  const [, setDone] = useLocalValue(ONBOARDED_KEY, false);
  const [i, setI] = useState(0);
  const titles = [t.obT1, t.obT2, t.obT3];
  const bodies = [t.obB1, t.obB2, t.obB3];
  const last = i === ART.length - 1;
  return (
    <section aria-label={t.obAria} className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/illustrations/${ART[i]}.svg`} alt="" className="w-full max-w-xs" />
      <p className="text-sm text-muted" aria-live="polite">{fillNum(t.obStep, { n: i + 1, total: ART.length }, lang)}</p>
      <h1 className="text-2xl font-semibold text-civic">{titles[i]}</h1>
      <p>{bodies[i]}</p>
      <div className="flex w-full flex-col gap-2">
        {last ? (
          <Link href="/" onClick={() => setDone(true)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-civic px-5 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">{t.obStart}</Link>
        ) : (
          <Button size="lg" full onClick={() => setI(i + 1)}>{t.obNext}</Button>
        )}
        <div className="flex justify-between">
          {i > 0 ? <Button variant="ghost" onClick={() => setI(i - 1)}>{t.obBack}</Button> : <span />}
          {!last && <Link href="/" onClick={() => setDone(true)} className="inline-flex min-h-11 items-center text-civic underline">{t.obSkip}</Link>}
        </div>
      </div>
    </section>
  );
}
