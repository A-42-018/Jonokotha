import { NextResponse } from "next/server";
import { CaseInput } from "@/lib/types";
import { summarize } from "@/lib/intake";
import { createCase } from "@/lib/store";
import { currentUser } from "@/lib/supabase/server";
import { limited, readJson } from "@/lib/http";
import { redactPii } from "@/lib/pii";

export async function POST(req: Request) {
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const tooMany = limited(req, "cases", user.id, 5);
  if (tooMany) return tooMany;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const body = CaseInput.safeParse(raw.data);
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // Reports are public, so personal data is removed before storing as well.
  const clean = { ...body.data, title: redactPii(body.data.title).text, description: redactPii(body.data.description).text, area: redactPii(body.data.area).text };
  try {
    const ref = await createCase(sb, user.id, clean, await summarize(clean));
    return NextResponse.json({ ref }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
