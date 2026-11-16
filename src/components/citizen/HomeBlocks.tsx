import Link from "next/link";
import { fillNum, fmtDate, fmtDay, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { shownCount, type HomeIdea, type HomeRep, type Loaded, type Snapshot } from "@/lib/home-data";
import { metricHref } from "@/lib/metrics";
import { moreNav, primaryNav } from "@/lib/nav-items";
import { sourceHost } from "@/lib/mp-api";

/* Server components only: the home page's first-load JavaScript budget is nearly used up, so nothing here may be a client component. */

const card = "rounded-2xl border border-slate-200 bg-white p-4";
const err = (msg: string) => <p role="alert" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-slate-700">{msg}</p>;

/** Reported, in progress and resolved for the chosen area, with its period, update time and definition link (F.7 rule). */
export function HomeSnapshot({ t, lang, snap, areaName, sample }: { t: Dict; lang: Lang; snap: Loaded<Snapshot>; areaName: string; sample: boolean }) {
  return (
    <section aria-labelledby="home-snap" className="space-y-2">
      <h2 id="home-snap" className="text-xl font-semibold text-slate-800">{t.hvSnapTitle}</h2>
      {!snap.ok ? err(t.hvSnapError) : (
        <div className={`${card} space-y-3`}>
          <p className="text-sm text-slate-600">{areaName}{sample && <span className="ms-2 rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{t.capSample}</span>}</p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {([[t.hvSnapReported, snap.data.reported], [t.hvSnapProgress, snap.data.inProgress], [t.hvSnapResolved, snap.data.resolved]] as const).map(([label, n]) => {
              const shown = shownCount(n);
              return (
                <div key={label} className="rounded-xl bg-slate-50 p-2">
                  <dd className="text-2xl font-semibold text-civic">{shown === null ? <span className="text-base">{t.hvSnapFew}</span> : fmtNum(shown, lang)}</dd>
                  <dt className="text-sm text-slate-600">{label}</dt>
                </div>
              );
            })}
          </dl>
          <p className="text-xs text-muted">
            {t.mxPeriod}: {fillNum(t.hvSnapPeriod, { n: snap.data.days }, lang)} ({fmtDay(snap.data.from, lang)} – {fmtDay(snap.data.to, lang)}) · {t.mxUpdated}: {fmtDate(snap.data.to, lang)} ·{" "}
            <Link href={metricHref("area")} className="inline-flex min-h-6 items-center text-civic underline">{t.mxHow}</Link>
          </p>
        </div>
      )}
    </section>
  );
}

export function PopularIdeas({ t, lang, ideas }: { t: Dict; lang: Lang; ideas: Loaded<HomeIdea[]> }) {
  return (
    <section aria-labelledby="home-ideas" className="space-y-2">
      <h2 id="home-ideas" className="text-xl font-semibold text-slate-800">{t.hvIdeasTitle}</h2>
      {!ideas.ok ? err(t.hvIdeasError) : ideas.data.length === 0 ? <p className={`${card} text-slate-600`}>{t.hvIdeasEmpty}</p> : (
        <ul className="space-y-2">
          {ideas.data.map((i) => (
            <li key={i.ref} className={`${card} flex items-center justify-between gap-3`}>
              <span className="min-w-0 break-words font-medium text-slate-800">{i.title}{i.is_demo && <span className="ms-2 rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{t.capSample}</span>}</span>
              <span className="shrink-0 text-sm text-slate-600">{fillNum(t.hvIdeasSupport, { n: i.support_count }, lang)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/ideas" className="inline-flex min-h-11 items-center text-civic underline">{t.hvIdeasAll}</Link>
    </section>
  );
}

/** The verified representative of the chosen area, with the verification date and the source host; none published says so. */
export function AreaRepCard({ t, lang, rep, areaName }: { t: Dict; lang: Lang; rep: Loaded<HomeRep | null>; areaName: string }) {
  const host = rep.ok && rep.data ? sourceHost(rep.data.source_url) : null;
  return (
    <section aria-labelledby="home-rep" className={`${card} flex items-center gap-4`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/spot-find-mp.svg" alt="" className="h-20 w-20 shrink-0 rounded-xl bg-slate-50 p-1" />
      <div className="min-w-0 space-y-1">
        <h2 id="home-rep" className="text-lg font-semibold text-slate-800">{t.homeRepTitle}</h2>
        <p className="text-sm text-slate-600">{areaName}</p>
        {!rep.ok ? <p role="alert" className="text-slate-700">{t.hvRepError}</p> : !rep.data ? <p className="text-slate-700">{t.hvRepNone}</p> : (
          <>
            <p className="break-words font-medium">{rep.data.full_name}{rep.data.is_demo && <span className="ms-2 rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{t.capSample}</span>}</p>
            {rep.data.office_title && <p className="text-sm text-slate-600">{rep.data.office_title}</p>}
            <p className="text-sm text-slate-600">{t.mpVerified}{rep.data.verified_at && <> · {fillNum(t.mpVerifiedOn, { date: fmtDay(rep.data.verified_at, lang) }, lang)}</>}{host && <> · {t.mpSource}: {host}</>}</p>
            <Link href={`/mp/${rep.data.id}`} className="inline-flex min-h-11 items-center text-civic underline">{t.mpProfile}</Link>
          </>
        )}
        {(!rep.ok || !rep.data) && <Link href="/mp" className="inline-flex min-h-11 items-center text-civic underline">{t.mpFindTitle}</Link>}
      </div>
    </section>
  );
}

/** Polls have no server yet (B5.5): a plain "not switched on" block with nothing to press. */
export function ActivePolls({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-polls" data-planned className="space-y-1 rounded-2xl border border-dashed border-line bg-slate-50 p-4">
      <h2 id="home-polls" className="text-lg font-semibold text-slate-800">{t.hvPollsTitle} <span className="ms-1 rounded-full border border-line/50 px-2 py-0.5 align-middle text-xs font-medium text-muted"><span aria-hidden>○ </span>{t.capPlanned}</span></h2>
      <p className="text-muted">{t.plPlannedBody}</p>
    </section>
  );
}

/** Pages that are not in the phone tab bar: projects, ask, find your MP, polls, help. */
export function ExploreLinks({ t }: { t: Dict }) {
  const items = [...primaryNav().filter((i) => !["navHome", "navArea", "navIdeas"].includes(i.key)), ...moreNav().filter((i) => i.key !== "navTerms")];
  return (
    <nav aria-labelledby="home-more" className="space-y-2">
      <h2 id="home-more" className="text-xl font-semibold text-slate-800">{t.hvMoreTitle}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((i) => <li key={i.href}><Link href={i.href} className="flex min-h-12 items-center rounded-xl border border-slate-200 bg-white px-3 font-medium text-civic hover:bg-slate-50">{t[i.key]}</Link></li>)}
      </ul>
    </nav>
  );
}
