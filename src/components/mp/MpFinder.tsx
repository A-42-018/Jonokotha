"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/i18n";
import { findRepsByArea, type Rep } from "@/lib/mp";
import RepCard from "./RepCard";

/** "আপনার এমপি কে?" Works without an account. One match shows the card; a border area asks the citizen to confirm. */
export default function MpFinder() {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [confirmed, setConfirmed] = useState<Rep>();
  const results = q.trim() ? findRepsByArea(q, lang) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/spot-find-mp.svg" alt="" className="hidden size-24 sm:block" />
        <div>
          <h1 className="text-2xl font-semibold text-civic">{t.mpFindTitle}</h1>
          <p className="text-muted">{t.mpFindLead}</p>
        </div>
      </div>
      <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.mpSampleBanner}</p>

      {confirmed ? (
        <div className="space-y-3" aria-live="polite">
          <RepCard rep={confirmed} t={t} lang={lang} />
          <Button variant="ghost" onClick={() => { setConfirmed(undefined); setQ(""); }}>{t.mpBack}</Button>
        </div>
      ) : (
        <>
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <Input label={t.mpSearch} type="search" hint={t.mpSearchHint} value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div aria-live="polite" className="space-y-4">
            {q.trim() && results.length === 0 && <EmptyState variant="noResults" title={t.mpNoPlaceTitle} body={t.mpNoPlaceBody} />}
            {results.map(({ place, reps }) => (
              <section key={place.id} className="space-y-3" aria-labelledby={`mp-${place.id}`}>
                <h2 id={`mp-${place.id}`} className="font-semibold">{fillNum(t.mpResultsFor, { place: place[lang] }, lang)}</h2>
                {reps.length > 1 && (
                  <Card tone="warning"><p className="font-medium">{t.mpUncertainTitle}</p><p className="text-sm">{t.mpUncertainBody}</p></Card>
                )}
                {reps.map((r) => (
                  <RepCard key={r.id} rep={r} t={t} lang={lang} showProfile={reps.length === 1}
                    confirm={reps.length > 1 ? <Button variant="secondary" onClick={() => setConfirmed(r)}>{t.mpConfirm}</Button> : undefined} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
