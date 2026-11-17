import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runJobs } from "@/lib/jobs";
import { serviceClient } from "@/lib/supabase/service";

// Scheduled worker (Bearer CRON_SECRET): enqueues the periodic jobs, claims due jobs and runs them. Failures retry with backoff, then dead-letter.
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ code: "unauthenticated", message: "Not allowed.", field_errors: {}, request_id: null }, { status: 401 });
  const sb = serviceClient();
  if (!sb) return NextResponse.json({ data: { note: "service role not configured" } });
  try { return NextResponse.json({ data: await runJobs(sb, 10, "cron") }); }
  catch { return NextResponse.json({ code: "internal_error", message: "The job runner failed.", field_errors: {}, request_id: null }, { status: 500 }); }
}
export const GET = POST;
