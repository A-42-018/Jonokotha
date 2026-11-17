import { api } from "@/lib/api-client";

/** Client side of Web Push (F.10). The server sends a push with no payload; public/sw.js wakes, asks for the news count and shows a generic alert. */

export interface Prefs { channels: { in_app: true; push: boolean; email: boolean; sms?: boolean; whatsapp?: boolean }; muted_types: string[]; quiet_hours: { start: string; end: string } | null; timezone: string; personalization_enabled: boolean }
export type PushSupport = "ok" | "unsupported";

export function pushSupport(env: { window?: Window & typeof globalThis } = { window: typeof window === "undefined" ? undefined : window }): PushSupport {
  const w = env.window;
  return w && "serviceWorker" in w.navigator && "PushManager" in w && "Notification" in w ? "ok" : "unsupported";
}

/** The VAPID public key is URL-safe base64; the browser wants bytes. */
export function keyToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Quiet hours must be two valid, different times (they may cross midnight). Returns an error key or null. */
export function quietError(start: string, end: string): "pushQuietBad" | null {
  return HHMM.test(start) && HHMM.test(end) && start !== end ? null : "pushQuietBad";
}

export const fetchPrefs = async () => (await api<Prefs>("/me/notification-preferences")).data;
export const savePrefs = async (patch: Partial<Pick<Prefs, "quiet_hours" | "timezone" | "muted_types" | "personalization_enabled">> & { channels?: { push?: boolean; sms?: boolean; whatsapp?: boolean } }) =>
  (await api<Prefs>("/me/notification-preferences", { method: "PUT", body: patch })).data;

export type EnableResult = "on" | "denied" | "unavailable" | "unsupported";

async function registration() {
  return navigator.serviceWorker.getRegistration().then((r) => r ?? navigator.serviceWorker.ready);
}

/** This device's current subscription, or null. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  try { return await (await registration()).pushManager.getSubscription(); } catch { return null; }
}

/** Asks for permission (only called from a button), subscribes this device and tells the server. */
export async function enablePush(): Promise<EnableResult> {
  if (pushSupport() !== "ok") return "unsupported";
  const key = (await api<{ available: boolean; public_key?: string }>("/notifications/vapid-key")).data;
  if (!key.available || !key.public_key) return "unavailable";
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key.public_key) }));
  const j = sub.toJSON();
  await api("/me/push-subscriptions", { method: "POST", body: { endpoint: sub.endpoint, ...(j.keys?.p256dh && j.keys.auth ? { keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } } : {}) } });
  await savePrefs({ channels: { push: true } });
  return "on";
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (sub) {
    await api("/me/push-subscriptions", { method: "DELETE", body: { endpoint: sub.endpoint } });
    await sub.unsubscribe().catch(() => false);
  }
  await savePrefs({ channels: { push: false } });
}
