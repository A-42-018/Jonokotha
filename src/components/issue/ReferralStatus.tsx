import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { fmtDay, type Dict, type Lang } from "@/lib/i18n";
import { safeHref } from "@/lib/safe";
import { hasReferralStory, referralStages, type ReferralInfo, type StageState } from "@/lib/referral";
import type { Status } from "@/lib/types";

const TONE: Record<StageState, BadgeTone> = { done: "success", not_yet: "neutral", unconfirmed: "warning" };
const ICON: Record<StageState, string> = { done: "✓", not_yet: "○", unconfirmed: "?" };

/**
 * Three separate steps, never merged: received by the office, forwarded to the authority, officially registered.
 * The third is "done" only with proof from the server (`referral.registered`); otherwise it says "not confirmed".
 * `staff` swaps the citizen note for the reminder not to promise registration.
 */
export default function ReferralStatus({ timeline, referral, t, lang, staff = false }: {
  timeline: readonly { status: Status }[];
  referral?: ReferralInfo | null;
  t: Dict;
  lang: Lang;
  staff?: boolean;
}) {
  const s = referralStages(timeline, referral);
  if (!hasReferralStory(s)) return null;
  const rows: { key: string; label: string; state: StageState }[] = [
    { key: "received", label: t.rfReceived, state: s.received },
    { key: "forwarded", label: t.rfForwarded, state: s.forwarded },
    { key: "registered", label: t.rfRegistered, state: s.registered },
  ];
  const stateText = (x: StageState) => (x === "done" ? t.rfDone : x === "unconfirmed" ? t.rfUnconfirmed : t.rfNotYet);
  const proof = safeHref(referral?.registered?.proof_url);
  return (
    <Card title={t.rfTitle}>
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} data-stage={r.key} data-state={r.state} className="flex flex-wrap items-center justify-between gap-2">
            <span>{r.label}</span>
            <Badge tone={TONE[r.state]} icon={ICON[r.state]}>{stateText(r.state)}</Badge>
          </li>
        ))}
      </ol>
      {s.forwarded === "done" && (
        <dl className="mt-3 space-y-1 text-sm">
          {referral?.agency_name ? <div><dt className="inline text-muted">{t.rfTo} </dt><dd className="inline break-words font-medium">{referral.agency_name}</dd></div> : <p className="text-muted">{t.rfNotShown}</p>}
          {referral?.forwarded_at && <div><dt className="inline text-muted">{t.rfOn} </dt><dd className="inline"><time dateTime={referral.forwarded_at}>{fmtDay(referral.forwarded_at, lang)}</time></dd></div>}
          {referral?.office_reference && (
            <div>
              <dt className="inline text-muted">{t.rfOfficeRef} </dt><dd className="inline break-all font-medium">{referral.office_reference}</dd>
              <p className="text-muted">{t.rfOfficeRefNote}</p>
            </div>
          )}
        </dl>
      )}
      <p className="mt-3 text-sm text-muted">
        {s.registered === "done" ? t.rfRegisteredProof : staff ? t.rfStaffNote : t.rfRegisteredNone}
        {s.registered === "done" && proof && <> <a href={proof} rel="noopener noreferrer" target="_blank" className="text-civic underline">{t.rfProofLink}</a></>}
      </p>
    </Card>
  );
}
