import Link from "next/link";
import Badge from "@/components/ui/Badge";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { fillNum, fmtDay, type Dict, type Lang } from "@/lib/i18n";
import { sourceHost, type RepView } from "@/lib/mp-api";

/** Verified representative card: verification date and source always shown; sample entries say so. */
export default function RepCard({ rep, t, lang, showProfile = true, confirm }: { rep: RepView; t: Dict; lang: Lang; showProfile?: boolean; confirm?: React.ReactNode }) {
  const host = sourceHost(rep.source);
  return (
    <Card as="article" className="space-y-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={rep.photoUrl ?? "/illustrations/mp-portrait.svg"} alt={rep.photoUrl ? rep.name : ""} className={`size-20 shrink-0 rounded-xl bg-slate-50 ${rep.photoUrl ? "object-cover" : ""}`} />
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{rep.name}</h3>
          <p className="text-sm text-muted">{rep.role}{rep.constituency && ` · ${rep.constituency}`}</p>
          {rep.party && <p className="text-sm text-muted">{rep.party}</p>}
          {rep.roleNote && <p className="text-sm font-medium text-foreground">{rep.roleNote}</p>}
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" icon="✓">{t.mpVerified}</Badge>
            {rep.sample && <CapabilityLabel status="sample" />}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted">
        {rep.verifiedAt && <>{fillNum(t.mpVerifiedOn, { date: fmtDay(rep.verifiedAt, lang) }, lang)}</>}
        {host && <> · {t.mpSource}: {host}</>}
        {rep.photoUrl && <> · {t.mpPhotoCredit}</>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/report" className={buttonClass()}>{t.mpReport}</Link>
        <Link href="/ask" className={buttonClass({ variant: "secondary" })}>{t.mpAsk}</Link>
        {showProfile && <Link href={`/mp/${rep.id}`} className={buttonClass({ variant: "ghost" })}>{t.mpProfile}</Link>}
        {confirm}
      </div>
    </Card>
  );
}
