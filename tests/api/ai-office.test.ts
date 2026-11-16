import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as copilot } from "../../src/app/api/v1/office/issues/[ref]/copilot/route";
import { POST as routing } from "../../src/app/api/v1/office/issues/[ref]/routing/route";
import { POST as decide } from "../../src/app/api/v1/ai/suggestions/[id]/decision/route";
import { GET as analytics } from "../../src/app/api/v1/office/analytics/route";
import { GET as listReports, POST as newReport } from "../../src/app/api/v1/office/analytics/reports/route";
import { POST as approveReport } from "../../src/app/api/v1/office/analytics/reports/[id]/approve/route";
import { POST as withdrawReport } from "../../src/app/api/v1/office/analytics/reports/[id]/withdraw/route";
import { GET as publicReports } from "../../src/app/api/v1/analytics/reports/route";
import { POST as mcp } from "../../src/app/api/mcp/route";
import { ingestKnowledge } from "../../src/lib/ai/knowledge";
import { narrativeIsGrounded } from "../../src/lib/analytics";
import { serviceClient } from "../../src/lib/supabase/service";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

const fakeModel = vi.hoisted(() => ({ next: null as null | ((req: { tools: { name: string }[]; messages: { content: string }[] }) => Record<string, unknown> | "garbage"), calls: 0 }));
vi.mock("@/lib/anthropic", () => ({
  anthropic: () => ({ messages: { create: async (req: { tools: { name: string }[]; messages: { content: string }[] }) => {
    fakeModel.calls++;
    const out = fakeModel.next?.(req);
    if (!out) throw new Error("no model");
    return { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 }, content: out === "garbage" ? [{ type: "text", text: "hi" }] : [{ type: "tool_use", name: req.tools[0].name, input: out }] };
  } } }),
}));

let A: { id: string; key: string }, B: { id: string; key: string };
let citizen: TestUser, outsider: TestUser, manager: TestUser, officer: TestUser, mp: TestUser, managerB: TestUser;
const agencyKey = `test-agency-${Date.now().toString(36)}`;
let seq = 0;
const mkIssue = async (o: Record<string, unknown> = {}) => (await admin.from("issues").insert({ reporter_id: citizen.id, title: "Pothole near the market", category: "roads", description: "A deep pothole on the main road near the market.", area: "Market road", constituency_id: A.id, is_demo: true, ...o }).select("id,ref").single().throwOnError()).data!;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  A = await makeConstituency(); B = await makeConstituency();
  citizen = await makeUser("citizen"); outsider = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
  await admin.from("agencies").insert({ key: agencyKey, name_bn: "পরীক্ষা সড়ক বিভাগ", name_en: "Test Roads Department", categories: ["roads"], source: "Test directory", url: "https://example.test/roads", checked_at: "2026-11-01" }).throwOnError();
});
afterAll(async () => {
  as(null); fakeModel.next = null;
  const svc = serviceClient()!;
  await svc.from("knowledge_sources").delete().or(`name.eq.agency:${agencyKey},name.like.rule:test-%`);
  await admin.from("analytics_reports").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("agencies").delete().eq("key", agencyKey);
  await cleanup([A.id, B.id]);
});

describe("Office Copilot", () => {
  const go = (u: TestUser | null, ref: string) => { as(u); return call(copilot, "POST", `/api/v1/office/issues/${ref}/copilot`, { params: { ref } }); };
  it("without a model: rule-based fallback, labelled, stored as pending suggestions with citations; permissions enforced", async () => {
    process.env.ANTHROPIC_API_KEY = ""; delete process.env.ANTHROPIC_API_KEY;
    const i = await mkIssue({ description: "Hole.", area: "", category: "other" });
    expect((await go(null, i.ref)).status).toBe(401);
    expect((await go(outsider, i.ref)).status).toBe(404);
    expect((await go(citizen, i.ref)).status).toBe(403);               // the reporter can see it but is not office staff
    expect((await go(managerB, i.ref)).status).toBe(404);
    expect((await go(mp, i.ref)).status).toBe(403);
    expect((await go(officer, i.ref)).status).toBe(404);                // unassigned case officers cannot see it
    const r = await go(manager, i.ref);
    expect(r.status).toBe(200); expect(r.json.data.source).toBe("fallback");
    const by = Object.fromEntries(r.json.data.suggestions.map((s: { type: string }) => [s.type, s]));
    expect(by.missing_information.payload.items.length).toBeGreaterThanOrEqual(3);
    expect(by.reply_draft.payload).toMatchObject({ language: "bn", needs_staff_approval: true }); expect(by.reply_draft.payload.text).toContain(i.ref);
    expect(by.summary.citations.length).toBeGreaterThan(0); expect(by.summary.confidence).toBeNull();
    const { data: rows } = await admin.from("ai_suggestions").select("decision,suggestion_type").eq("target_id", i.id);
    expect(rows!.every((x) => x.decision === "pending")).toBe(true);
    // nothing was applied or sent
    expect((await admin.from("issues").select("status").eq("id", i.id).single()).data!.status).toBe("submitted");
    expect((await admin.from("issue_events").select("id").eq("issue_id", i.id).eq("is_public", true).neq("event_type", "submitted")).data).toEqual([]);
  });
  it("with a model: validates the answer, keeps only citations that exist, falls back when nothing valid is cited or the output is malformed", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const i = await mkIssue();
    fakeModel.next = (req) => { expect(req.messages[0].content).toContain("F2 (description)"); expect(req.messages[0].content).not.toMatch(/\b01712345678\b/);
      return { summary: "Deep pothole near the market.", missing_information: ["Photo"], reply_draft: "আপনার সমস্যাটি আমরা পেয়েছি এবং দেখছি।", confidence: 0.8, cited_facts: ["F1", "F2", "F99"] }; };
    const ok = await go(manager, i.ref);
    expect(ok.json.data.source).toBe("ai");
    const reply = ok.json.data.suggestions.find((s: { type: string }) => s.type === "reply_draft");
    expect(reply.citations.map((c: { fact: string }) => c.fact)).toEqual(["F1", "F2"]); expect(reply.confidence).toBe(0.8);
    const { data: run } = await admin.from("ai_runs").select("agent,status,prompt_version").eq("issue_id", i.id).eq("agent", "copilot"); expect(run![0]).toMatchObject({ status: "ok", prompt_version: "v1" });
    fakeModel.next = () => ({ summary: "x", missing_information: [], reply_draft: "আপনার সমস্যাটি আমরা পেয়েছি।", confidence: 0.9, cited_facts: ["F99"] });
    expect((await go(manager, i.ref)).json.data.source).toBe("fallback");
    fakeModel.next = () => "garbage"; expect((await go(manager, i.ref)).json.data.source).toBe("fallback");
    delete process.env.ANTHROPIC_API_KEY; fakeModel.next = null;
  });
  it("staff approve or edit through the decision endpoint; the office manager only", async () => {
    const i = await mkIssue(); const r = await go(manager, i.ref);
    const sid = r.json.data.suggestions.find((s: { type: string }) => s.type === "reply_draft").id as string;
    const dec = (u: TestUser, body: object) => { as(u); return call(decide, "POST", `/api/v1/ai/suggestions/${sid}/decision`, { body, params: { id: sid } }); };
    expect((await dec(citizen, { decision: "accept" })).status).toBe(403);
    expect((await dec(manager, { decision: "edit", final_value: { text: "সম্পাদিত উত্তর" } })).json.data.decision).toBe("edited");
  });
});

describe("Routing Agent (RAG with citations)", () => {
  const go = (u: TestUser, ref: string) => { as(u); return call(routing, "POST", `/api/v1/office/issues/${ref}/routing`, { params: { ref } }); };
  it("ingests the directory with source, locale, date and checksum; re-ingesting changes nothing", async () => {
    const svc = serviceClient()!;
    const a = await ingestKnowledge(svc); expect(a.sources).toBeGreaterThan(0);
    const b = await ingestKnowledge(svc); expect(b).toMatchObject({ added: 0, removed: 0 });
    const { data: src } = await svc.from("knowledge_sources").select("id,is_demo,fetched_at,url").eq("name", `agency:${agencyKey}`).single();
    expect(src).toMatchObject({ is_demo: true, url: "https://example.test/roads" }); expect(src!.fetched_at).toMatch(/^2026-11-01/);
    const { data: ch } = await svc.from("knowledge_chunks").select("locale,checksum,agency_id").eq("source_id", src!.id);
    expect(ch!.map((c) => c.locale).sort()).toEqual(["bn", "en"]); expect(ch!.every((c) => c.checksum && c.agency_id)).toBe(true);
  });
  it("suggests an agency with citations; permissions as for forwarding", async () => {
    const i = await mkIssue();
    const r = await go(manager, i.ref);
    expect(r.status).toBe(200); expect(r.json.data.method).toBe("lexical");
    const s = r.json.data.suggestion;
    expect(s.agency_key).toBeTruthy(); expect(s.citations.length).toBeGreaterThan(0);
    expect(s.citations[0]).toMatchObject({ source_name: expect.any(String), fetched_at: expect.anything() });
    expect(s.confidence).toBeNull(); expect(s.confidence_note).toMatch(/retrieval score/);
    expect((await go(outsider, i.ref)).status).toBe(404);
    expect((await go(citizen, i.ref)).status).toBe(403);
    expect((await go(managerB, i.ref)).status).toBe(404);
    expect((await go(mp, i.ref)).status).toBe(403);
    const { data: sug } = await admin.from("ai_suggestions").select("decision,suggestion_type").eq("id", s.id).single(); expect(sug).toEqual({ decision: "pending", suggestion_type: "routing" });
  });
  it("no category match means no confident suggestion and nothing stored; demo and real sources never mix", async () => {
    const svc = serviceClient()!;
    const none = await mkIssue({ category: "environment", title: "Zzqx", description: "Zzqx qqq" });
    await svc.from("agencies").update({ categories: ["roads"] }).eq("key", agencyKey);
    // a real (non-demo) issue sees no demo source at all
    const real = await mkIssue({ is_demo: false });
    const r = (await go(manager, real.ref)).json.data;
    expect(r).toMatchObject({ suggestion: null, reason: "no_confident_match" });
    const n = (await go(manager, none.ref)).json.data;
    if (n.suggestion) expect(n.suggestion.retrieval_score).toBeGreaterThanOrEqual(0.6);   // another agency may serve "environment"; either way never uncited
    // an admin-supplied, sourced real rule is found by real issues only
    await ingestKnowledge(svc, [{ id: "test-roads-rule", title_bn: "সড়ক", title_en: "Roads rule", text_bn: "সড়কের গর্তের অভিযোগ সড়ক বিভাগে যায়।", text_en: "Pothole complaints go to the roads department.", source_name: "Test rule source", source_url: "https://example.test/rule", checked_at: "2026-11-02", agency_key: agencyKey, is_demo: false }]);
    const again = (await go(manager, real.ref)).json.data;
    expect(again.suggestion.citations.every((c: { source_name: string }) => c.source_name !== "Test directory")).toBe(true);
    expect(again.suggestion.agency_key).toBe(agencyKey);
    const demo = (await go(manager, (await mkIssue()).ref)).json.data;
    expect(demo.suggestion.citations.some((c: { source_url: string }) => c.source_url === "https://example.test/rule")).toBe(false);
    expect((await admin.from("ai_suggestions").select("id").eq("target_id", none.id)).data!.length).toBe(n.suggestion ? 1 : 0);
  });
  it("a model answer that cites sources outside the retrieved set is ignored", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const i = await mkIssue();
    fakeModel.next = () => ({ agency_key: "made-up-agency", reason: "x", confidence: 0.99, source_ids: ["S1"] });
    const r = (await go(manager, i.ref)).json.data.suggestion;
    expect(r.chosen_by).toBe("retrieval"); expect(r.agency_key).not.toBe("made-up-agency");
    delete process.env.ANTHROPIC_API_KEY; fakeModel.next = null;
  });
});

describe("analytics", () => {
  const big: { id: string }[] = []; let reportId: string;
  it("aggregates with small groups hidden, approximate hotspots, and duplicate clusters from graph edges", async () => {
    for (let n = 0; n < 5; n++) big.push(await mkIssue({ category: "roads", lat: 23.7111, lng: 90.4111, constituency_id: A.id }));
    const water = [await mkIssue({ category: "water" }), await mkIssue({ category: "water" })];
    // chain: big[2] -> big[1] -> big[0]  (members point at their master)
    for (const [from, to] of [[big[1], big[0]], [big[2], big[1]], [big[3], big[0]]]) await admin.from("graph_edges").insert({ from_type: "issue", from_id: from.id, relation: "duplicate_of", to_type: "issue", to_id: to.id }).throwOnError();
    const q = (u: TestUser | null, key = A.key, days = 30) => { as(u); return call(analytics, "GET", `/api/v1/office/analytics?constituency=${key}&days=${days}`); };
    expect((await q(null)).status).toBe(401);
    expect((await q(citizen)).status).toBe(404);
    expect((await q(managerB)).status).toBe(404);
    expect((await q(officer)).status).toBe(404);
    const r = (await q(manager)).json.data;
    const roads = r.by_category.find((c: { category: string }) => c.category === "roads"), w = r.by_category.find((c: { category: string }) => c.category === "water");
    expect(roads.count).toBeGreaterThanOrEqual(5); expect(w).toMatchObject({ count: null, suppressed: true });
    expect(water).toHaveLength(2);
    expect(r.hotspots[0]).toMatchObject({ count: 5, top_category: "roads" });
    expect(Math.abs(r.hotspots[0].lat - 23.7111)).toBeLessThan(0.002); expect(r.hotspots[0].lat).not.toBe(23.7111);
    expect(r.duplicate_clusters[0].reports).toBe(4);
    expect(JSON.stringify(r)).not.toMatch(/reporter|23\.7111|90\.4111/);
    expect(r.privacy.min_group_size).toBe(5);
    expect((await q(mp)).status).toBe(200);
    expect((await q(manager, A.key, 0)).status).toBe(422);
    expect((await q(manager, "no-such-area")).status).toBe(404);
  });
  it("reports are drafts until an office manager approves; only approved reports are public; approval is audited", async () => {
    const mk = (u: TestUser, body: object) => { as(u); return call(newReport, "POST", "/api/v1/office/analytics/reports", { body }); };
    expect((await mk(officer, { constituency: A.key })).status).toBe(404);
    expect((await mk(citizen, { constituency: A.key })).status).toBe(404);
    const r = await mk(mp, { constituency: A.key, days: 30, narrative: "গত ৩০ দিনে সড়কের সমস্যা বেশি। Call 01712345678." });
    expect(r.status).toBe(201); reportId = r.json.data.id; expect(r.json.data.narrative_source).toBe("staff");
    as(null); expect((await call(publicReports, "GET", `/api/v1/analytics/reports?constituency=${A.key}`)).json.data).toEqual([]);
    const ap = (u: TestUser | null, path: Parameters<typeof call>[0]) => { as(u); return call(path, "POST", `/api/v1/office/analytics/reports/${reportId}/x`, { params: { id: reportId } }); };
    expect((await ap(null, approveReport)).status).toBe(401);
    expect((await ap(mp, approveReport)).status).toBe(403);
    expect((await ap(managerB, approveReport)).status).toBe(404);
    expect((await ap(manager, approveReport)).json.data.status).toBe("approved");
    expect((await ap(manager, approveReport)).status).toBe(409);
    as(null);
    const pub = (await call(publicReports, "GET", `/api/v1/analytics/reports?constituency=${A.key}`)).json.data;
    expect(pub).toHaveLength(1); expect(pub[0].narrative).not.toContain("01712345678"); expect(pub[0].payload.privacy.min_group_size).toBe(5);
    as(manager); expect((await call(listReports, "GET", "/api/v1/office/analytics/reports")).json.data.some((x: { id: string }) => x.id === reportId)).toBe(true);
    expect((await ap(manager, withdrawReport)).json.data.status).toBe("withdrawn");
    as(null); expect((await call(publicReports, "GET", `/api/v1/analytics/reports?constituency=${A.key}`)).json.data).toEqual([]);
    const { data: a } = await admin.from("audit_logs").select("action").eq("resource_id", reportId); expect(a!.map((x) => x.action).sort()).toEqual(["analytics_report.approved", "analytics_report.create", "analytics_report.withdrawn"]);
  });
  it("a generated narrative must only use numbers from the statistics", () => {
    const payload = { received: 12, by_category: [{ category: "roads", count: 9 }] };
    expect(narrativeIsGrounded("১২টি সমস্যা, এর মধ্যে 9টি সড়কের।", payload)).toBe(true);
    expect(narrativeIsGrounded("প্রায় 40টি সমস্যা এসেছে।", payload)).toBe(false);
  });
  it("narrative generation uses the Insight agent and is dropped if it invents a number", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    as(manager);
    fakeModel.next = () => ({ narrative: "এই সময়ে প্রচুর সমস্যা এসেছে, এর মধ্যে ৯৯৯টি সড়কের।" });
    expect((await call(newReport, "POST", "/api/v1/office/analytics/reports", { body: { constituency: A.key, generate_narrative: true } })).json.data.narrative_source).toBe("none");
    fakeModel.next = () => ({ narrative: "এই সময়ে সড়কের সমস্যা সবচেয়ে বেশি এসেছে।" });
    expect((await call(newReport, "POST", "/api/v1/office/analytics/reports", { body: { constituency: A.key, generate_narrative: true } })).json.data.narrative_source).toBe("ai_draft");
    delete process.env.ANTHROPIC_API_KEY; fakeModel.next = null;
  });
});

describe("MCP server", () => {
  const rpc = async (u: TestUser | null, body: unknown, token?: string) => {
    const t = token ?? (u ? (await u.sb.auth.getSession()).data.session!.access_token : undefined);
    const res = await mcp(new Request("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.7.${seq++ % 250}.1`, ...(t ? { authorization: `Bearer ${t}` } : {}) } }));
    return { status: res.status, json: res.status === 202 ? null : await res.json() };
  };
  const callTool = (u: TestUser, name: string, args: object) => rpc(u, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  const text = (r: { json: { result: { content: { text: string }[] } } }) => JSON.parse(r.json.result.content[0].text);

  it("needs a staff bearer token", async () => {
    expect((await rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(401);
    expect((await rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" }, "not-a-token")).status).toBe(401);
    expect((await rpc(citizen, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(403);
    expect((await rpc(manager, { jsonrpc: "2.0", id: 1, method: "ping" })).json.result).toEqual({});
  });
  it("initialises, lists only read-only tools plus the proposal tool, and rejects unknown methods and tools", async () => {
    const init = await rpc(manager, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
    expect(init.json.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: {} } });
    expect((await rpc(manager, { jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    const list = (await rpc(manager, { jsonrpc: "2.0", id: 2, method: "tools/list" })).json.result.tools as { name: string; annotations: { readOnlyHint: boolean } }[];
    expect(list.map((t) => t.name).sort()).toEqual(["agency_directory", "area_statistics", "case_timeline", "propose_note", "search_cases"]);
    expect(list.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name)).toEqual(["propose_note"]);
    expect((await rpc(manager, { jsonrpc: "2.0", id: 3, method: "nope" })).json.error.code).toBe(-32601);
    expect((await rpc(manager, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_everything", arguments: {} } })).json.error.code).toBe(-32602);
  });
  it("tools run under the caller's own row-level security and every call is audited without argument values", async () => {
    const mine = await mkIssue({ title: "MCP-visible pothole" });
    const other = (await admin.from("issues").insert({ reporter_id: citizen.id, title: "MCP-hidden pothole", category: "roads", description: "d", constituency_id: B.id }).select("ref").single().throwOnError()).data!;
    const found = text(await callTool(manager, "search_cases", { query: "MCP-" }));
    expect(found.map((x: { ref: string }) => x.ref)).toContain(mine.ref); expect(found.map((x: { ref: string }) => x.ref)).not.toContain(other.ref);
    expect(JSON.stringify(found)).not.toMatch(/reporter/);
    expect(text(await callTool(manager, "agency_directory", { category: "roads" })).length).toBeGreaterThan(0);
    const tl = text(await callTool(manager, "case_timeline", { ref: mine.ref })); expect(tl.ref).toBe(mine.ref); expect(JSON.stringify(tl)).not.toMatch(/actor/);
    expect(text(await callTool(manager, "case_timeline", { ref: other.ref }))).toBeNull();
    expect(text(await callTool(manager, "area_statistics", { constituency: A.key })).privacy.min_group_size).toBe(5);
    const denied = await callTool(officer, "area_statistics", { constituency: A.key }); expect(denied.json.result.isError).toBe(true);
    const bad = await callTool(manager, "search_cases", { limit: 500, extra: 1 }); expect(bad.json.result.isError).toBe(true);
    const { data: audit } = await admin.from("audit_logs").select("metadata,resource_id").eq("action", "mcp.tool_call").eq("actor_id", manager.id);
    expect(audit!.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(audit)).not.toContain("MCP-"); expect(audit!.find((a) => a.resource_id === "search_cases")!.metadata).toMatchObject({ arg_keys: ["limit", "query"], read_only: true });
  });
  it("the one write tool only proposes: a pending suggestion, no change to the issue", async () => {
    const i = await mkIssue();
    const r = await callTool(manager, "propose_note", { ref: i.ref, note: "Check the drain too. Phone 01712345678" });
    expect(text(r).status).toBe("pending_human_review");
    const { data: s } = await admin.from("ai_suggestions").select("decision,payload,suggestion_type").eq("id", text(r).suggestion_id).single();
    expect(s).toMatchObject({ decision: "pending", suggestion_type: "mcp_note" }); expect(JSON.stringify(s!.payload)).not.toContain("01712345678");
    expect((await admin.from("issue_events").select("id").eq("issue_id", i.id).neq("event_type", "submitted")).data).toEqual([]);
    expect(text(await callTool(managerB, "propose_note", { ref: i.ref, note: "intrusion" }))).toBeNull();
  });
});
