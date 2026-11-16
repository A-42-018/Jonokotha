"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ bn, linkError = false, demoError = false, demo = false }: { bn: boolean; linkError?: boolean; demoError?: boolean; demo?: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(demoError ? (bn ? "ডেমো লগইন কাজ করেনি।" : "Demo login failed.") : linkError ? (bn ? "লিংকটি কাজ করেনি বা মেয়াদ শেষ। একই ব্রাউজারে আবার চেষ্টা করুন।" : "That link did not work or has expired. Try again in the same browser.") : "");
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
      <p className="text-slate-600">{bn ? "ইমেইলে একটি সাইন-ইন লিংক পাঠানো হবে।" : "We will email you a sign-in link."}</p>
      <input className={input} type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} />
      {!sent ? (
        <button disabled={busy || !email.includes("@")} onClick={send} className="w-full rounded-lg bg-civic px-4 py-3 text-white disabled:opacity-50">{bn ? "লিংক পাঠান" : "Send link"}</button>
      ) : (
        <p className="rounded-lg bg-slate-100 p-3 text-slate-700">{bn ? "ইমেইল দেখুন এবং লিংকে ক্লিক করুন। এই একই ব্রাউজারে খুলুন।" : "Check your email and click the link. Open it in this same browser."}</p>
      )}
      {err && <p className="text-sm text-red-700">{err}</p>}
      {demo && (
        <form method="post" action="/api/demo-login" className="space-y-2 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">{bn ? "ডেমো লগইন (শুধু ডেভেলপমেন্টের জন্য)" : "Demo login (development only)"}</p>
          <div className="grid grid-cols-2 gap-2">
            <button name="role" value="citizen" className="rounded-lg border border-civic px-4 py-3 text-civic">{bn ? "নাগরিক" : "Citizen"}</button>
            <button name="role" value="staff" className="rounded-lg border border-leaf px-4 py-3 text-leaf">{bn ? "অফিস কর্মী" : "Office staff"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
