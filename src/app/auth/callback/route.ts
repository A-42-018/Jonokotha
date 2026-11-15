import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Email sign-in link lands here with ?code=...; exchange it for a session cookie.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/report", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
