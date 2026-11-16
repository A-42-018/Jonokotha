/**
 * Monitoring hooks (backend plan 3.4). Without keys they do nothing, so nothing breaks locally.
 *  - SENTRY_DSN: unexpected server errors are sent to Sentry (envelope API, no SDK dependency). Only the error class,
 *    a trimmed message, the route and the request id are sent; never bodies, headers, cookies or user data.
 *  - ALERT_WEBHOOK_URL: a JSON `{ text }` POST (Slack/Discord/Teams-compatible) for threshold alerts from the maintenance job.
 */
export function parseDsn(dsn: string | undefined): { url: string; key: string } | null {
  try {
    if (!dsn) return null;
    const u = new URL(dsn), project = u.pathname.replace(/^\//, "");
    return u.username && project ? { url: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username } : null;
  } catch { return null; }
}

export async function captureError(e: unknown, ctx: { route: string; request_id: string }): Promise<void> {
  const d = parseDsn(process.env.SENTRY_DSN);
  if (!d) return;
  const err = e as Error;
  const id = crypto.randomUUID().replace(/-/g, "");
  const event = { event_id: id, timestamp: Date.now() / 1000, platform: "node", level: "error", environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA, tags: { route: ctx.route, request_id: ctx.request_id },
    exception: { values: [{ type: err?.name ?? "Error", value: String(err?.message ?? e).slice(0, 200) }] } };
  const body = `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  await fetch(d.url, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.key}, sentry_client=jonokotha/1` }, body, signal: AbortSignal.timeout(3000) }).catch(() => null);
}

export interface Health { deliveries_pending: number; deliveries_dead: number; ai_runs_24h: number; ai_errors_24h: number }
/** Alerts worth a human's attention: stuck or dead deliveries, or an AI error rate above 30% once there are 10+ runs. */
export function healthAlerts(h: Health): string[] {
  const out: string[] = [];
  if (h.deliveries_pending > 50) out.push(`${h.deliveries_pending} notification deliveries are overdue`);
  if (h.deliveries_dead > 0) out.push(`${h.deliveries_dead} notification deliveries went to the dead-letter state in 24h`);
  if (h.ai_runs_24h >= 10 && h.ai_errors_24h / h.ai_runs_24h > 0.3) out.push(`AI error rate ${Math.round((h.ai_errors_24h / h.ai_runs_24h) * 100)}% over ${h.ai_runs_24h} runs in 24h`);
  return out;
}

export async function sendAlert(lines: string[]): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !lines.length) return false;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `Jonokotha alert:\n- ${lines.join("\n- ")}` }), signal: AbortSignal.timeout(5000) }).catch(() => null);
  return !!r?.ok;
}
