"use client";
import { useState } from "react";
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

/** After resolution: 1–5 satisfaction, and reopen / appeal (reason required). Device-local until the API exists. */
export default function ResolutionFeedback({ refId }: { refId: string }) {
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

  function rate() {
    const n = Number(pick);
    if (!isRating(n)) { setErr(t.enRateRequired); return; }
    setErr("");
    setAll({ ...all, [refId]: { ...saved, rating: n, at: now() } });
  }

  function send() {
    if (reason.trim().length < 5) { setRErr(t.enReasonRequired); return; }
    setAll({ ...all, [refId]: { ...saved, [dlg]: reason.trim(), at: now() } });
    toast("success", dlg === "reopen" ? t.enReopenSent : t.enAppealSent);
    close();
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
              <Button onClick={rate}>{t.enRateSave}</Button>
            </>
          )}
          <div className="border-t border-line/30 pt-3">
            <p className="mb-2 font-medium">{t.enNotFixed}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDlg("reopen")} disabled={!!saved?.reopen}>{t.enReopen}</Button>
              <Button variant="secondary" onClick={() => setDlg("appeal")} disabled={!!saved?.appeal}>{t.enAppeal}</Button>
            </div>
            {(saved?.reopen || saved?.appeal) && <p role="status" className="mt-2 text-sm">{fillNum(t.enRequested, { kind: saved.reopen ? t.enReopen : t.enAppeal }, lang)}</p>}
            <p className="mt-2 text-xs text-muted">{t.enFeedbackLocal}</p>
          </div>
        </div>
      </Card>
      <Dialog open={dlg !== ""} onClose={close} title={dlg === "appeal" ? t.enAppealTitle : t.enReopenTitle} description={dlg === "appeal" ? t.enAppealBody : t.enReopenBody}
        actions={<><Button variant="ghost" onClick={close}>{t.enCancel}</Button><Button onClick={send}>{dlg === "appeal" ? t.enSubmitAppeal : t.enSubmitReopen}</Button></>}>
        <Textarea label={t.enReasonLabel} rows={4} maxLength={1000} value={reason} error={rErr} onChange={(e) => { setReason(e.target.value); setRErr(""); }} />
      </Dialog>
    </>
  );
}
