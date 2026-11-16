"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import { ApiError } from "@/lib/api-client";
import { sendFeedback, sendReopen } from "@/lib/engagement-api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import Dialog from "@/components/ui/Dialog";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { FEEDBACK_KEY, isRating, NO_FEEDBACK } from "@/lib/follows";
import { fillNum } from "@/lib/format";

export default function ResolutionFeedback(props: { refId: string }) {
  return <QueryProvider><FeedbackInner {...props} /></QueryProvider>;
}

/** After resolution: 1–5 satisfaction, and reopen / appeal (reason required), sent to /api/v1. This device only remembers what was sent, so the screen shows it after a reload. */
function FeedbackInner({ refId }: { refId: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [all, setAll] = useLocalValue(FEEDBACK_KEY, NO_FEEDBACK);
  const saved = all[refId];
  const [pick, setPick] = useState("");
  const [err, setErr] = useState("");
  const [dlg, setDlg] = useState<"" | "reopen" | "appeal">("");
  const [reason, setReason] = useState("");
  const [rErr, setRErr] = useState("");
  const now = () => new Date().toISOString();

  const rating = useMutation({
    mutationFn: (n: number) => sendFeedback(refId, n),
    onSuccess: (_r, n) => setAll({ ...all, [refId]: { ...saved, rating: n, at: now() } }),
    // "Already sent" (409 conflict) is not an error for the person: show it as saved.
    onError: (e, n) => {
      if (e instanceof ApiError && e.code === "conflict") setAll({ ...all, [refId]: { ...saved, rating: n, at: now() } });
      else toast("error", e instanceof ApiError && e.code === "rule_not_met" ? t.enRateNotYet : t.enActionFail);
    },
  });
  const reopen = useMutation({
    mutationFn: (r: string) => sendReopen(refId, r),
    onSuccess: (_x, r) => {
      setAll({ ...all, [refId]: { ...saved, [dlg || "reopen"]: r, at: now() } });
      toast("success", dlg === "appeal" ? t.enAppealSent : t.enReopenSent);
      close();
    },
    onError: (e) => setRErr(e instanceof ApiError && e.code === "rule_not_met" ? t.enReopenWindow : e instanceof ApiError && e.code === "invalid_transition" ? t.enReopenWindow : t.enActionFail),
  });

  function rate() {
    const n = Number(pick);
    if (!isRating(n)) { setErr(t.enRateRequired); return; }
    setErr("");
    rating.mutate(n);
  }

  function send() {
    if (reason.trim().length < 5) { setRErr(t.enReasonRequired); return; }
    reopen.mutate(reason.trim());
  }
  function close() { setDlg(""); setReason(""); setRErr(""); }

  return (
    <>
      <Card title={t.enRateTitle}>
        <div className="space-y-4">
          {saved?.rating ? (
            <p role="status" className="font-medium text-leaf-strong">✓ {fillNum(t.enRateSaved, { n: saved.rating }, lang)}</p>
          ) : (
            <>
              <RadioGroup legend={t.enRateLegend} name={`rate-${refId}`} value={pick} onChange={(v) => { setPick(v); setErr(""); }} error={err}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${"★".repeat(n)} ${fillNum(t.enRateStar, { n }, lang)}` }))} />
              <Button loading={rating.isPending} onClick={rate}>{t.enRateSave}</Button>
            </>
          )}
          <div className="border-t border-line/30 pt-3">
            <p className="mb-2 font-medium">{t.enNotFixed}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDlg("reopen")} disabled={!!saved?.reopen}>{t.enReopen}</Button>
              <Button variant="secondary" onClick={() => setDlg("appeal")} disabled={!!saved?.appeal}>{t.enAppeal}</Button>
            </div>
            {(saved?.reopen || saved?.appeal) && <p role="status" className="mt-2 text-sm">{fillNum(t.enRequested, { kind: saved.reopen ? t.enReopen : t.enAppeal }, lang)}</p>}
          </div>
        </div>
      </Card>
      <Dialog open={dlg !== ""} onClose={close} title={dlg === "appeal" ? t.enAppealTitle : t.enReopenTitle} description={dlg === "appeal" ? t.enAppealBody : t.enReopenBody}
        actions={<><Button variant="ghost" onClick={close}>{t.enCancel}</Button><Button loading={reopen.isPending} onClick={send}>{dlg === "appeal" ? t.enSubmitAppeal : t.enSubmitReopen}</Button></>}>
        <Textarea label={t.enReasonLabel} rows={4} maxLength={1000} value={reason} error={rErr} onChange={(e) => { setReason(e.target.value); setRErr(""); }} />
      </Dialog>
    </>
  );
}
