import { NextResponse } from "next/server";
import { z } from "zod";
import { draftFromText } from "@/lib/intake";

export async function POST(req: Request) {
  const body = z.object({ text: z.string().min(3).max(3000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(await draftFromText(body.data.text));
}
