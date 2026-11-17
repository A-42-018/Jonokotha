import Link from "next/link";
import type { Dict } from "@/lib/i18n";

/** Footer on every page (F5.17): the links people look for, and the two things a visitor must never get wrong: this is not an emergency service and not an official government channel. */
export default function SiteFooter({ t }: { t: Dict }) {
  const link = "inline-flex min-h-11 items-center text-civic underline";
  return (
    <footer className="mt-10 space-y-3 border-t border-slate-200 pt-4 text-sm text-slate-700">
      <p className="rounded-xl border border-danger/40 bg-danger/5 p-3"><strong>{t.footEmergencyHead}</strong> {t.footEmergencyNote}</p>
      <p><strong>{t.footOfficialHead}</strong> {t.footOfficialNote}</p>
      <nav aria-label={t.footNav}>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li><Link href="/about" className={link}>{t.footAbout}</Link></li>
          <li><Link href="/help" className={link}>{t.footHelp}</Link></li>
          <li><Link href="/privacy" className={link}>{t.footPrivacy}</Link></li>
          <li><Link href="/terms" className={link}>{t.navTerms}</Link></li>
          <li><Link href="/accessibility" className={link}>{t.hvFootA11y}</Link></li>
          <li><Link href="/help#emergency" className={link}>{t.hvFootEmergency}</Link></li>
          <li><Link href="/settings" className={link}>{t.stTitle}</Link></li>
        </ul>
      </nav>
    </footer>
  );
}
