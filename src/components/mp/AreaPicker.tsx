"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Select from "@/components/ui/Select";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { deepest, fetchAreaConstituencies, fetchAreas, isNotSwitchedOn, needsConfirm, trimChain } from "@/lib/areas-api";
import { levelName } from "@/lib/country";
import { fillNum } from "@/lib/format";
import { lookupByArea, lookupByPoint, repView, type LookupMatch, type RepView } from "@/lib/mp-api";
import RepCard from "./RepCard";

type Source = { kind: "area"; q: string } | { kind: "point"; lat: number; lng: number } | { kind: "chain"; id: string } | null;

/** One dropdown of the district → upazila/city → ward/union cascade. Renders nothing when a level has no children (leaf). */
function Level({ index, chain, onPick, onOff }: { index: number; chain: string[]; onPick: (level: number, id: string) => void; onOff: () => void }) {
  const t = useT();
  const lang = useLang();
  const parent = index === 0 ? undefined : chain[index - 1];
  const q = useQuery({ queryKey: ["areas", parent ?? "top"], queryFn: () => fetchAreas(parent), retry: (n, e) => !isNotSwitchedOn(e) && n < 1 });
  const off = q.isError && isNotSwitchedOn(q.error);
  useEffect(() => { if (off && index === 0) onOff(); }, [off, index, onOff]);
  // The first level reserves the height of the "planned" panel it may turn into, so the page below does not jump.
  if (q.isPending) return <p role="status" className={`text-sm text-muted ${index === 0 ? "min-h-[11.5rem] sm:min-h-32" : ""}`}>{t.arLoadingAreas}</p>;
  // The first level keeps its reserved box for the one render between "error" and the planned panel that replaces the cascade.
  if (off) return index === 0 ? <div aria-hidden className="min-h-[11.5rem] sm:min-h-32" /> : null;
  if (q.isError) return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
      <p>{t.arAreasError}</p>
      <Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button>
    </div>
  );
  if (!q.data.areas.length) return null;
  const label = (lang === "bn" ? q.data.label_bn : q.data.label_en) || levelName(index, lang) || t.arLevelFallback;
  return (
    <Select label={label} placeholder={t.arChoose} value={chain[index] ?? ""} onChange={(e) => onPick(index, e.target.value)}
      options={q.data.areas.map((a) => ({ value: a.id, label: lang === "bn" ? a.name_bn : a.name_en }))} />
  );
}

/**
 * Find-your-MP area picker (F5.9): cascade from real data, name search, or location once. When the boundary is uncertain it
 * lists every possible constituency and lets the citizen confirm; it never picks one. `mode="find"` shows the representative card,
 * `mode="choose"` only the constituency (settings and first run), handing the choice to `onConfirm`.
 */
export default function AreaPicker({ mode, onConfirm, intro }: { mode: "find" | "choose"; onConfirm?: (m: LookupMatch) => void; intro?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const [chain, setChain] = useState<string[]>([]);
  const [cascadeOff, setCascadeOff] = useState(false);
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number }>();
  const [geo, setGeo] = useState<"idle" | "busy" | "denied">("idle");
  const [confirmed, setConfirmed] = useState<RepView>();

  useEffect(() => {
    const id = setTimeout(() => setTyped(q.trim().length >= 2 ? q.trim() : ""), 400);
    return () => clearTimeout(id);
  }, [q]);
  const chainId = deepest(chain);
  const source: Source = chainId ? { kind: "chain", id: chainId } : typed ? { kind: "area", q: typed } : point ? { kind: "point", ...point } : null;
  const result = useQuery({
    queryKey: ["area-lookup", source],
    queryFn: () => {
      if (!source) throw new Error("no source");
      return source.kind === "chain" ? fetchAreaConstituencies(source.id) : source.kind === "area" ? lookupByArea(source.q) : lookupByPoint(source.lat, source.lng);
    },
    enabled: !!source,
  });
  const matches = result.data?.matches ?? [];
  const none = !!source && result.isSuccess && (result.data.needs_manual_choice || (mode === "find" ? matches.every((m) => m.representatives.length === 0) : matches.length === 0));
  const uncertain = needsConfirm(result.data);

  function locate() {
    if (!navigator.geolocation) { setGeo("denied"); return; }
    setGeo("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo("idle"); setQ(""); setTyped(""); setChain([]); setPoint({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => setGeo("denied"),
      { timeout: 10_000 },
    );
  }
  const reset = () => { setConfirmed(undefined); setQ(""); setTyped(""); setPoint(undefined); setChain([]); };
  const pick = (level: number, id: string) => { setChain((c) => trimChain(c, level, id)); setQ(""); setTyped(""); setPoint(undefined); };

  if (confirmed && mode === "find") {
    return (
      <div className="space-y-3" aria-live="polite">
        <RepCard rep={confirmed} t={t} lang={lang} />
        <Button variant="ghost" onClick={reset}>{t.mpBack}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {intro}
      {matches.some((m) => m.constituency.is_demo || m.representatives.some((r) => r.is_sample)) && <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.mpSampleBanner}</p>}
      <section aria-label={t.arCascade} className="space-y-3">
        {cascadeOff ? (
          <PlannedPanel as="h2" title={t.arCascadeOffTitle} body={t.arCascadeOffBody} />
        ) : (
          Array.from({ length: chain.length + 1 }, (_, i) => <Level key={i} index={i} chain={chain} onPick={pick} onOff={() => setCascadeOff(true)} />)
        )}
      </section>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setChain([]); setTyped(q.trim().length >= 2 ? q.trim() : ""); }} className="space-y-3">
        <Input label={t.mpSearch} type="search" hint={`${t.mpSearchHint} ${t.srBanglish}`} value={q} onChange={(e) => { setQ(e.target.value); setPoint(undefined); setChain([]); }} />
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
        {none && <EmptyState variant="noResults" title={t.mpNoPlaceTitle} body={source?.kind === "chain" ? t.arNoConstituency : t.mpNoPlaceBody} />}
        {uncertain && <Card tone="warning"><p className="font-medium">{fillNum(t.arAllPossible, { n: matches.length }, lang)}</p><p className="text-sm">{t.arConfirmBody}</p></Card>}
        {matches.map((m) => {
          const name = lang === "bn" ? m.constituency.name_bn : m.constituency.name_en;
          const reps = m.representatives.map((r) => repView(r, m.constituency, lang, t.mpRoleFallback));
          return (
            <section key={m.constituency.key} className="space-y-3" aria-labelledby={`ap-${m.constituency.key}`}>
              <h2 id={`ap-${m.constituency.key}`} className="font-semibold">{fillNum(t.mpResultsFor, { place: name }, lang)}</h2>
              {mode === "choose" ? (
                <Button variant="secondary" onClick={() => onConfirm?.(m)}>{t.arMine}</Button>
              ) : (
                <>
                  {reps.length === 0 && <p className="text-sm text-muted">{t.mpNoVerifiedRep}</p>}
                  {reps.map((r) => (
                    <RepCard key={r.id} rep={r} t={t} lang={lang} showProfile={!uncertain}
                      confirm={uncertain ? <Button variant="secondary" onClick={() => { setConfirmed(r); onConfirm?.(m); }}>{t.mpConfirm}</Button> : undefined} />
                  ))}
                </>
              )}
            </section>
          );
        })}
      </div>
      <PlannedPanel as="h2" title={t.arCorrectTitle} body={t.arCorrectBody} />
    </div>
  );
}
