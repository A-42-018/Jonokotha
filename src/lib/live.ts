import { featureStatus } from "@/lib/capability";

/** Own unread count: GET /me/notifications?unread=true&limit=1, header `x-unread-count` (docs/api-v1.md). Null when signed out or the call fails. */
export async function fetchUnreadCount(doFetch: typeof fetch = fetch): Promise<number | null> {
  try {
    const r = await doFetch("/api/v1/me/notifications?unread=true&limit=1");
    if (!r.ok) return null;
    const n = Number(r.headers.get("x-unread-count"));
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch { return null; }
}

/** The bell polls this often while the tab is visible, until Realtime (B5.8) is switched on. */
export const POLL_MS = 60_000;

/** Realtime is used only when the server has switched it on (B5.8). Until then the count is polled. */
export const realtimeOn = () => featureStatus("realtime") !== "planned";

export interface RealtimeChannelLike { on: (type: "postgres_changes", filter: Record<string, string>, cb: () => void) => RealtimeChannelLike; subscribe: (cb?: (status: string) => void) => RealtimeChannelLike }
export interface RealtimeClientLike { channel: (name: string) => RealtimeChannelLike; removeChannel: (c: RealtimeChannelLike) => unknown }

/**
 * Listens to the signed-in person's own notification rows only (filter `user_id=eq.<id>`; RLS also limits the rows to them).
 * Any insert or update calls `onChange`; the caller then re-reads the count, so the event itself carries no content.
 * `onStatus(false)` is called when the channel is not connected, so the caller can fall back to polling. Returns an unsubscribe.
 */
export function listenOwnNotices(client: RealtimeClientLike, userId: string, onChange: () => void, onStatus: (live: boolean) => void): () => void {
  const ch = client.channel(`own-notices-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, onChange)
    .subscribe((s) => onStatus(s === "SUBSCRIBED"));
  return () => { void client.removeChannel(ch); };
}
