import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverDue } from "@/lib/notify/deliver";

// POST with Authorization: Bearer $CRON_SECRET (a scheduled job, e.g. Vercel Cron every minute). Sends due push/email deliveries.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET, given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok = !!secret && secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ code: "unauthenticated", message: "Not allowed.", field_errors: {}, request_id: null }, { status: 401 });
  const r = await deliverDue(25);
  return NextResponse.json({ data: r ?? { claimed: 0, sent: 0, failed: 0, skipped: 0, note: "service role not configured" } });
}
export const GET = POST;
