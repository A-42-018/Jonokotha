import Card from "@/components/ui/Card";
import { fmtDate, type Dict, type Lang } from "@/lib/i18n";
import type { AuditEntry } from "@/lib/office-actions";

const ACT = { received: "oaActReceived", acknowledge: "oaActAcknowledge", request_info: "oaActRequestInfo", refer: "oaActRefer", resolve: "oaActResolve" } as const;

/**
 * Staff-only audit list: who did what, when, with which note. Newest first.
 * Render it only inside /office (behind the staff check). Never on /issue or in My Reports.
 */
export default function AuditList({ entries, t, lang }: { entries: AuditEntry[]; t: Dict; lang: Lang }) {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card as="section" title={t.oaAuditTitle} className="min-w-0">
      <p className="mb-3 flex items-start gap-1 text-sm text-muted"><span aria-hidden>🔒</span><span>{t.oaAuditStaffOnly}</span></p>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">{t.oaAuditEmpty}</p>
      ) : (
        <ol aria-label={t.oaAuditAria} className="divide-y divide-line">
          {sorted.map((e) => (
            <li key={e.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-medium text-teal-strong">{t[ACT[e.action]]}</p>
                <time dateTime={e.at} className="text-sm text-muted">{fmtDate(e.at, lang)}</time>
              </div>
              <p className="text-sm"><span className="text-muted">{t.oaAuditActor}: </span>{e.actor ?? <span className="text-muted">{t.oaAuditActorUnknown}</span>}</p>
              <p className="text-sm break-words whitespace-pre-wrap">
                <span className="text-muted">{t.oaAuditNote}: </span>
                {e.note ? e.note : <span className="text-muted">{t.oaAuditNoNote}</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
