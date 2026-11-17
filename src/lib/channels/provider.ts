/**
 * Message providers (B7.2, B7.4). Interfaces, so tests use a fake and a real provider is a configuration step. Nothing here is exercised against
 * a live account yet: that needs an approved WhatsApp Business account / SMS provider contract (docs/backend.md, Phase 7 open items).
 *   WhatsApp Cloud API:  WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET (signature), WHATSAPP_VERIFY_TOKEN (handshake)
 *   SMS (generic HTTPS):  SMS_API_URL, SMS_API_KEY, SMS_SENDER, SMS_WEBHOOK_SECRET (signature)
 * Prices are never assumed: WHATSAPP_COST_PER_MESSAGE_USD and SMS_COST_PER_SEGMENT_USD are set by the operator from their contract.
 */
export type Channel = "whatsapp" | "sms";
export interface SendResult { ok: boolean; id?: string; error?: string }
export interface ChannelProvider { send(toE164: string, text: string): Promise<SendResult> }

const overrides: Partial<Record<Channel, ChannelProvider | null>> = {};
/** Tests only. Pass undefined to go back to the environment. */
export function setChannelProviderForTests(channel: Channel, p: ChannelProvider | null | undefined) { if (p === undefined) delete overrides[channel]; else overrides[channel] = p; }

export function channelProvider(channel: Channel): ChannelProvider | null {
  if (channel in overrides) return overrides[channel] ?? null;
  if (channel === "whatsapp") {
    const token = process.env.WHATSAPP_TOKEN, phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phone) return null;
    return { async send(to, text) {
      try {
        const res = await fetch(`${process.env.WHATSAPP_API_BASE || "https://graph.facebook.com/v20.0"}/${phone}/messages`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: text } }), signal: AbortSignal.timeout(10_000) });
        const j = (await res.json().catch(() => null)) as { messages?: { id: string }[] } | null;
        return res.ok ? { ok: true, id: j?.messages?.[0]?.id } : { ok: false, error: `http_${res.status}` };
      } catch (e) { return { ok: false, error: (e as Error)?.name ?? "error" }; }
    } };
  }
  const url = process.env.SMS_API_URL, key = process.env.SMS_API_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return { async send(to, text) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ to, text, sender: process.env.SMS_SENDER ?? undefined }), signal: AbortSignal.timeout(10_000) });
      return res.ok ? { ok: true } : { ok: false, error: `http_${res.status}` };
    } catch (e) { return { ok: false, error: (e as Error)?.name ?? "error" }; }
  } };
}

/** Cost of one outbound message, or null when the operator has not set a price (we never guess one). */
export function unitCostUsd(channel: Channel, parts: number): number | null {
  const raw = channel === "whatsapp" ? process.env.WHATSAPP_COST_PER_MESSAGE_USD : process.env.SMS_COST_PER_SEGMENT_USD;
  const n = Number(raw);
  if (raw === undefined || raw === "" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * (channel === "sms" ? parts : 1) * 1e6) / 1e6;
}
