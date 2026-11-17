import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEssential } from "./templates";

/** Signed unsubscribe links for non-essential notification types (B5.9). No login needed; the signature proves the link came from us. */
const secret = () => process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? "";
export const unsubscribeConfigured = () => secret().length >= 16;

export function unsubscribeToken(userId: string, type: string): string {
  return createHmac("sha256", secret()).update(`unsub:${userId}:${type}`).digest("base64url").slice(0, 43);
}
export function verifyUnsubscribe(userId: string, type: string, token: string): boolean {
  if (!unsubscribeConfigured() || isEssential(type)) return false;
  const want = Buffer.from(unsubscribeToken(userId, type)), got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
export function unsubscribeUrl(appUrl: string, userId: string, type: string): string | undefined {
  return unsubscribeConfigured() && !isEssential(type) ? `${appUrl}/api/v1/notifications/unsubscribe?u=${userId}&type=${encodeURIComponent(type)}&t=${unsubscribeToken(userId, type)}` : undefined;
}

/** Adds the type to the person's muted list (service role: the person is not signed in). */
export async function muteType(svc: SupabaseClient, userId: string, type: string): Promise<void> {
  const { data } = await svc.from("user_preferences").select("muted_types").eq("user_id", userId).maybeSingle();
  const muted = Array.from(new Set([...(data?.muted_types ?? []), type]));
  if (data) await svc.from("user_preferences").update({ muted_types: muted }).eq("user_id", userId);
  else await svc.from("user_preferences").insert({ user_id: userId, muted_types: muted });
}
