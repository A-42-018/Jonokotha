import { NextResponse } from "next/server";
import { z } from "zod";
import { advance } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import { limited, readJson } from "@/lib/http";

// Human approval gate: only staff (enforced by RLS and checked here) can change status.
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[ref]/approve">) {
  const { ref } = await ctx.params;
  const { sb, user, isStaff } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const tooMany = limited(req, "approve", user.id, 60);
  if (tooMany) return tooMany;
  const raw = await readJson(req, 1024);
  if (!raw.ok) return raw.res;
  const body = z.object({ action: z.enum(["acknowledge", "refer"]) }).safeParse(raw.data);
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const ok = await advance(sb, ref, body.data.action === "refer" ? "referred" : "acknowledged");
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
