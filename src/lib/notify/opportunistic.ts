import { after } from "next/server";
import { deliverDue } from "./deliver";

/**
 * Free replacement for a per-minute scheduler. After a state-changing API request, queued push and email deliveries are
 * sent in the background (Next `after`), at most once every 60 seconds per server instance. Latency therefore follows
 * traffic; the daily cron (vercel.json) is the floor when nobody uses the site, and /api/internal/notifications/deliver
 * can still be called by any external scheduler. Never affects the response and never throws.
 */
let last = 0;
export function kickDeliveries(now = Date.now()): void {
  if (process.env.NODE_ENV === "test" || process.env.OPPORTUNISTIC_DELIVERY === "off") return;
  if (now - last < 60_000) return;
  last = now;
  try { after(async () => { await deliverDue(10).catch(() => null); }); } catch { /* outside a request scope */ }
}

/** For tests. */
export const resetKick = () => { last = 0; };
