import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const jar = await cookies();
  const next = jar.get("lang")?.value === "en" ? "bn" : "en";
  jar.set("lang", next, { path: "/", maxAge: 31536000 });
  const back = req.headers.get("referer") ?? new URL("/", req.url).toString();
  return NextResponse.redirect(back);
}
