import { NextResponse, type NextRequest } from "next/server";
import { normaliseRef } from "@/lib/issue-ref";

/** GET /issue/find?ref=… (the home track box, a plain form with no JavaScript): open the issue, or go back with an error. */
export function GET(req: NextRequest) {
  const ref = normaliseRef(req.nextUrl.searchParams.get("ref") ?? "");
  return NextResponse.redirect(new URL(ref ? `/issue/${ref}` : "/?track=invalid#track", req.url), 303);
}
