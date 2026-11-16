import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { healthAlerts, sendAlert, type Health } from "@/lib/monitor";
import { serviceClient } from "@/lib/supabase/service";

// Scheduled job (daily is enough; Vercel Cron sends the CRON_SECRET header): retention sweep, account erasure after the
// grace period, storage cleanup for erased photos, and a health check that alerts through ALERT_WEBHOOK_URL.
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ code: "unauthenticated", message: "Not allowed.", field_errors: {}, request_id: null }, { status: 401 });
  const sb = serviceClient();
  if (!sb) return NextResponse.json({ data: { note: "service role not configured" } });
  const { data: ret, error } = await sb.rpc("run_retention");
  const paths: string[] = ((ret as { storage_paths?: string[] } | null)?.storage_paths) ?? [];
  let removed = 0;
  if (paths.length) { const r = await sb.storage.from("issue-media").remove(paths); removed = r.data?.length ?? 0; }
  const { data: health } = await sb.rpc("ops_health");
  const alerts = health ? healthAlerts(health as Health) : [];
  if (error) alerts.push("retention sweep failed");
  const alerted = await sendAlert(alerts);
  const { storage_paths: _omit, ...summary } = (ret ?? {}) as Record<string, unknown>;
  void _omit;
  return NextResponse.json({ data: { retention: summary, photos_removed: removed, health, alerts, alerted } }, { status: error ? 500 : 200 });
}
export const GET = POST;
