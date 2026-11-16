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

const REASONS = ["Spam", "Abuse", "Private", "False", "Other"] as const;

/** Citizen actions on an issue. All UI-only until Phase 2: nothing here is sent to the server. */
export default function IssueActions({ refId, title }: { refId: string; title: string }) {
  const t = useT();
  const toast = useToast();
  const { copyLink, share } = useShare(t, `/issue/${refId}`, title);
  const [following, setFollowing] = useState(false);
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
          <Button full disabled aria-disabled="true" variant="success" icon={<span aria-hidden>👍</span>}>
            {t.isMeToo} · {t.isMeTooSoon}
          </Button>
          <Button
            full
            variant="secondary"
            aria-pressed={following}
            onClick={() => { setFollowing(!following); toast("info", following ? t.isUnfollowToast : t.isFollowToast); }}
            icon={<span aria-hidden>{following ? "🔔" : "🔕"}</span>}
          >
            {following ? t.isFollowing : t.isFollow}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void copyLink()}>{t.copyLink}</Button>
            <Button variant="secondary" onClick={() => void share()}>{t.shareLink}</Button>
          </div>
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

