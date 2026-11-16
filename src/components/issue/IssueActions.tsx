"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import { RadioGroup } from "@/components/ui/Choice";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useShare } from "@/components/ui/useShare";
import { useT } from "@/components/ui/useT";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { fillNum } from "@/lib/i18n";
import { FOLLOWS_KEY, isFollowing, NO_FOLLOWS, toggleFollow } from "@/lib/follows";
import Link from "next/link";
import ShareButtons from "@/components/ui/ShareButtons";

const REASONS = ["Spam", "Abuse", "Private", "False", "Other"] as const;

/** Citizen actions on an issue. Me-too, follow: device-local until the API exists (nothing is sent). Report-content is UI only. */
export default function IssueActions({ refId, title, signedIn = false, meTooBase = 0 }: { refId: string; title: string; signedIn?: boolean; meTooBase?: number }) {
  const t = useT();
  const toast = useToast();
  const { copyLink, share } = useShare(t, `/issue/${refId}`, title);
  const lang = useLang();
  const [follows, setFollows] = useLocalValue(FOLLOWS_KEY, NO_FOLLOWS);
  const following = isFollowing(follows, "issues", refId);
  const meToo = isFollowing(follows, "meToo", refId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const reasonLabel: Record<(typeof REASONS)[number], string> = {
    Spam: t.isReasonSpam, Abuse: t.isReasonAbuse, Private: t.isReasonPrivate, False: t.isReasonFalse, Other: t.isReasonOther,
  };

  function close() {
    setOpen(false);
    setReason("");
    setNote("");
    setError("");
  }

  function send() {
    if (!reason) { setError(t.isReasonRequired); return; }
    close();
    toast("info", t.isReportThanks);
  }

  return (
    <>
      <Card title={t.isShareTitle} headingAs="h2">
        <div className="space-y-3">
          {signedIn ? (
            <Button
              full
              variant={meToo ? "success" : "secondary"}
              aria-pressed={meToo}
              icon={<span aria-hidden>👍</span>}
              onClick={() => { setFollows(toggleFollow(follows, "meToo", refId)); toast("success", meToo ? t.enMeTooRemoved : t.enMeTooAdded); }}
            >
              {meToo ? t.enMeTooDone : t.enMeToo}
            </Button>
          ) : (
            <Link href={`/login?need=1&next=${encodeURIComponent(`/issue/${refId}`)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-civic px-4 font-medium text-civic">{t.enMeToo} · {t.enSignIn}</Link>
          )}
          <p className="text-sm" aria-live="polite">{fillNum(t.enMeTooCount, { n: meTooBase + (meToo ? 1 : 0) }, lang)}</p>
          <p className="text-xs text-muted">{t.enMeTooHint} {t.enMeTooLocal}</p>
          <Button
            full
            variant="secondary"
            aria-pressed={following}
            onClick={() => { setFollows(toggleFollow(follows, "issues", refId)); toast("info", following ? t.isUnfollowToast : t.isFollowToast); }}
            icon={<span aria-hidden>{following ? "🔔" : "🔕"}</span>}
          >
            {following ? t.isFollowing : t.isFollow}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void copyLink()}>{t.copyLink}</Button>
            <Button variant="secondary" onClick={() => void share()}>{t.shareLink}</Button>
          </div>
          <ShareButtons path={`/issue/${refId}`} text={`${t.shText} ${title}`} />
          <p className="text-sm text-muted">{t.isShareHint}</p>
          <Button variant="ghost" onClick={() => setOpen(true)}>{t.isReportContent}</Button>
        </div>
      </Card>

      <Dialog
        open={open}
        onClose={close}
        title={t.isReportTitle}
        description={t.isReportBody}
        actions={
          <>
            <Button variant="ghost" onClick={close}>{t.isReportCancel}</Button>
            <Button variant="danger" onClick={send}>{t.isReportSend}</Button>
          </>
        }
      >
        <RadioGroup
          legend={t.isReasonLegend}
          name="report-reason"
          value={reason}
          onChange={(v) => { setReason(v); setError(""); }}
          error={error}
          options={REASONS.map((r) => ({ value: r, label: reasonLabel[r] }))}
        />
        <Textarea label={t.isReasonNote} optional rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Dialog>
    </>
  );
}

