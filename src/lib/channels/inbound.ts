import type { SupabaseClient } from "@supabase/supabase-js";
import { detectEmergency } from "../emergency";
import { draftIntakeV2 } from "../intake-v2";
import { sendChannelText } from "./send";
import type { Channel } from "./provider";

/**
 * Inbound WhatsApp / SMS message handling (B7.2; masterplan §7.15, §8.12). Runs with the service role because a webhook has no session; identity
 * comes from the number a signed-in citizen linked and confirmed in the app (migration 0073). Order of business, every time:
 *   1. an unknown number gets one fixed "link your account" reply (or is linked when the message carries a valid code); nothing else is stored
 *   2. imminent harm gets fixed emergency guidance, never an AI reply, and creates nothing
 *   3. a draft is made by the Intake Agent (or its fallback) and sent back for confirmation; NOTHING is created yet
 *   4. only "হ্যাঁ"/"yes" to a pending draft creates the case, with the same reference, timeline and privacy rules as the app
 */
export interface Inbound { channel: Channel; providerId: string; from: string; text: string; kind?: "text" | "image" | "location" | "other" }
export type InboundResult = { action: "duplicate" | "unknown_sender" | "linked" | "link_failed" | "emergency" | "rate_limited" | "draft_sent" | "created" | "cancelled" | "need_area" | "daily_limit" | "unsupported" | "privacy_notice"; ref?: string };

export const YES = ["হ্যাঁ", "হ্যা", "হাঁ", "জি", "yes", "y", "ha", "haa", "hya", "ok", "okay"];
export const NO = ["না", "নাহ", "no", "n", "cancel", "বাতিল"];
const norm = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/[।.!?\s]+$/g, "");
export const isYes = (s: string) => YES.includes(norm(s));
export const isNo = (s: string) => NO.includes(norm(s));
export const e164 = (from: string) => (from.startsWith("+") ? from : `+${from.replace(/\D/g, "")}`);

export const T = {
  link: "জনকথা: এই নম্বর কোনো অ্যাকাউন্টের সাথে যুক্ত নয়। অ্যাপে সাইন ইন করে “মেসেজিং” থেকে নম্বর যুক্ত করুন। / Jonokotha: this number is not linked. Sign in to the app and link it under Messaging.",
  privacy: "জনকথা: নম্বর যুক্ত হয়েছে। আপনার নম্বর শুধু রিপোর্টের উত্তর পাঠাতে ব্যবহার হবে; বার্তা ৯০ দিন রাখা হয়; অ্যাপ থেকে যেকোনো সময় সরানো যায়। এখন সমস্যাটি লিখে পাঠান। / Linked. Your number is used only to reply about your reports; messages are kept 90 days; remove it in the app any time. Now send your problem in words.",
  photoNote: "জনকথা: এখন শুধু লেখা নিতে পারি। ছবি বা লোকেশন অ্যাপে যোগ করুন। / Text only for now; add photos or location in the app.",
  needArea: "জনকথা: রিপোর্ট করতে আগে অ্যাপে আপনার এলাকা অনুসরণ করুন। / Follow your area in the app first, then send again.",
  limit: "জনকথা: আজকের রিপোর্টের সীমা শেষ। কাল আবার চেষ্টা করুন। / Today's report limit is reached. Try again tomorrow.",
  cancelled: "জনকথা: খসড়া বাতিল হয়েছে। / The draft was cancelled.",
  draft: (title: string, cat: string) => `জনকথা: খসড়া — ${title} (${cat})। ঠিক থাকলে “হ্যাঁ” লিখুন, বাতিল করতে “না”। / Draft: ${title}. Reply yes to send, no to cancel.`,
  created: (ref: string) => `জনকথা: রিপোর্ট জমা হয়েছে। নম্বর ${ref}। / Report sent. Reference ${ref}.`,
};
const DAILY_LIMIT = 10, HOURLY_INBOUND_LIMIT = 30;

export async function processInbound(svc: SupabaseClient, m: Inbound): Promise<InboundResult> {
  const to = e164(m.from);
  const reply = (text: string, link: string | null, essential = true, ref?: string) => sendChannelText(svc, { channel: m.channel, linkId: link, to, text, issueRef: ref ?? null, essential });
  const { data: found } = await svc.rpc("channel_find_link", { p_channel: m.channel, p_address: to });
  const link = (found as { link_id: string; user_id: string; state: string; draft: { title: string; category: string; description: string; area_hint?: string } | null; privacy_notice_sent_at: string | null }[] | null)?.[0];

  // Duplicate delivery from the provider (they retry): one row per provider message id.
  const ins = await svc.from("channel_messages").insert({ link_id: link?.link_id ?? null, channel: m.channel, direction: "in", provider_message_id: m.providerId, body: link ? m.text.slice(0, 2000) : null, kind: m.kind ?? "text", status: "received" });
  if (ins.error?.code === "23505") return { action: "duplicate" };

  if (!link) {
    const code = /\bJK\d{6}\b/i.exec(m.text)?.[0];
    if (code) {
      const { data: c } = await svc.rpc("channel_confirm_link", { p_channel: m.channel, p_address: to, p_code: code });
      const res = c as { linked: boolean; link_id?: string } | null;
      if (res?.linked && res.link_id) {
        await reply(T.privacy, res.link_id);
        await svc.from("channel_conversations").update({ privacy_notice_sent_at: new Date().toISOString() }).eq("link_id", res.link_id);
        return { action: "linked" };
      }
      await reply(T.link, null);
      return { action: "link_failed" };
    }
    await reply(T.link, null);
    return { action: "unknown_sender" };
  }

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await svc.from("channel_messages").select("id", { count: "exact", head: true }).eq("link_id", link.link_id).eq("direction", "in").gte("created_at", since);
  if ((count ?? 0) > HOURLY_INBOUND_LIMIT) return { action: "rate_limited" };
  await svc.from("channel_links").update({ last_inbound_at: new Date().toISOString() }).eq("id", link.link_id);

  if ((m.kind ?? "text") !== "text" || !m.text.trim()) { await reply(T.photoNote, link.link_id); return { action: "unsupported" }; }

  const em = detectEmergency(m.text);
  if (em) { await reply(`${em.guidance.bn} / ${em.guidance.en}`, link.link_id); return { action: "emergency" }; }

  const setConv = (state: "idle" | "awaiting_confirm", draft: unknown) => svc.from("channel_conversations").upsert({ link_id: link.link_id, state, draft, updated_at: new Date().toISOString() });

  if (link.state === "awaiting_confirm" && link.draft && isNo(m.text)) { await setConv("idle", null); await reply(T.cancelled, link.link_id); return { action: "cancelled" }; }
  if (link.state === "awaiting_confirm" && link.draft && isYes(m.text)) {
    const { data: area } = await svc.from("follows").select("constituencies(key)").eq("user_id", link.user_id).eq("target_type", "area").order("created_at").limit(1);
    const key = ((area?.[0] as unknown as { constituencies: { key: string } | null } | undefined)?.constituencies)?.key;
    if (!key) { await reply(T.needArea, link.link_id); return { action: "need_area" }; }
    const day = new Date(Date.now() - 86400_000).toISOString();
    const { count: made } = await svc.from("issues").select("id", { count: "exact", head: true }).eq("reporter_id", link.user_id).gte("created_at", day);
    if ((made ?? 0) >= DAILY_LIMIT) { await reply(T.limit, link.link_id); return { action: "daily_limit" }; }
    const d = link.draft;
    const { data: issue, error } = await svc.from("issues").insert({ reporter_id: link.user_id, title: d.title, category: d.category, description: d.description, area: d.area_hint ?? "", constituency_key: key,
      ai_summary: d.description.slice(0, 160), ai_confidence: 0.7, ai_similar: [], source_channel: m.channel }).select("ref").single();
    if (error || !issue) { await reply("জনকথা: এখন জমা দেওয়া যায়নি, একটু পরে আবার “হ্যাঁ” লিখুন। / Could not send just now; reply yes again shortly.", link.link_id); throw error ?? new Error("issue insert failed"); }
    await setConv("idle", null);
    await reply(T.created(issue.ref as string), link.link_id, true, issue.ref as string);
    return { action: "created", ref: issue.ref as string };
  }

  // New text (also when it replaces an unanswered draft): draft it, ask for confirmation, create nothing.
  const draft = await draftIntakeV2(m.text, "auto", { actorId: link.user_id });
  const stored = { title: draft.title, category: draft.category, description: draft.description, area_hint: draft.area_hint };
  await setConv("awaiting_confirm", stored);
  await reply(T.draft(draft.title, draft.category), link.link_id);
  return { action: "draft_sent" };
}
