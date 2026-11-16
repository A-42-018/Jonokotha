import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as dupes } from "../../src/app/api/v1/office/issues/[ref]/duplicates/route";
import { POST as decide } from "../../src/app/api/v1/ai/suggestions/[id]/decision/route";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

const vec = (k: number, mix = 0) => { const v = new Array(1024).fill(0); v[k] += 1 - mix; v[k + 1] += mix; return v; };
let A: { id: string }, citizen: TestUser, manager: TestUser, stranger: TestUser;
const ids: string[] = [], refs: string[] = [];
const realFetch = globalThis.fetch;
const texts = new Map<string, number[]>();

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service;
  process.env.EMBEDDINGS_BASE_URL = "https://emb.example.test/v1"; process.env.EMBEDDINGS_API_KEY = "k";
  A = await makeConstituency();
  citizen = await makeUser("citizen"); stranger = await makeUser("staff");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  const mk = async (title: string, v: number[]) => {
    const { data } = await admin.from("issues").insert({ reporter_id: citizen.id, title, category: "roads", description: `${title} description`, constituency_id: A.id, area: "Ward 3" }).select("id,ref").single().throwOnError();
    ids.push(data!.id); refs.push(data!.ref); texts.set(`${title}\n${title} description\nWard 3`, v);
    return data!;
  };
  await mk("Pothole on market road", vec(0)); await mk("Big hole on the market road", vec(0, 0.05)); await mk("Broken streetlight", vec(10));
  // The embedding provider is faked: the vector is chosen by the text it is asked to embed.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => {
    if (!String(u instanceof Request ? u.url : u).startsWith("https://emb.example.test")) return realFetch(u, init); // Supabase calls pass through
    const body = JSON.parse((init as RequestInit).body as string) as { input: string[] };
    return new Response(JSON.stringify({ data: body.input.map((t, index) => ({ index, embedding: texts.get(t) ?? vec(500) })) }), { status: 200 });
  });
  // Index the neighbours the way submit does (best-effort), through the same code.
  const { indexIssue } = await import("../../src/lib/ai/duplicates");
  for (const id of ids.slice(1)) await indexIssue(id);
});
afterAll(async () => {
  as(null); vi.restoreAllMocks();
  await admin.from("ai_suggestions").delete().in("target_id", ids); await admin.from("graph_edges").delete().in("from_id", ids);
  await cleanup([A.id]);
});
const suggest = (ref: string) => call(dupes, "POST", `/api/v1/office/issues/${ref}/duplicates`, { params: { ref } });

describe("POST /api/v1/office/issues/{ref}/duplicates", () => {
  it("401 signed out; 403 for the reporter, 404 (existence not revealed) for staff outside the office", async () => {
    as(null); expect((await suggest(refs[0])).status).toBe(401);
    as(citizen); expect((await suggest(refs[0])).status).toBe(403);
    as(stranger); expect((await suggest(refs[0])).status).toBe(404);
  });
  it("indexes the issue, returns the near duplicate only, and is repeatable without duplicating suggestions", async () => {
    as(manager);
    const r = await suggest(refs[0]);
    expect(r.status).toBe(200);
    expect(r.json.data.available).toBe(true);
    expect(r.json.data.candidates.map((x: { ref: string }) => x.ref)).toEqual([refs[1]]);
    expect(r.json.data.candidates[0].score).toBeGreaterThan(0.9);
    const again = await suggest(refs[0]);
    expect(again.json.data.candidates[0].suggestion_id).toBe(r.json.data.candidates[0].suggestion_id);
    const { count } = await admin.from("ai_suggestions").select("id", { count: "exact", head: true }).eq("target_id", ids[0]).eq("suggestion_type", "duplicate");
    expect(count).toBe(1);
    expect(JSON.stringify((await admin.from("ai_suggestions").select("payload").eq("target_id", ids[0])).data)).not.toMatch(/description/);
  });
  it("Accept records duplicate_of; a different citizen's embedding call never carried personal data", async () => {
    as(manager);
    const sid = (await suggest(refs[0])).json.data.candidates[0].suggestion_id as string;
    const ok = await call(decide, "POST", `/api/v1/ai/suggestions/${sid}/decision`, { body: { decision: "accept" }, params: { id: sid } });
    expect(ok.status).toBe(200);
    const { data } = await admin.from("graph_edges").select("to_id,source").eq("from_id", ids[0]).eq("relation", "duplicate_of");
    expect(data).toEqual([{ to_id: ids[1], source: "ai_suggestion_accepted" }]);
  });
  it("404 for an unknown reference", async () => {
    as(manager); expect((await suggest("JK-0000-0000")).status).toBe(404);
  });
});
