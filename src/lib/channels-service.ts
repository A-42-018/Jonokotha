import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { processInbound, type Inbound } from "./channels/inbound";
import { verifySignature } from "./channels/signature";
import { serviceClient } from "./supabase/service";

/** B7.2 / B7.4: linking a phone number, the two inbound webhooks, and the administrator's cost view. */
const POLICY_VERSION = "2026-11";
const KEY = z.enum(["whatsapp", "sms"]);

export async function listMyChannels(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("channel_links").select("id,channel,address_hint,status,code_expires_at,updates_enabled,created_at,verified_at").neq("status", "revoked").order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
export async function startChannelLink(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ channel: KEY, address: z.string().trim().min(8).max(20), accept_privacy: z.literal(true, { error: "You must accept the privacy notice to link a number." }), policy_version: z.string().regex(/^[A-Za-z0-9._-]{1,20}$/).optional() }), c.body);
  const out = await rpc<{ code: string }>(c.sb, "start_channel_link", { p_channel: b.channel, p_address: b.address, p_policy_version: b.policy_version ?? POLICY_VERSION });
  const to = b.channel === "whatsapp" ? process.env.WHATSAPP_DISPLAY_NUMBER : process.env.SMS_SHORT_CODE;
  return { status: 201, data: { ...out, send_to: to ?? null, instructions: "Send this code, as a message, from the number you entered. It expires in 30 minutes." } };
}
export async function revokeChannel(c: Ctx): Promise<Result> {
  const id = z.uuid().safeParse(c.params.id); if (!id.success) throw new ApiError("not_found", "Not found.");
  return { data: await rpc(c.sb, "revoke_channel_link", { p_id: id.data }) };
}
export async function setChannelUpdates(c: Ctx): Promise<Result> {
  const id = z.uuid().safeParse(c.params.id); if (!id.success) throw new ApiError("not_found", "Not found.");
  const b = parse(z.strictObject({ updates_enabled: z.boolean() }), c.body);
  return { data: await rpc(c.sb, "set_channel_updates", { p_id: id.data, p_enabled: b.updates_enabled }) };
}
export async function channelCosts(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  return { data: await rpc(c.sb, "channel_cost_report") };
}
export async function setChannelBudget(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ channel: KEY, month: z.iso.date().optional(), budget_usd: z.number().positive().max(1_000_000) }), c.body);
  return { data: await rpc(c.sb, "set_channel_budget", { p_channel: b.channel, p_month: b.month ?? null, p_budget: b.budget_usd }) };
}

// Webhooks -----------------------------------------------------------------------------------------------------------------------------------------------
/** Meta's one-time handshake: echo hub.challenge when the verify token matches. */
export async function whatsappVerify(c: Ctx): Promise<Result> {
  const q = c.url.searchParams, want = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!want || q.get("hub.mode") !== "subscribe" || q.get("hub.verify_token") !== want) throw new ApiError("forbidden", "Verification failed.");
  return { raw: { body: q.get("hub.challenge") ?? "", contentType: "text/plain" } };
}

const WaPayload = z.object({ entry: z.array(z.object({ changes: z.array(z.object({ value: z.object({
  messages: z.array(z.object({ id: z.string().max(200), from: z.string().max(30), type: z.string().max(20), text: z.object({ body: z.string().max(4096) }).optional() })).optional(),
  statuses: z.array(z.object({ id: z.string().max(200), status: z.string().max(20) })).optional(),
}) })) })) });

export async function whatsappWebhook(c: Ctx): Promise<Result> {
  const raw = await c.req.text();
  if (!verifySignature(process.env.WHATSAPP_APP_SECRET, raw, c.req.headers.get("x-hub-signature-256"))) throw new ApiError("unauthenticated", "Bad signature.");
  let json: unknown; try { json = JSON.parse(raw); } catch { throw new ApiError("invalid_json", "Body must be valid JSON."); }
  const p = WaPayload.safeParse(json);
  if (!p.success) return { data: { processed: 0 } };            // other event kinds: acknowledge so the provider does not retry
  const svc = serviceClient(); if (!svc) throw new ApiError("unavailable", "Service role is not configured on this server.");
  let n = 0;
  for (const e of p.data.entry) for (const ch of e.changes) {
    for (const s of ch.value.statuses ?? []) await svc.from("channel_messages").update({ note: `delivery:${s.status}` }).eq("channel", "whatsapp").eq("direction", "out").eq("provider_message_id", s.id);   // provider delivery status, never "read by the user"
    for (const m of ch.value.messages ?? []) {
      const kind: Inbound["kind"] = m.type === "text" ? "text" : m.type === "image" ? "image" : m.type === "location" ? "location" : "other";
      await processInbound(svc, { channel: "whatsapp", providerId: m.id, from: m.from, text: m.text?.body ?? "", kind }); n++;
    }
  }
  return { data: { processed: n } };
}

const SmsPayload = z.object({ id: z.string().min(1).max(200), from: z.string().min(6).max(30), text: z.string().max(1600) });
export async function smsWebhook(c: Ctx): Promise<Result> {
  const raw = await c.req.text();
  if (!verifySignature(process.env.SMS_WEBHOOK_SECRET, raw, c.req.headers.get("x-signature"))) throw new ApiError("unauthenticated", "Bad signature.");
  let json: unknown; try { json = JSON.parse(raw); } catch { throw new ApiError("invalid_json", "Body must be valid JSON."); }
  const p = SmsPayload.safeParse(json);
  if (!p.success) throw new ApiError("validation_failed", "Expected {id, from, text}.", { _: "shape" });
  const svc = serviceClient(); if (!svc) throw new ApiError("unavailable", "Service role is not configured on this server.");
  return { data: await processInbound(svc, { channel: "sms", providerId: p.data.id, from: p.data.from, text: p.data.text, kind: "text" }) };
}
