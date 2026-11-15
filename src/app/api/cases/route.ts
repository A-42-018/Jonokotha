import { NextResponse } from "next/server";
import { CaseInput } from "@/lib/types";
import { summarize } from "@/lib/intake";
import { createCase } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = CaseInput.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const ref = await createCase(sb, user.id, body.data, await summarize(body.data));
    return NextResponse.json({ ref }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
