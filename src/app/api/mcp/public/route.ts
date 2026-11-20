import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handlePublicRpc } from "@/lib/mcp-public";
import type { RpcReq } from "@/lib/mcp";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// Public MCP endpoint (Streamable HTTP, JSON responses, no sign-in). Reads only what a website visitor can read, as the anonymous role.
// The staff server with private tools is /api/mcp. Rate limited per IP; small bodies and small batches.
export async function POST(req: Request) {
  const ip = rateLimit(`mcp-public:ip:${clientIp(req)}`, 60, 60_000);
  if (!ip.ok) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32029, message: "Too many requests." } }, { status: 429, headers: { "retry-after": String(ip.retryAfterSec) } });
  const raw = await req.text();
  if (raw.length > 16 * 1024) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  const batch = Array.isArray(body) ? body : [body];
  if (batch.length > 5) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batch too large" } }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const out = (await Promise.all(batch.map((r) => handlePublicRpc(r as RpcReq, sb)))).filter((r) => r !== null);
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { "cache-control": "no-store" } });
}
// Server-initiated streams are not offered; clients that probe with GET are told so.
export async function GET() { return new NextResponse(null, { status: 405, headers: { allow: "POST" } }); }
