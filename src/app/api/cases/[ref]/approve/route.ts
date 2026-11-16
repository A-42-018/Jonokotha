import { NextResponse } from "next/server";
import { z } from "zod";
import { advance } from "@/lib/store";
import { can } from "@/lib/auth";
import { currentUser } from "@/lib/supabase/server";
import { limited, readJson } from "@/lib/http";

// Human approval gate: only staff (enforced by RLS and checked here) can change status.
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[ref]/approve">) {
  const { ref } = await ctx.params;
  const { sb, user, isStaff, actor } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const tooMany = limited(req, "approve", user.id, 60);
  if (tooMany) return tooMany;
  const raw = await readJson(req, 1024);
  if (!raw.ok) return raw.res;
  const body = z.object({ action: z.enum(["acknowledge", "refer"]) }).safeParse(raw.data);
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // Office scope: the actor needs the permission for this issue's constituency (and assignment, for case officers).
  const { data: issue } = await sb.from("issues").select("constituency_id,assigned_to").eq("ref", ref).maybeSingle();
  if (!issue) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const action = body.data.action === "refer" ? "forward" : "acknowledge";
  if (!can(actor, action, { constituencyId: issue.constituency_id, assignedTo: issue.assigned_to })) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const r = await advance(sb, ref, body.data.action === "refer" ? "referred" : "acknowledged");
  if (r.ok) return NextResponse.json({ ok: true });
  // The state machine (database) decides; map its refusals to HTTP.
  const status = { not_found: 404, forbidden: 403, invalid_transition: 409, rule_not_met: 409, missing_field: 422, error: 500 }[r.code];
  return NextResponse.json({ error: r.code, ...(r.field ? { field: r.field } : {}) }, { status });
}
