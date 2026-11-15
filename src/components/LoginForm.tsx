"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useT } from "@/components/ui/useT";

export default function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  const [codeErr, setCodeErr] = useState("");

  async function send() {
    if (!email.includes("@")) { setEmailErr(t.loginEmailBad); return; }
    setBusy(true); setEmailErr("");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setEmailErr(t.loginSendFail); else setSent(true);
  }
  async function verify() {
    setBusy(true); setCodeErr("");
    const { error } = await supabaseBrowser().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setCodeErr(t.loginVerifyFail); else { router.push("/report"); router.refresh(); }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void (sent ? verify() : send()); }}>
      <h1 className="text-2xl font-semibold text-civic">{t.loginTitle}</h1>
      <p className="text-muted">{t.loginHint}</p>
      <Input label={t.loginEmail} type="email" autoComplete="email" inputMode="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} error={emailErr} />
      {!sent ? (
        <Button type="submit" full loading={busy} disabled={!email}>{busy ? t.loginSending : t.loginSend}</Button>
      ) : (
        <>
          <Input label={t.loginCode} hint={t.loginCodeHint} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={codeErr} />
          <Button type="submit" variant="success" full loading={busy} disabled={code.trim().length < 6}>{busy ? t.loginVerifying : t.loginVerify}</Button>
        </>
      )}
    </form>
  );
}
