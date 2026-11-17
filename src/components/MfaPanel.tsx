"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useT } from "@/components/ui/useT";
import { cleanDigits } from "@/lib/numerals";
import { classifyMfaError, type MfaFailure } from "@/lib/mfa";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "loading" | "start" | "enroll" | "challenge" | "unavailable";
interface Enrolment { factorId: string; qr: string; secret: string }

/**
 * TOTP enrolment and step-up (masterplan 5, 18.1). First time: link an authenticator (QR and typed secret), confirm with a code.
 * After that: just the code. Supabase has no recovery codes for TOTP, so the lost-phone path is an administrator removing the
 * factor; this screen says so rather than showing codes that do not exist.
 */
export default function MfaPanel({ next, email }: { next: string; email: string }) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [enrol, setEnrol] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const say = (f: MfaFailure) => setErr(f === "wrong" ? t.mfaWrongCode : f === "tooMany" ? t.mfaTooMany : f === "unavailable" ? t.mfaUnavailable : t.mfaFailed);

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data, error } = await supabaseBrowser().auth.mfa.listFactors();
      if (!live) return;
      if (error) { setMode("unavailable"); say(classifyMfaError(error)); return; }
      const verified = data?.totp?.[0]; // listFactors returns only verified factors in `totp`
      if (verified) { setFactorId(verified.id); setMode("challenge"); } else setMode("start");
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    // A half-finished earlier attempt would block a new one; clear unverified factors first.
    const all = await sb.auth.mfa.listFactors();
    for (const f of all.data?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `jonokotha-${Date.now().toString(36)}` });
    setBusy(false);
    if (error || !data) { const f = classifyMfaError(error); say(f); if (f === "unavailable") setMode("unavailable"); return; }
    setEnrol({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setFactorId(data.id);
    setMode("enroll");
  }

  async function verify() {
    const clean = cleanDigits(code);
    if (!/^\d{6}$/.test(clean)) { setErr(t.mfaCodeShort); return; }
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId, code: clean });
    setBusy(false);
    if (error) { say(classifyMfaError(error)); setCode(""); return; }
    setDone(true);
    router.push(next);
    router.refresh();
  }

  const lead = mode === "challenge" ? t.mfaLeadChallenge : t.mfaLeadEnroll;
  return (
    <div className="space-y-4">
      <h1 className="jk-h1">{t.mfaTitle}</h1>
      <p className="text-muted">{lead}</p>
      <p className="text-sm text-muted">{t.mfaSignedAs} <span className="break-all font-medium text-foreground">{email}</span></p>

      {mode === "loading" && <p role="status">{t.mfaLoading}</p>}

      {mode === "unavailable" && <p role="alert" className="rounded-lg border border-danger bg-white p-3">{err || t.mfaUnavailable}</p>}

      {mode === "start" && (
        <>
          {err && <p role="alert" className="text-danger">{err}</p>}
          <Button full loading={busy} onClick={() => void start()}>{busy ? t.mfaStarting : t.mfaStart}</Button>
        </>
      )}

      {(mode === "enroll" || mode === "challenge") && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-4">
          {mode === "enroll" && enrol && (
            <div className="space-y-3">
              <ol className="list-none space-y-1 text-sm"><li>{t.mfaStep1}</li><li>{t.mfaStep2}</li><li>{t.mfaStep3}</li></ol>
              {/* The QR is an SVG data URI from Supabase (CSP allows data: images). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrol.qr} alt={t.mfaQrAlt} width={200} height={200} className="mx-auto rounded-lg border border-slate-300 bg-white p-2" />
              <p className="text-sm"><span className="text-muted">{t.mfaSecretLabel}</span><br /><code className="break-all select-all rounded bg-slate-100 px-1" dir="ltr">{enrol.secret}</code></p>
            </div>
          )}
          <Input label={t.mfaCode} hint={t.mfaCodeHint} inputMode="numeric" autoComplete="one-time-code" maxLength={14} value={code} onChange={(e) => setCode(e.target.value)} error={err} dir="ltr" />
          <Button type="submit" variant="success" full loading={busy} disabled={cleanDigits(code).length < 6 || done}>{busy ? t.mfaVerifying : t.mfaVerify}</Button>
          {done && <p role="status">{t.mfaDone}</p>}
        </form>
      )}

      <Card title={t.mfaWhyTitle}><p className="text-sm text-muted">{t.mfaWhyBody}</p></Card>
      <Card title={t.mfaLostTitle}><p className="text-sm text-muted">{t.mfaLostBody}</p></Card>
    </div>
  );
}
