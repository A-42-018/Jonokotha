import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDueSources } from "@/lib/ingest/run";
import { serviceClient } from "@/lib/supabase/service";

// Scheduled job (daily): refresh every enabled, licence-checked source whose interval is due (robots.txt and rate limits obeyed),
// then mark helplines past their review date as stale. Authorization: Bearer $CRON_SECRET.
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ code: "unauthenticated", message: "Not allowed.", field_errors: {}, request_id: null }, { status: 401 });
  const sb = serviceClient();
  if (!sb) return NextResponse.json({ data: { note: "service role not configured" } });
  const runs = await runDueSources(sb);
  const { data: maint } = await sb.rpc("ops_pilot_maintenance");
  return NextResponse.json({ data: { runs, maintenance: maint } }, { status: runs.some((r) => r.status === "error") ? 207 : 200 });
}
export const GET = POST;
