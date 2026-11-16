"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { lookupByArea, lookupByPoint, repView, type RepView } from "@/lib/mp-api";
import QueryProvider from "../QueryProvider";
import RepCard from "./RepCard";

export default function MpFinder() {
  return <QueryProvider><FinderInner /></QueryProvider>;
}

type Source = { kind: "area"; q: string } | { kind: "point"; lat: number; lng: number } | null;

/** "আপনার এমপি কে?" Works without an account. One match shows the card; more than one area asks the citizen to confirm (never a guess). */
function FinderInner() {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number }>();
  const [geo, setGeo] = useState<"idle" | "busy" | "denied">("idle");
  const [confirmed, setConfirmed] = useState<RepView>();

  // Look up a moment after typing stops. Location is used only after the explicit button press.
  useEffect(() => {
    const id = setTimeout(() => setTyped(q.trim().length >= 2 ? q.trim() : ""), 400);
    return () => clearTimeout(id);
  }, [q]);
  const source: Source = typed ? { kind: "area", q: typed } : point ? { kind: "point", ...point } : null;
  const result = useQuery({
    queryKey: ["mp-lookup", source],
    queryFn: () => (source!.kind === "area" ? lookupByArea(source!.q) : lookupByPoint(source!.lat, source!.lng)),
    enabled: !!source,
  });
  const matches = result.data?.matches ?? [];

  function locate() {
    if (!navigator.geolocation) { setGeo("denied"); return; }
    setGeo("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo("idle"); setQ(""); setTyped(""); setPoint({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => setGeo("denied"),
      { timeout: 10_000 },
    );
  }

  const view = (m: (typeof matches)[number]) => m.representatives.map((r) => repView(r, m.constituency, lang, t.mpRoleFallback));
  const none = !!source && result.isSuccess && (result.data.needs_manual_choice || matches.every((m) => m.representatives.length === 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/illustrations/spot-find-mp.svg" alt="" className="hidden size-24 sm:block" />
        <div>
          <h1 className="text-2xl font-semibold text-civic">{t.mpFindTitle}</h1>
          <p className="text-muted">{t.mpFindLead}</p>
        </div>
      </div>
      {matches.some((m) => m.constituency.is_demo || m.representatives.some((r) => r.is_sample)) && <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.mpSampleBanner}</p>}

      {confirmed ? (
        <div className="space-y-3" aria-live="polite">
          <RepCard rep={confirmed} t={t} lang={lang} />
          <Button variant="ghost" onClick={() => { setConfirmed(undefined); setQ(""); setPoint(undefined); }}>{t.mpBack}</Button>
        </div>
      ) : (
        <>
          <form role="search" onSubmit={(e) => { e.preventDefault(); setTyped(q.trim().length >= 2 ? q.trim() : ""); }} className="space-y-3">
            <Input label={t.mpSearch} type="search" hint={t.mpSearchHint} value={q} onChange={(e) => { setQ(e.target.value); setPoint(undefined); }} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" loading={geo === "busy"} onClick={locate}>{geo === "busy" ? t.exLocating : t.exUseLocation}</Button>
              {geo === "denied" && <p role="status" className="text-sm text-muted">{t.exLocationDenied}</p>}
            </div>
          </form>
          <div aria-live="polite" className="space-y-4">
            {result.isFetching && <p role="status" className="text-sm text-muted">{t.exLoading}</p>}
            {result.isError && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
                <p>{t.mpLoadError}</p>
                <Button variant="secondary" onClick={() => void result.refetch()}>{t.exRetry}</Button>
              </div>
            )}
            {none && <EmptyState variant="noResults" title={t.mpNoPlaceTitle} body={t.mpNoPlaceBody} />}
            {matches.map((m) => {
              const reps = view(m);
              const name = lang === "bn" ? m.constituency.name_bn : m.constituency.name_en;
              return (
                <section key={m.constituency.key} className="space-y-3" aria-labelledby={`mp-${m.constituency.key}`}>
                  <h2 id={`mp-${m.constituency.key}`} className="font-semibold">{fillNum(t.mpResultsFor, { place: name }, lang)}</h2>
                  {matches.length > 1 && <Card tone="warning"><p className="font-medium">{t.mpUncertainTitle}</p><p className="text-sm">{t.mpUncertainBody}</p></Card>}
                  {reps.length === 0 && <p className="text-sm text-muted">{t.mpNoVerifiedRep}</p>}
                  {reps.map((r) => (
                    <RepCard key={r.id} rep={r} t={t} lang={lang} showProfile={matches.length === 1}
                      confirm={matches.length > 1 ? <Button variant="secondary" onClick={() => setConfirmed(r)}>{t.mpConfirm}</Button> : undefined} />
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
