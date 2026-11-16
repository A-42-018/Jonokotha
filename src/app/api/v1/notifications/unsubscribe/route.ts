import { NextResponse } from "next/server";
import { z } from "zod";
import { muteType, unsubscribeConfigured, verifyUnsubscribe } from "@/lib/notify/unsubscribe";
import { serviceClient } from "@/lib/supabase/service";

// Signed one-click unsubscribe for NON-essential notification types (linked from emails). GET and POST (RFC 8058) both mute the type for that person.
// Essential types (status of your own report, replies, appeals, approvals, tasks) cannot be unsubscribed. Reveals nothing about whether the account exists.
const Q = z.object({ u: z.uuid(), type: z.string().regex(/^[a-z_]{2,40}$/), t: z.string().min(20).max(64) });
async function handle(req: Request) {
  const q = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  const ok = q.success && unsubscribeConfigured() && verifyUnsubscribe(q.data.u, q.data.type, q.data.t);
  if (!ok) return NextResponse.json({ code: "forbidden", message: "This link is not valid.", field_errors: {}, request_id: null }, { status: 403 });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ code: "unavailable", message: "Try again later.", field_errors: {}, request_id: null }, { status: 503 });
  await muteType(svc, q.data.u, q.data.type);
  return NextResponse.json({ data: { unsubscribed: q.data.type }, message_bn: "আপনি এই ধরনের বার্তা আর পাবেন না।", message_en: "You will no longer receive this kind of message." });
}
export const GET = handle;
export const POST = handle;
