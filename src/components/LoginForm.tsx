"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ bn, failed }: { bn: boolean; failed: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(failed ? (bn ? "লিংকটি কাজ করেনি। আবার চেষ্টা করুন।" : "That link did not work. Please try again.") : "");
  const input = "w-full rounded-lg border border-slate-300 bg-white p-3";

  async function send() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{bn ? "সাইন ইন" : "Sign in"}</h1>
      {sent ? (
        <p className="rounded-xl bg-white p-4 shadow-sm">
          {bn ? "আপনার ইমেইলে একটি লিংক পাঠানো হয়েছে। এই ব্রাউজারেই লিংকটি খুলুন।" : "We emailed you a sign-in link. Open it in this same browser."}
        </p>
      ) : (
        <>
          <p className="text-slate-600">{bn ? "ইমেইলে একটি সাইন-ইন লিংক পাঠানো হবে।" : "We will email you a sign-in link."}</p>
          <input className={input} type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={busy || !email.includes("@")} onClick={send} className="w-full rounded-lg bg-civic px-4 py-3 text-white disabled:opacity-50">{bn ? "লিংক পাঠান" : "Send link"}</button>
        </>
      )}
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
