import Link from "next/link";
import type { ReactNode } from "react";
import { fillNum, fmtDate, fmtDay, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { shownCount, type HomeIdea, type HomeRep, type Loaded, type Snapshot } from "@/lib/home-data";
import { metricHref } from "@/lib/metrics";
import { moreNav, primaryNav } from "@/lib/nav-items";
import { sourceHost } from "@/lib/mp-api";

/* Server components only: the home page's first-load JavaScript budget is nearly used up, so nothing here may be a client component. */

const h2 = "text-[1.375rem] font-semibold leading-snug text-foreground lg:text-[1.75rem]";
const link = "inline-flex min-h-11 items-center font-medium text-civic underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";
const sampleChip = (label: string) => <span className="ms-2 rounded-full bg-amber/25 px-2 py-0.5 align-middle text-[0.8125rem] font-medium text-amber-900">{label}</span>;
const err = (msg: string) => <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-[0.9375rem] text-ink-2">{msg}</p>;

const icon = (d: ReactNode) => <svg viewBox="0 0 24 24" className="size-5 lg:size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const KINDS = {
  reported: { tint: "bg-[#fde7da]", fg: "text-brick", bar: "bg-brick", svg: icon(<><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>) },
  progress: { tint: "bg-[#dceef5]", fg: "text-st-progress", bar: "bg-st-progress", svg: icon(<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4Z" />) },
  resolved: { tint: "bg-[#ddf1e3]", fg: "text-st-done", bar: "bg-st-done", svg: icon(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>) },
} as const;

/**
 * Reported, in progress and resolved for the chosen area as three cards (redesign §4.3 row 2), with the period, update time and
 * definition link (F.7 rule). Groups under five are never shown as a number, and the bars appear only when all three are shown,
 * so a bar can never hint at a hidden count.
 */
export function HomeSnapshot({ t, lang, snap, areaName, sample }: { t: Dict; lang: Lang; snap: Loaded<Snapshot>; areaName: string; sample: boolean }) {
  return (
    <section aria-labelledby="home-snap" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="home-snap" className={h2}>{t.hvSnapTitle}</h2>
        <p className="text-[0.9375rem] text-muted">{areaName}{sample && sampleChip(t.capSample)}</p>
      </div>
      {!snap.ok ? err(t.hvSnapError) : (() => {
        const rows = [["reported", t.hvSnapReported, snap.data.reported], ["progress", t.hvSnapProgress, snap.data.inProgress], ["resolved", t.hvSnapResolved, snap.data.resolved]] as const;
        const shown = rows.map(([, , n]) => shownCount(n));
        const all = shown.every((n) => n !== null);
        const total = all ? shown.reduce<number>((a, n) => a + (n ?? 0), 0) : 0;
        return (
          <>
            <dl className="grid grid-cols-3 gap-2.5 lg:gap-6">
              {rows.map(([kind, label], i) => {
                const k = KINDS[kind];
                const n = shown[i];
                return (
                  <div key={kind} className="jk-card relative flex flex-col gap-2 p-3 pb-6 lg:p-5 lg:pb-8">
                    <dt className="order-2 text-[0.9375rem] font-medium leading-snug text-ink-2 lg:text-[1.0625rem]">{label}</dt>
                    <dd className="order-1 flex flex-wrap items-center justify-between gap-1">
                      <span aria-hidden className={`flex size-9 items-center justify-center rounded-full lg:size-11 ${k.tint} ${k.fg}`}>{k.svg}</span>
                      <span className={`font-heading font-bold ${k.fg} ${n === null ? "text-[0.9375rem]" : "text-2xl lg:text-3xl"}`}>{n === null ? t.hvSnapFew : fmtNum(n, lang)}</span>
                    </dd>
                    {all && total > 0 && (
                      <div aria-hidden className="absolute inset-x-3 bottom-3 h-1.5 rounded-full bg-slate-200 lg:inset-x-5 lg:bottom-4 lg:h-2">
                        <div className={`h-full rounded-full ${k.bar}`} style={{ width: `${Math.max(4, Math.round(((n ?? 0) / total) * 100))}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </dl>
            {!all && <p className="text-[0.9375rem] text-muted">{t.hmFewNote}</p>}
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              {t.mxPeriod}: {fillNum(t.hvSnapPeriod, { n: snap.data.days }, lang)} ({fmtDay(snap.data.from, lang)} – {fmtDay(snap.data.to, lang)}) · {t.mxUpdated}: {fmtDate(snap.data.to, lang)} ·{" "}
              <Link href={metricHref("area")} className={link}>{t.mxHow}</Link>
            </p>
          </>
        );
      })()}
    </section>
  );
}

export function PopularIdeas({ t, lang, ideas }: { t: Dict; lang: Lang; ideas: Loaded<HomeIdea[]> }) {
  return (
    <section aria-labelledby="home-ideas" className="space-y-3">
      <h2 id="home-ideas" className={h2}>{t.hvIdeasTitle}</h2>
      {!ideas.ok ? err(t.hvIdeasError) : ideas.data.length === 0 ? <p className="jk-card jk-body p-4 text-ink-2">{t.hvIdeasEmpty}</p> : (
        <ul className="jk-card divide-y divide-slate-100 px-4">
          {ideas.data.map((i) => (
            <li key={i.ref} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 break-words text-[1.0625rem] font-medium text-foreground">{i.title}{i.is_demo && sampleChip(t.capSample)}</span>
              <span className="shrink-0 rounded-full bg-[#ddf1e3] px-3 py-1 text-[0.9375rem] font-medium text-ink">{fillNum(t.hvIdeasSupport, { n: i.support_count }, lang)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/ideas" className={link}>{t.hvIdeasAll}</Link>
    </section>
  );
}

/** The verified representative of the chosen area, with the verification date and the source host; none published says so. */
export function AreaRepCard({ t, lang, rep, areaName }: { t: Dict; lang: Lang; rep: Loaded<HomeRep | null>; areaName: string }) {
  const host = rep.ok && rep.data ? sourceHost(rep.data.source_url) : null;
  return (
    <section aria-labelledby="home-rep" className="jk-card flex items-start gap-4 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/spot-find-mp.svg" alt="" className="size-20 shrink-0 rounded-2xl bg-cream p-1" />
      <div className="min-w-0 space-y-1">
        <h2 id="home-rep" className="text-xl font-semibold text-foreground">{t.homeRepTitle}</h2>
        <p className="text-[0.9375rem] text-muted">{areaName}</p>
        {!rep.ok ? <p role="alert" className="text-[0.9375rem] text-ink-2">{t.hvRepError}</p> : !rep.data ? <p className="text-[0.9375rem] leading-relaxed text-ink-2">{t.hvRepNone}</p> : (
          <>
            <p className="break-words text-[1.0625rem] font-medium text-foreground">{lang === "bn" ? rep.data.full_name_bn || rep.data.full_name : rep.data.full_name}{rep.data.is_demo && sampleChip(t.capSample)}</p>
            {rep.data.office_title && <p className="text-[0.9375rem] text-ink-2">{rep.data.office_title}</p>}
            <p className="text-[0.9375rem] text-muted">{t.mpVerified}{rep.data.verified_at && <> · {fillNum(t.mpVerifiedOn, { date: fmtDay(rep.data.verified_at, lang) }, lang)}</>}{host && <> · {t.mpSource}: {host}</>}</p>
            <Link href={`/mp/${rep.data.id}`} className={link}>{t.mpProfile}</Link>
          </>
        )}
        {(!rep.ok || !rep.data) && <Link href="/mp" className={link}>{t.mpFindTitle}</Link>}
      </div>
    </section>
  );
}

/** Polls have no server yet (B5.5): a plain "not switched on" block with nothing to press. Not shown on the redesigned home page. */
export function ActivePolls({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-polls" data-planned className="space-y-1 rounded-2xl border border-dashed border-line bg-slate-50 p-4">
      <h2 id="home-polls" className="text-lg font-semibold text-slate-800">{t.hvPollsTitle} <span className="ms-1 rounded-full border border-line/50 px-2 py-0.5 align-middle text-xs font-medium text-muted"><span aria-hidden>○ </span>{t.capPlanned}</span></h2>
      <p className="text-muted">{t.plPlannedBody}</p>
    </section>
  );
}

/** Pages that are not in the phone tab bar: projects, ask, find your MP, polls, help. On phones this list is the only way to them. */
export function ExploreLinks({ t }: { t: Dict }) {
  const items = [...primaryNav().filter((i) => !["navHome", "navArea", "navIdeas"].includes(i.key)), ...moreNav().filter((i) => i.key !== "navTerms" && i.key !== "navAbout")];
  return (
    <nav aria-labelledby="home-more" className="space-y-3">
      <h2 id="home-more" className="text-xl font-semibold text-foreground">{t.hvMoreTitle}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => <li key={i.href}><Link href={i.href} className="inline-flex min-h-11 items-center rounded-full border border-civic/30 bg-white px-4 text-[0.9375rem] font-medium text-civic hover:bg-civic/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">{t[i.key]}</Link></li>)}
      </ul>
    </nav>
  );
}
