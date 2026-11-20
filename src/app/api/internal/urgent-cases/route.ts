import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { serviceClient } from "@/lib/supabase/service";
import { alertText, clampHours, urgentCases } from "@/lib/urgent-cases";

// Read-only. Called by the n8n workflow (workflows/n8n/urgent-cases.json) with `Authorization: Bearer $CRON_SECRET`.
// GET ?hours=24 (1 to 168) &demo=1 (include sample cases). Returns { count, text, cases }.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ code: "unauthenticated", message: "Not allowed.", field_errors: {}, request_id: null }, { status: 401 });
  const sb = serviceClient();
  if (!sb) return NextResponse.json({ data: { count: 0, text: "", cases: [], note: "service role not configured" } });
  const u = new URL(req.url), hours = clampHours(u.searchParams.get("hours"));
  try {
    const cases = await urgentCases(sb, { hours, demo: u.searchParams.get("demo") === "1" });
    return NextResponse.json({ data: { count: cases.length, text: alertText(cases, hours), cases } }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "internal_error", message: "Could not read cases.", field_errors: {}, request_id: null }, { status: 500 });
  }
}
