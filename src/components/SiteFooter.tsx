import Link from "next/link";
import type { Dict } from "@/lib/i18n";

/**
 * Footer on every page (F5.17), redesigned as a deep green panel under a red 999 strip (redesign §4.3, rows 8 and 9).
 * It keeps the two things a visitor must never get wrong: this is not an emergency service and not an official government channel.
 */
export default function SiteFooter({ t }: { t: Dict }) {
  const link = "inline-flex min-h-11 items-center text-white underline decoration-white/50 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  return (
    <footer className="relative mt-12 overflow-hidden rounded-3xl bg-brand-deep text-white">
      <a href="tel:999" className="flex min-h-14 items-center justify-center gap-2 bg-danger px-4 py-3 text-center text-lg font-semibold focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white">
        <svg aria-hidden viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
        <strong>{t.footEmergencyHead}</strong>
      </a>
      <div className="relative space-y-3 p-6 pb-10 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/home/foot-leaves-b.webp" alt="" loading="lazy" decoding="async" width={320} height={320} className="pointer-events-none absolute -bottom-8 -end-8 w-36 opacity-90 sm:w-48" />
        <p className="font-heading text-2xl font-semibold text-amber">{t.appName}</p>
        <p className="relative max-w-2xl text-[0.9375rem] leading-relaxed text-white/90">{t.footEmergencyNote}</p>
        <p className="relative max-w-2xl text-[0.9375rem] leading-relaxed text-white/90"><strong className="text-white">{t.footOfficialHead}</strong> {t.footOfficialNote}</p>
        <nav aria-label={t.footNav} className="relative">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]">
            <li><Link href="/about" className={link}>{t.footAbout}</Link></li>
            <li><Link href="/help" className={link}>{t.footHelp}</Link></li>
            <li><Link href="/privacy" className={link}>{t.footPrivacy}</Link></li>
            <li><Link href="/terms" className={link}>{t.navTerms}</Link></li>
            <li><Link href="/accessibility" className={link}>{t.hvFootA11y}</Link></li>
            <li><Link href="/help#emergency" className={link}>{t.hvFootEmergency}</Link></li>
            <li><Link href="/settings" className={link}>{t.stTitle}</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
