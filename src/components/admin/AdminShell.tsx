import Link from "next/link";
import type { ReactNode } from "react";
import type { Dict } from "@/lib/i18n";

const LINKS = [["/admin", "adNavHome"], ["/admin/verification", "adNavVerify"], ["/admin/moderation", "adNavMod"], ["/admin/ai-runs", "adNavAi"], ["/admin/stats", "adNavStats"]] as const;

/** Admin page frame: heading, sub-navigation and the sample-data notice. Role is checked by each page (guardAdmin). */
export default function AdminShell({ t, title, lead, sample = true, current, children }: { t: Dict; title: string; lead?: string; sample?: boolean; current: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <nav aria-label={t.adNavAria}>
        <ul className="flex flex-wrap gap-2">
          {LINKS.map(([href, key]) => (
            <li key={href}>
              <Link href={href} aria-current={href === current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic ${href === current ? "border-civic bg-civic text-white" : "border-line bg-white text-civic"}`}>
                {t[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <h1 className="text-2xl font-semibold text-civic">{title}</h1>
      {lead && <p className="text-muted">{lead}</p>}
      {sample && <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.adSampleBanner}</p>}
      {children}
    </div>
  );
}
