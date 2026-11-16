import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Magic-link landing: exchanges the one-time code for a session cookie, then sends the user to the report page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/report", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
