import Link from "next/link";
import ResolutionFeedback from "@/components/issue/ResolutionFeedback";
import IssueActions from "@/components/issue/IssueActions";
import OfficialResponse from "@/components/issue/OfficialResponse";
import StatusTimeline from "@/components/issue/StatusTimeline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import StatusChip from "@/components/ui/StatusChip";
import { fmtDate, type Dict, type Lang } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";

/** Public issue page body. Reads public fields only; ai.* and timeline notes are never rendered. */
export default function IssueView({ c, t, lang, signedIn = false }: { c: CaseRecord; t: Dict; lang: Lang; signedIn?: boolean }) {
  const steps = c.timeline.map((e) => ({ status: e.status, at: e.at }));
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-civic underline focus-visible:outline-2 focus-visible:outline-civic">← {t.isBackHome}</Link>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <div className="space-y-4">
          <header className="space-y-2">
            <h1 className="break-words text-2xl font-semibold text-civic">{c.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <span>{t.refId}: <b className="select-all text-foreground">{c.ref}</b></span>
              <StatusChip status={c.status} label={t.statuses[c.status]} />
              <Badge tone="teal">{t.cats[c.category]}</Badge>
              <span className="min-w-0 max-w-full break-words">{c.area || t.isNoArea}</span>
              <span>{t.isReportedOn}: {fmtDate(c.createdAt, lang)}</span>
            </div>
          </header>
          <Card title={t.isReportDetails}>
            <p className="whitespace-pre-wrap break-words">{c.description}</p>
          </Card>
          <OfficialResponse t={t} lang={lang} />
          {c.status === "resolved" && signedIn && <ResolutionFeedback refId={c.ref} />}
        </div>
        <div className="space-y-4">
          <Card title={t.timeline}>
            <StatusTimeline steps={steps} t={t} lang={lang} />
          </Card>
          <IssueActions refId={c.ref} title={c.title} signedIn={signedIn} />
        </div>
      </div>
    </div>
  );
}
