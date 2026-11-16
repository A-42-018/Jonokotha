import Link from "next/link";
import type { Dict } from "@/lib/i18n";

export default function HomeFooter({ t }: { t: Dict }) {
  return (
    <footer className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        <li><Link href="/help" className="inline-flex min-h-11 items-center text-civic underline">{t.footHelp}</Link></li>
        <li><Link href="/privacy" className="inline-flex min-h-11 items-center text-civic underline">{t.footPrivacy}</Link></li>
        <li><Link href="/accessibility" className="inline-flex min-h-11 items-center text-civic underline">{t.hvFootA11y}</Link></li>
        <li><Link href="/terms" className="inline-flex min-h-11 items-center text-civic underline">{t.navTerms}</Link></li>
        <li><Link href="/help#emergency" className="inline-flex min-h-11 items-center text-civic underline">{t.hvFootEmergency}</Link></li>
        <li><Link href="/settings" className="inline-flex min-h-11 items-center text-civic underline">{t.stTitle}</Link></li>
      </ul>
      <p>{t.footOfficial}</p>
    </footer>
  );
}
