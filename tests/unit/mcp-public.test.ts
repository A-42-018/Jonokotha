import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlePublicRpc, publicTools } from "@/lib/mcp-public";
import { resetRateLimits } from "@/lib/rate-limit";

type Call = [string, ...unknown[]];
function fakeSb(rows: Record<string, unknown>) {
  const calls: Call[] = [];
  const rpc = vi.fn();
  const from = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "contains", "or", "order", "limit"]) q[m] = (...a: unknown[]) => { calls.push([`${table}.${m}`, ...a]); return q; };
    q.maybeSingle = async () => ({ data: (rows[table] as unknown[] | undefined)?.[0] ?? null });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(res);
    return q;
  };
  return { sb: { from, rpc } as never, calls, rpc };
}
const call = (sb: never, name: string, args: unknown = {}) => handlePublicRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, sb) as Promise<{ result: { isError: boolean; content: { text: string }[] } }>;

describe("public MCP server", () => {
  it("identifies itself as the public server and lists five read-only tools", async () => {
    const { sb } = fakeSb({});
    const init = (await handlePublicRpc({ jsonrpc: "2.0", id: 1, method: "initialize" }, sb)) as { result: { serverInfo: { name: string }; instructions: string } };
    expect(init.result.serverInfo.name).toBe("jonokotha-public");
    expect(init.result.instructions).toMatch(/999/);
    const list = (await handlePublicRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, sb)) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
    expect(list.result.tools.map((t) => t.name)).toEqual(["list_categories", "agency_directory", "helplines", "search_public_cases", "public_case_status"]);
    expect(list.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
  });

  it("has no write tool and selects no AI, reporter or staff column from the public views", () => {
    expect(publicTools.some((t) => t.write)).toBe(false);
    const src = publicTools.map((t) => t.run.toString()).join("\n");
    expect(src).not.toMatch(/ai_summary|ai_agency|ai_confidence|ai_similar|reporter|assigned_to|internal_note|public_lat|service/);
  });

  it("answers a tool call without auditing or touching rpc (there is no caller to audit)", async () => {
    const { sb, rpc } = fakeSb({ issue_categories: [{ slug: "roads", name_bn: "রাস্তা", name_en: "Roads" }] });
    const r = await call(sb, "list_categories");
    expect(r.result.isError).toBe(false);
    expect(JSON.parse(r.result.content[0].text)).toEqual([{ slug: "roads", name_bn: "রাস্তা", name_en: "Roads" }]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("searches public cases with the words cleaned and a limit", async () => {
    const { sb, calls } = fakeSb({ public_cases: [] });
    await call(sb, "search_public_cases", { query: "a,b%c(d)", category: "roads", limit: 5 });
    expect(calls).toContainEqual(["public_cases.eq", "category", "roads"]);
    expect(calls).toContainEqual(["public_cases.limit", 5]);
    const or = calls.find((c) => c[0] === "public_cases.or")![1] as string;
    expect(or).not.toMatch(/[%(),]c|\(d\)/);
    expect(or).toContain("title.ilike.%a b c d%");
  });

  it("returns a case with its public timeline, or null for an unknown reference", async () => {
    const found = fakeSb({ public_cases: [{ ref: "JK-2026-1005", title: "T", status: "received" }], public_case_events: [{ status: "received", note: "ok", created_at: "x" }] });
    const r = await call(found.sb, "public_case_status", { ref: "JK-2026-1005" });
    expect(JSON.parse(r.result.content[0].text)).toMatchObject({ ref: "JK-2026-1005", timeline: [{ status: "received" }] });
    expect(found.calls).toContainEqual(["public_case_events.eq", "case_ref", "JK-2026-1005"]);
    const none = await call(fakeSb({}).sb, "public_case_status", { ref: "JK-2026-9999" });
    expect(none.result.content[0].text).toBe("null");
  });

  it("rejects bad arguments, unknown tools and unknown methods", async () => {
    const { sb } = fakeSb({});
    expect((await call(sb, "public_case_status", { ref: "x" })).result.isError).toBe(true);
    expect((await call(sb, "search_public_cases", { limit: 500 })).result.isError).toBe(true);
    expect((await call(sb, "agency_directory", { evil: 1 })).result.isError).toBe(true);
    expect(await call(sb, "propose_note", { ref: "JK-1", note: "x" })).toMatchObject({ error: { code: -32602 } });
    expect(await handlePublicRpc({ jsonrpc: "2.0", id: 3, method: "nope" }, sb)).toMatchObject({ error: { code: -32601 } });
    expect(await handlePublicRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, sb)).toBeNull();
  });
});

describe("POST /api/mcp/public", () => {
  beforeEach(() => { resetRateLimits(); vi.resetModules(); process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"; });
  const req = (body: string) => new Request("http://x/api/mcp/public", { method: "POST", body, headers: { "x-forwarded-for": "9.9.9.9" } });

  it("needs no token and answers initialize", async () => {
    const { POST } = await import("@/app/api/mcp/public/route");
    const r = await POST(req(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })));
    expect(r.status).toBe(200);
    expect((await r.json()).result.serverInfo.name).toBe("jonokotha-public");
  });
  it("refuses bad JSON, big bodies and big batches", async () => {
    const { POST } = await import("@/app/api/mcp/public/route");
    expect((await POST(req("{nope"))).status).toBe(400);
    expect((await POST(req("x".repeat(17 * 1024)))).status).toBe(413);
    expect((await POST(req(JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "ping" })))))).status).toBe(400);
  });
  it("answers 429 after 60 calls a minute from one address, and 405 on GET", async () => {
    const { POST, GET } = await import("@/app/api/mcp/public/route");
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await POST(req(JSON.stringify({ jsonrpc: "2.0", id: i, method: "ping" })))).status;
    expect(last).toBe(429);
    expect((await GET()).status).toBe(405);
  });
});
