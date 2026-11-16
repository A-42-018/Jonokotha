import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { fillNum, fmtDay, type Dict, type Lang } from "@/lib/i18n";
import type { Rep } from "@/lib/mp";

/** Verified representative card: verification date and source always shown; sample entries say so. */
export default function RepCard({ rep, t, lang, showProfile = true, confirm }: { rep: Rep; t: Dict; lang: Lang; showProfile?: boolean; confirm?: React.ReactNode }) {
  const b = lang === "bn";
  return (
    <Card as="article" className="space-y-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/spot-find-mp.svg" alt="" className="size-20 shrink-0 rounded-xl bg-slate-50 p-1" />
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{b ? rep.nameBn : rep.nameEn}</h3>
          <p className="text-sm text-muted">{b ? rep.roleBn : rep.roleEn} · {b ? rep.constituencyBn : rep.constituencyEn}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" icon="✓">{t.mpVerified}</Badge>
            {rep.sample && <Badge tone="warning">{t.exSample}</Badge>}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted">{fillNum(t.mpVerifiedOn, { date: fmtDay(rep.verifiedAt, lang) }, lang)} · {t.mpSource}: {rep.source}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/report" className={buttonClass()}>{t.mpReport}</Link>
        <Link href="/ask" className={buttonClass({ variant: "secondary" })}>{t.mpAsk}</Link>
        {showProfile && <Link href={`/mp/${rep.id}`} className={buttonClass({ variant: "ghost" })}>{t.mpProfile}</Link>}
        {confirm}
      </div>
    </Card>
  );
}
