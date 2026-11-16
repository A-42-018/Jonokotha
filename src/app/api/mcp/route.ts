import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleRpc, type RpcReq } from "@/lib/mcp";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const unauth = () => NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Send your staff access token as a Bearer token." } }, { status: 401, headers: { "www-authenticate": "Bearer" } });

// MCP endpoint (Streamable HTTP, JSON responses). Auth: Authorization: Bearer <staff Supabase access token>. Row-level security applies as that user.
export async function POST(req: Request) {
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return unauth();
  const ip = rateLimit(`mcp:ip:${clientIp(req)}`, 120, 60_000);
  if (!ip.ok) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32029, message: "Too many requests." } }, { status: 429, headers: { "retry-after": String(ip.retryAfterSec) } });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return unauth();
  const { data: p } = await sb.from("profiles").select("role,account_status").eq("id", data.user.id).maybeSingle();
  if (!p || p.account_status !== "active" || !["staff", "admin"].includes(p.role)) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32003, message: "Staff access only." } }, { status: 403 });
  const { allowed } = ((await sb.rpc("consume_rate_limit", { p_scope: "mcp", p_limit: 60, p_window_seconds: 60 })).data ?? { allowed: true }) as { allowed: boolean };
  if (!allowed) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32029, message: "Too many requests." } }, { status: 429 });
  const raw = await req.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  const batch = Array.isArray(body) ? body : [body];
  if (batch.length > 10) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batch too large" } }, { status: 400 });
  const out = (await Promise.all(batch.map((r) => handleRpc(r as RpcReq, sb, { id: data.user!.id })))).filter((r) => r !== null);
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0]);
}
// Server-initiated streams are not offered; clients that probe with GET are told so.
export async function GET() { return new NextResponse(null, { status: 405, headers: { allow: "POST" } }); }
