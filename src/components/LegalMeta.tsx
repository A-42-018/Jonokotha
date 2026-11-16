import Link from "next/link";
import { fillNum, fmtDate } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { POLICY_DATE, POLICY_VERSION, SUPPORT_EMAIL } from "@/lib/legal";

/** Version line, contact and cross links shared by the privacy, terms and challenge pages. */
export default function LegalMeta({ t, lang }: { t: Dict; lang: Lang }) {
  return (
    <div className="space-y-1 text-sm text-muted">
      <p>{fillNum(t.lgVersion, { v: POLICY_VERSION, date: fmtDate(`${POLICY_DATE}T12:00:00+06:00`, lang).split(",")[0] }, lang)}</p>
      <p>{t.lgReviewPending}</p>
      <p>{SUPPORT_EMAIL ? <>{t.lgContact} <a className="text-civic underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></> : t.lgNoContact}</p>
      <p className="flex flex-wrap gap-x-4">
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-civic underline">{t.lgToPrivacy}</Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center text-civic underline">{t.lgToTerms}</Link>
        <Link href="/challenge" className="inline-flex min-h-11 items-center text-civic underline">{t.lgToChallenge}</Link>
      </p>
    </div>
  );
}
