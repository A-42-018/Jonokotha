import Link from "next/link";
import ResolutionFeedback from "@/components/issue/ResolutionFeedback";
import IssueActions from "@/components/issue/IssueActions";
import OfficialResponse from "@/components/issue/OfficialResponse";
import MoreInfo from "@/components/issue/MoreInfo";
import ProgressEvidence from "@/components/issue/ProgressEvidence";
import ReferralStatus from "@/components/issue/ReferralStatus";
import StatusTimeline from "@/components/issue/StatusTimeline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import TranslatedText from "@/components/ui/TranslatedText";
import PlannedPanel from "@/components/ui/PlannedPanel";
import StatusChip from "@/components/ui/StatusChip";
import { fmtDate, type Dict, type Lang } from "@/lib/i18n";
import type { ReferralInfo } from "@/lib/referral";
import type { CaseRecord } from "@/lib/types";

/** Public issue page body. Reads public fields only; ai.* and timeline notes are never rendered. */
export default function IssueView({ c, t, lang, signedIn = false, referral = null }: { c: CaseRecord; t: Dict; lang: Lang; signedIn?: boolean; referral?: ReferralInfo | null }) {
  const steps = c.timeline.map((e) => ({ status: e.status, at: e.at }));
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-civic underline focus-visible:outline-2 focus-visible:outline-civic">← {t.isBackHome}</Link>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <div className="space-y-4">
          <header className="space-y-2">
            <h1 className="break-words jk-h1">{c.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <span>{t.refId}: <b className="select-all text-foreground">{c.ref}</b></span>
              <StatusChip status={c.status} label={t.statuses[c.status]} />
              <Badge tone="teal">{t.cats[c.category]}</Badge>
              <span className="min-w-0 max-w-full break-words">{c.area || t.isNoArea}</span>
              <span>{t.isReportedOn}: {fmtDate(c.createdAt, lang)}</span>
            </div>
          </header>
          <Card title={t.isReportDetails}>
            <TranslatedText text={c.description} className="whitespace-pre-wrap break-words" signedIn={signedIn} next={`/issue/${encodeURIComponent(c.ref)}`} />
          </Card>
          <OfficialResponse t={t} lang={lang} />
          <ReferralStatus timeline={c.timeline} referral={referral} t={t} lang={lang} />
          <ProgressEvidence refId={c.ref} signedIn={signedIn} />
          {c.statusDetail === "needs_information" && <MoreInfo refId={c.ref} signedIn={signedIn} />}
          {c.status === "referred" && <p role="note" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.isReferredNote}</p>}
          {c.status === "resolved" && signedIn && <ResolutionFeedback refId={c.ref} />}
        </div>
        <div className="space-y-4">
          <Card title={t.timeline}>
            <StatusTimeline steps={steps} t={t} lang={lang} />
          </Card>
          <IssueActions refId={c.ref} title={c.title} signedIn={signedIn} />
          {signedIn && <PlannedPanel as="h3" title={t.rxStillTitle} body={t.rxStillBody} />}
          <p className="text-sm text-muted">{t.isOfficialNote}</p>
        </div>
      </div>
    </div>
  );
}
