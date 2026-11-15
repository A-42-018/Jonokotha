import type { Dict } from "@/lib/i18n";

// Help and privacy pages arrive in Phase 2, so they show as plain labels, not dead links.
export default function HomeFooter({ t }: { t: Dict }) {
  return (
    <footer className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        <li>{t.footHelp} · {t.comingSoon}</li>
        <li>{t.footPrivacy} · {t.comingSoon}</li>
      </ul>
      <p>{t.footOfficial}</p>
    </footer>
  );
}
