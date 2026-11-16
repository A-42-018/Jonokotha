import { NextResponse } from "next/server";
import { DEMO_EMAILS, demoEnabled, demoLanding, parseDemoRole } from "@/lib/demo";
import { limited } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

// One-click demo sign-in (dev period). POST form field `role` = citizen | staff.
export async function POST(req: Request) {
  if (!demoEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tooMany = limited(req, "demo-login", null, 20);
  if (tooMany) return tooMany;
  const role = parseDemoRole((await req.formData().catch(() => null))?.get("role"));
  if (!role) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { error } = await (await supabaseServer()).auth.signInWithPassword({ email: DEMO_EMAILS[role], password: process.env.DEMO_PASSWORD! });
  const to = error ? "/login?error=demo" : demoLanding(role);
  return NextResponse.redirect(new URL(to, req.url), 303);
}
