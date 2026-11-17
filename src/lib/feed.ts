import { z } from "zod";
import { parse, rpc, type Ctx, type Result } from "./api";
import { decodeFeedCursor, encodeFeedCursor } from "./feed-cursor";
import { PageQuery } from "./pagination";

/** GET /me/feed. Ordered by what the user explicitly follows, then recency; `personalized=false` gives plain newest-first. Never by popularity. */
export async function feed(c: Ctx): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q);
  const { personalized } = parse(z.object({ personalized: z.enum(["true", "false"]).default("true") }), q);
  const k = cursor ? decodeFeedCursor(cursor) : null;
  const rows = await rpc<{ ref: string; tier: number; why: string | null; created_at: string }[]>(c.sb, "me_feed", {
    p_personalized: personalized === "true", p_limit: limit + 1, p_after_tier: k?.tier ?? null, p_after_ts: k?.ts ?? null, p_after_ref: k?.ref ?? null });
  const page = rows.slice(0, limit), last = page[page.length - 1];
  const { data: items } = page.length ? await c.sb.from("public_cases").select("ref,title,category,description,area,status_detail,created_at,ai_summary,constituency_key,is_demo,public_lat,public_lng").in("ref", page.map((r) => r.ref)) : { data: [] };
  const byRef = new Map((items ?? []).map((i) => [i.ref, i]));
  // simple_language_mode (B5.11): the plain summary replaces the long description, so the feed is short to read and to listen to.
  const { data: pref } = await c.sb.from("user_preferences").select("simple_language_mode,voice_first").eq("user_id", c.user!.id).maybeSingle();
  const simple = pref?.simple_language_mode ?? false;
  return {
    data: page.flatMap((r) => { const i = byRef.get(r.ref); return i ? [{ ref: i.ref, title: i.title, category: i.category, description: simple && i.ai_summary ? i.ai_summary : i.description, area: i.area ?? "", status: i.status_detail, created_at: i.created_at, summary: i.ai_summary || null,
      constituency: i.constituency_key, is_sample: i.is_demo, location: i.public_lat != null ? { lat: i.public_lat, lng: i.public_lng, approximate: true } : null, why: r.why }] : []; }),
    page: { next_cursor: rows.length > limit && last ? encodeFeedCursor(last.tier, last.created_at, last.ref) : null, limit },
    headers: { "x-simple-language": simple ? "1" : "0", "x-voice-first": pref?.voice_first ? "1" : "0" },
  };
}
