import { api } from "@/lib/api-client";
import { normalizeDigits } from "@/lib/digits";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";
import { savePrefs } from "@/lib/push";

/** WhatsApp and SMS (B7.2, B7.4). Contract: docs/api-v1.md "Messaging channels" (branch claude/backend-phase7). A phone number is linked from the app first. */
export type ChannelKind = "whatsapp" | "sms";
export interface ChannelLink { id: string; channel: ChannelKind; address_hint: string; status: "pending" | "active" | "revoked"; code_expires_at: string | null; updates_enabled: boolean; created_at: string; verified_at: string | null }
export interface LinkStarted { code: string; send_to: string | null; instructions?: string }
const q = encodeURIComponent;

export const fetchChannels = (): Promise<OrPlanned<ChannelLink[]>> => readOrPlanned<ChannelLink[]>("/me/channels").then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const startLink = (channel: ChannelKind, address: string, key: string) =>
  api<LinkStarted>("/me/channels", { body: { channel, address, accept_privacy: true }, idempotencyKey: key }).then((r) => r.data);
export const removeLink = (id: string) => api<unknown>(`/me/channels/${q(id)}`, { method: "DELETE" });
/** Updates need two switches on the server: the link's own and the notification preference for that channel. They move together. */
export async function setUpdates(link: ChannelLink, on: boolean) {
  await api<unknown>(`/me/channels/${q(link.id)}`, { method: "PATCH", body: { updates_enabled: on } });
  await savePrefs({ channels: { [link.channel]: on } });
}

/** A phone number as typed: either digit set, spaces, dashes and brackets removed, a leading + kept. Bangladesh numbers: +8801XXXXXXXXX. */
export function cleanPhone(s: string): string {
  const d = normalizeDigits(s).replace(/[^\d+]/g, "");
  return d.startsWith("+") ? `+${d.slice(1).replace(/\+/g, "")}` : d.replace(/\+/g, "");
}
/** 01XXXXXXXXX and 8801XXXXXXXXX become +8801XXXXXXXXX. Anything else is left as typed for the server to judge. */
export function toE164(s: string): string {
  const p = cleanPhone(s);
  if (/^01\d{9}$/.test(p)) return `+88${p}`;
  if (/^8801\d{9}$/.test(p)) return `+${p}`;
  return p;
}
export const phoneOk = (s: string) => /^\+\d{8,15}$/.test(toE164(s));

/** The platform's own numbers, from the environment. Nothing is invented: when unset the screen says no number is published. */
export const platformNumbers = () => ({ whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "", sms: process.env.NEXT_PUBLIC_SMS_NUMBER ?? "" });
export const waLink = (number: string, text?: string): string | null => {
  const d = normalizeDigits(number).replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
};
/** Short code or number as shown to people; only digits, plus and spaces are allowed so nothing odd is rendered. */
export const showNumber = (n: string) => (/^[+\d][\d\s-]{2,18}$/.test(n.trim()) ? n.trim() : "");

// Area alerts (B7.4) ---------------------------------------------------------------------------------------------------------------------------------
export interface AreaAlert { id?: string; title_bn: string; title_en?: string | null; body?: string | null; created_at: string }
export const fetchAreaAlerts = (constituency: string): Promise<OrPlanned<AreaAlert[]>> => readOrPlanned<AreaAlert[]>(`/area-alerts?${new URLSearchParams({ constituency })}`).then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const sendAreaAlert = (b: { constituency: string; title_bn: string; title_en?: string; body?: string }, key: string) => api<unknown>("/office/area-alerts", { body: b, idempotencyKey: key });
