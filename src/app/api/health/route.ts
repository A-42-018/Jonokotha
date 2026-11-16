import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public uptime check: 200 when the app can reach the database, 503 otherwise. Reveals nothing but ok/not ok.
export const dynamic = "force-dynamic";
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let ok = false;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from("agencies").select("id", { head: true }).limit(1);
    ok = !error;
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
