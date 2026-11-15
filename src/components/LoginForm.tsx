"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ bn }: { bn: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = "w-full rounded-lg border border-slate-300 bg-white p-3";

  async function send() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }
  async function verify() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setErr(error.message); else { router.push("/report"); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{bn ? "সাইন ইন" : "Sign in"}</h1>
      <p className="text-slate-600">{bn ? "ইমেইলে একটি কোড পাঠানো হবে।" : "We will email you a code."}</p>
      <input className={input} type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} />
      {!sent ? (
        <button disabled={busy || !email.includes("@")} onClick={send} className="w-full rounded-lg bg-civic px-4 py-3 text-white disabled:opacity-50">{bn ? "কোড পাঠান" : "Send code"}</button>
      ) : (
        <>
          <input className={input} inputMode="numeric" placeholder={bn ? "কোড" : "Code"} value={code} onChange={(e) => setCode(e.target.value)} />
          <button disabled={busy || code.trim().length < 6} onClick={verify} className="w-full rounded-lg bg-leaf px-4 py-3 text-white disabled:opacity-50">{bn ? "যাচাই করুন" : "Verify"}</button>
        </>
      )}
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
