import { createPrivateKey, sign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "../supabase/service";
import { sendChannelText } from "../channels/send";
import { renderEmail, isEssential } from "./templates";
import { unsubscribeUrl } from "./unsubscribe";

/**
 * Delivery worker for queued push and email notifications (migration 0018). Called by a scheduled job through
 * POST /api/internal/notifications/deliver. Failures are retried with exponential backoff and moved to the dead-letter
 * state after 5 tries (see finish_delivery). Nothing sensitive is sent: push carries NO payload (the app fetches the
 * notification after wake-up), and email carries only the generic title and reference number.
 */

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export const vapidConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** VAPID (RFC 8292) JWT for one push service origin. Keys are the raw base64url P-256 public (65 bytes) and private (32 bytes) values. */
export function vapidHeader(endpoint: string, now = Date.now()): string {
  const pub = Buffer.from(process.env.VAPID_PUBLIC_KEY!, "base64url"), d = process.env.VAPID_PRIVATE_KEY!;
  const key = createPrivateKey({ key: { kty: "EC", crv: "P-256", d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: "jwk" });
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || "mailto:admin@jonokotha.example" }));
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${process.env.VAPID_PUBLIC_KEY}`;
}

export const emailConfigured = () => !!(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const provider = process.env.EMAIL_PROVIDER;
  try {
    const res = provider === "postmark"
      ? await fetch(`${process.env.EMAIL_API_BASE || "https://api.postmarkapp.com"}/email`, { method: "POST", headers: { "content-type": "application/json", "x-postmark-server-token": process.env.EMAIL_API_KEY! },
          body: JSON.stringify({ From: process.env.EMAIL_FROM, To: to, Subject: subject, TextBody: text, MessageStream: "outbound" }), signal: AbortSignal.timeout(10_000) })
      : await fetch(`${process.env.EMAIL_API_BASE || "https://api.resend.com"}/emails`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_API_KEY}` },
          body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }), signal: AbortSignal.timeout(10_000) });
    return res.ok ? { ok: true } : { ok: false, error: `http_${res.status}` };
  } catch (e) { return { ok: false, error: (e as Error)?.name ?? "error" }; }
}

interface Claimed { id: string; channel: "push" | "email" | "sms" | "whatsapp"; attempts: number; user_id: string; ref: string | null; type?: string; title: string; body: string | null; data: { en?: { title: string; body: string } } }

async function deliverOne(svc: SupabaseClient, d: Claimed): Promise<"sent" | "failed" | "skipped"> {
  const finish = async (ok: boolean, error?: string, skip = false) => { await svc.rpc("finish_delivery", { p_id: d.id, p_ok: ok, p_error: error ?? null, p_skip: skip }); };
  if (d.channel === "push") {
    if (!vapidConfigured()) { await finish(false, "not_configured", true); return "skipped"; }
    const { data: subs } = await svc.from("push_subscriptions").select("id,endpoint").eq("user_id", d.user_id);
    if (!subs?.length) { await finish(false, "no_device", true); return "skipped"; }
    let any = false, lastErr = "";
    for (const s of subs) {
      try {
        const res = await fetch(s.endpoint, { method: "POST", headers: { authorization: vapidHeader(s.endpoint), ttl: "86400", urgency: "normal", "content-length": "0" }, signal: AbortSignal.timeout(10_000) });
        if (res.status === 404 || res.status === 410) { await svc.from("push_subscriptions").delete().eq("id", s.id); continue; }  // the device is gone
        if (res.ok) { any = true; await svc.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failures: 0 }).eq("id", s.id); } else lastErr = `http_${res.status}`;
      } catch (e) { lastErr = (e as Error)?.name ?? "error"; }
    }
    if (any) { await finish(true); return "sent"; }
    if (!lastErr) { await finish(false, "no_device", true); return "skipped"; }
    await finish(false, lastErr); return "failed";
  }
  if (d.channel === "sms" || d.channel === "whatsapp") {
    // B7.4: own-case updates and area alerts by SMS or WhatsApp. Generic title and reference only; destination from the person's confirmed link.
    const { data: to } = await svc.rpc("channel_destination", { p_user: d.user_id, p_channel: d.channel });
    if (!to) { await finish(false, "no_link", true); return "skipped"; }
    const en = d.data?.en;
    const text = [d.title, d.body, en ? `/ ${en.title}` : ""].filter(Boolean).join(" ");
    const r = await sendChannelText(svc, { channel: d.channel, linkId: null, to: to as string, text, issueRef: d.ref, essential: isEssential(d.type ?? "") });
    if (r === "sent") { await finish(true); return "sent"; }
    if (r === "failed") { await finish(false, "provider_error"); return "failed"; }
    await finish(false, r === "skipped_budget" ? "budget_reached" : "not_configured", true); return "skipped";
  }
  if (!emailConfigured()) { await finish(false, "not_configured", true); return "skipped"; }
  const { data: u } = await svc.auth.admin.getUserById(d.user_id);
  const to = u?.user?.email;
  if (!to) { await finish(false, "no_email", true); return "skipped"; }
  const app = process.env.NEXT_PUBLIC_APP_URL || "";
  const en = d.data?.en;
  const { subject, text } = renderEmail({ type: d.type ?? "issue_status", title: d.title, body: d.body, en, appUrl: app || undefined, unsubscribeUrl: app ? unsubscribeUrl(app, d.user_id, d.type ?? "issue_status") : undefined });
  const r = await sendEmail(to, subject, text);
  if (r.ok) { await finish(true); return "sent"; }
  await finish(false, r.error); return "failed";
}

export async function deliverDue(limit = 25): Promise<{ claimed: number; sent: number; failed: number; skipped: number } | null> {
  const svc = serviceClient();
  if (!svc) return null;
  const { data, error } = await svc.rpc("claim_deliveries", { p_limit: limit });
  if (error) throw error;
  const out = { claimed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const d of (data ?? []) as Claimed[]) { out.claimed++; out[await deliverOne(svc, d)]++; }
  return out;
}
