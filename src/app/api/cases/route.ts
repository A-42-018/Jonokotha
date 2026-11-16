import { NextResponse } from "next/server";
import { CaseInput } from "@/lib/types";
import { submitIssue } from "@/lib/issues-service";
import { currentUser } from "@/lib/supabase/server";
import { limited, readJson } from "@/lib/http";

// Legacy alias of POST /api/v1/issues, kept for the current frontend (docs/WORK_SPLIT.md contract): same service,
// old request and response shapes (`{ref}` / `{error}`), no Idempotency-Key. Remove after the frontend moves to /api/v1.
export async function POST(req: Request) {
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const tooMany = limited(req, "cases", user.id, 5);
  if (tooMany) return tooMany;
  const raw = await readJson(req);
  if (!raw.ok) return raw.res;
  const body = CaseInput.safeParse(raw.data);
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    return NextResponse.json({ ref: await submitIssue(sb, user.id, body.data) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
