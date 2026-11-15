import { NextResponse } from "next/server";
import { CaseInput } from "@/lib/types";
import { summarize } from "@/lib/intake";
import { createCase } from "@/lib/store";

export async function POST(req: Request) {
  const body = CaseInput.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(createCase(body.data, await summarize(body.data)), { status: 201 });
}
