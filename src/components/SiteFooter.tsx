import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { FOOTER_RINGS } from "./footerRings";
import SkylineStrip from "./SkylineStrip";

const LINK = "inline-flex min-h-10 items-center rounded text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline hover:decoration-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const HEAD = "mb-2 text-sm font-bold tracking-wide text-amber";

/**
 * Footer on every page (F5.17): a village → town → office skyline standing on a full-width deep green panel, a brand block, three link columns and one
 * notice card. It keeps the two things a visitor must never get wrong: this is not an emergency service and not an official government channel.
 */
export default function SiteFooter({ t }: { t: Dict }) {
  const groups: { head: string; links: { href: string; label: string }[] }[] = [
    {
      head: t.footColExplore,
      links: [
        { href: "/area", label: t.navArea },
        { href: "/projects", label: t.navProjects },
        { href: "/ideas", label: t.navIdeas },
        { href: "/polls", label: t.navPolls },
      ],
    },
    {
      head: t.footColAct,
      links: [
        { href: "/report", label: t.reportCta },
        { href: "/ask", label: t.navAskMp },
        { href: "/mp", label: t.navFindMp },
      ],
    },
    {
      head: t.footColTrust,
      links: [
        { href: "/about", label: t.footAbout },
        { href: "/help", label: t.footHelp },
        { href: "/privacy", label: t.footPrivacy },
        { href: "/terms", label: t.navTerms },
        { href: "/accessibility", label: t.hvFootA11y },
        { href: "/help#emergency", label: t.hvFootEmergency },
        { href: "/settings", label: t.stTitle },
      ],
    },
  ];
  return (
    <>
      <SkylineStrip />
      <footer className="relative overflow-hidden border-t-2 border-amber/60 bg-brand-deep text-white print:hidden">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-amber" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMid slice" fill="none">
          <path d={FOOTER_RINGS} stroke="currentColor" strokeOpacity="0.1" />
        </svg>
        <div className="relative mx-auto max-w-[90rem] px-4 pb-6 pt-10 sm:px-6 lg:px-8">
          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,1fr))]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/jonokotha-scene.svg" alt="" width={980} height={430} className="h-12 w-auto" />
                <p className="font-heading text-2xl font-semibold text-amber">{t.appName}</p>
              </div>
              <p className="max-w-sm text-[0.9375rem] leading-relaxed text-white/85">{t.tagline}</p>
              <a
                href="tel:999"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber/50 bg-black/20 px-4 py-2 text-[0.9375rem] font-semibold text-white hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-amber" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
                <strong>{t.footEmergencyHead}</strong>
              </a>
            </div>
            <nav aria-label={t.footNav} className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:col-span-3">
              {groups.map((g) => (
                <div key={g.head}>
                  <p className={HEAD}>{g.head}</p>
                  <ul className="flex flex-col">
                    {g.links.map((l) => (
                      <li key={l.href}><Link href={l.href} className={LINK}>{l.label}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
          <div className="mt-10 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-[0.9375rem] leading-relaxed text-white/90 sm:grid-cols-2 sm:gap-6 sm:p-5">
            <p>{t.footEmergencyNote}</p>
            <p><strong className="text-white">{t.footOfficialHead}</strong> {t.footOfficialNote}</p>
          </div>
        </div>
        <div className="relative border-t border-amber/25 bg-black/20">
          <p className="mx-auto max-w-[90rem] px-4 py-3 text-sm text-white/70 sm:px-6 lg:px-8">{t.footCopy}</p>
        </div>
      </footer>
    </>
  );
}
