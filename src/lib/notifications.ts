import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { vapidConfigured } from "./notify/deliver";
import { PageQuery } from "./pagination";
import { decodeFeedCursor, encodeFeedCursor } from "./feed-cursor";

export const NOTIFICATION_TYPES = ["issue_status", "new_in_area", "question_reply", "question_message", "idea_decision", "announcement", "project_update"] as const;
const COLS = "id,type,title,body,data,ref,read_at,created_at";

export async function listNotifications(c: Ctx): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q); const f = parse(z.object({ unread: z.enum(["true", "false"]).optional() }), q);
  let sel = c.sb.from("notifications").select(COLS).eq("user_id", c.user!.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (f.unread === "true") sel = sel.is("read_at", null);
  if (cursor) { const k = decodeFeedCursor(cursor); sel = sel.or(`created_at.lt.${k.ts},and(created_at.eq.${k.ts},id.lt.${k.ref})`); }
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const { count } = await c.sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", c.user!.id).is("read_at", null);
  return { data: items.map(({ data: d, ...r }) => ({ ...r, en: (d as { en?: unknown } | null)?.en ?? null })),
    page: { next_cursor: rows.length > limit && last ? encodeFeedCursor(0, last.created_at, last.id) : null, limit }, headers: { "x-unread-count": String(count ?? 0) } };
}

export async function markRead(c: Ctx, all: boolean): Promise<Result> {
  let q = c.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", c.user!.id).is("read_at", null);
  if (!all) {
    if (!/^[0-9a-f-]{36}$/i.test(c.params.id)) throw new ApiError("not_found", "Notification not found.");
    q = q.eq("id", c.params.id);
  }
  const { data, error } = await q.select("id");
  if (error) throw fromDbError(error);
  if (!all && !data?.length) {
    const { data: exists } = await c.sb.from("notifications").select("id").eq("id", c.params.id).eq("user_id", c.user!.id).maybeSingle();
    if (!exists) throw new ApiError("not_found", "Notification not found.");
  }
  return { data: { marked: data?.length ?? 0 } };
}

const Hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const Prefs = z.strictObject({
  channels: z.strictObject({ in_app: z.literal(true).optional(), push: z.boolean().optional(), email: z.boolean().optional() }).optional(),
  muted_types: z.array(z.enum(NOTIFICATION_TYPES)).max(20).optional(),
  quiet_hours: z.strictObject({ start: Hhmm, end: Hhmm }).nullable().optional(),
  timezone: z.string().max(60).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "unknown time zone").optional(),
  personalization_enabled: z.boolean().optional(),
});
const prefOut = (r: Record<string, unknown> | null) => ({
  channels: r?.channels ?? { in_app: true, push: false, email: false }, muted_types: r?.muted_types ?? [], quiet_hours: r?.quiet_hours ?? null,
  timezone: r?.timezone ?? "Asia/Dhaka", personalization_enabled: r?.personalization_enabled ?? true,
});

export async function getPreferences(c: Ctx): Promise<Result> {
  const { data } = await c.sb.from("user_preferences").select("channels,muted_types,quiet_hours,timezone,personalization_enabled").eq("user_id", c.user!.id).maybeSingle();
  return { data: prefOut(data) };
}
export async function putPreferences(c: Ctx): Promise<Result> {
  const b = parse(Prefs, c.body);
  const { data: cur } = await c.sb.from("user_preferences").select("channels").eq("user_id", c.user!.id).maybeSingle();
  const patch: Record<string, unknown> = {};
  if (b.channels) patch.channels = { in_app: true, push: false, email: false, ...((cur?.channels as object) ?? {}), ...b.channels };
  if (b.muted_types) patch.muted_types = [...new Set(b.muted_types)];
  if (b.quiet_hours !== undefined) patch.quiet_hours = b.quiet_hours;
  if (b.timezone) patch.timezone = b.timezone;
  if (b.personalization_enabled !== undefined) patch.personalization_enabled = b.personalization_enabled;
  if (!cur) { const { error } = await c.sb.from("user_preferences").insert({ user_id: c.user!.id }); if (error && error.code !== "23505") throw fromDbError(error); }
  if (Object.keys(patch).length) { const { error } = await c.sb.from("user_preferences").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", c.user!.id); if (error) throw fromDbError(error); }
  return getPreferences(c);
}

const Sub = z.strictObject({ endpoint: z.url({ protocol: /^https$/ }).max(1000), keys: z.strictObject({ p256dh: z.string().max(200), auth: z.string().max(100) }).optional() });
export async function addPushSubscription(c: Ctx): Promise<Result> {
  const b = parse(Sub, c.body);
  if (!vapidConfigured()) throw new ApiError("unavailable", "Web Push is not configured on this server.");
  await rpc(c.sb, "save_push_subscription", { p_endpoint: b.endpoint, p_p256dh: b.keys?.p256dh ?? null, p_auth: b.keys?.auth ?? null });
  return { status: 201, data: { subscribed: true } };
}
export async function removePushSubscription(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ endpoint: z.url({ protocol: /^https$/ }).max(1000) }), c.body);
  await rpc(c.sb, "remove_push_subscription", { p_endpoint: b.endpoint });
  return { data: { subscribed: false } };
}
export const vapidKey = async (): Promise<Result> => ({ data: vapidConfigured() ? { available: true, public_key: process.env.VAPID_PUBLIC_KEY } : { available: false } });
