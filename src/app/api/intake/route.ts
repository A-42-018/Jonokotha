import { NextResponse } from "next/server";
import { z } from "zod";
import { draftFromText } from "@/lib/intake";
import { limited, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const tooMany = limited(req, "intake", null, 10);
  if (tooMany) return tooMany;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const body = z.object({ text: z.string().min(3).max(3000) }).safeParse(raw.data);
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(await draftFromText(body.data.text));
}
