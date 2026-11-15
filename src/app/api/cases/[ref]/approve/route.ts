import { NextResponse } from "next/server";
import { z } from "zod";
import { advance } from "@/lib/store";

// Human approval gate: AI never changes status by itself. TODO Sprint 1: require staff auth + audit event.
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[ref]/approve">) {
  const { ref } = await ctx.params;
  const body = z.object({ action: z.enum(["acknowledge", "refer"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const c = advance(ref, body.data.action === "refer" ? "referred" : "acknowledged");
  return c ? NextResponse.json(c) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
