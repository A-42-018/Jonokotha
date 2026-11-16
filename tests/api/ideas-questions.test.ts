import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listIdeas, POST as createIdea } from "../../src/app/api/v1/ideas/route";
import { GET as getIdea } from "../../src/app/api/v1/ideas/[ref]/route";
import { DELETE as unsupport, POST as support } from "../../src/app/api/v1/ideas/[ref]/support/route";
import { GET as similar } from "../../src/app/api/v1/ideas/[ref]/similar/route";
import { POST as decide } from "../../src/app/api/v1/office/ideas/[ref]/decision/route";
import { GET as listQs, POST as ask } from "../../src/app/api/v1/questions/route";
import { GET as getQ } from "../../src/app/api/v1/questions/[ref]/route";
import { POST as msg } from "../../src/app/api/v1/questions/[ref]/messages/route";
import { POST as closeQ } from "../../src/app/api/v1/questions/[ref]/close/route";
import { GET as myQs } from "../../src/app/api/v1/me/questions/route";
import { GET as officeQs } from "../../src/app/api/v1/office/questions/route";
import { POST as assignQ } from "../../src/app/api/v1/office/questions/[ref]/assign/route";
import { admin, anonClient, as, call, cleanup, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let author: TestUser, u2: TestUser, u3: TestUser, manager: TestUser, officer: TestUser, mp: TestUser, managerB: TestUser;

beforeAll(async () => {
  A = await makeConstituency(); B = await makeConstituency();
  author = await makeUser("citizen"); u2 = await makeUser("citizen"); u3 = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
});
afterAll(async () => {
  as(null);
  await admin.from("ideas").delete().in("constituency_id", [A.id, B.id]); await admin.from("questions").delete().in("constituency_id", [A.id, B.id]);
  await cleanup([A.id, B.id]);
});
const publish = (ref: string) => admin.from("ideas").update({ status: "published" }).eq("ref", ref).throwOnError();

describe("ideas", () => {
  let ref: string;
  const post = (body: object) => call(createIdea, "POST", "/api/v1/ideas", { body });
  it("creates an idea in pending_review with personal data removed; hidden from the public until published", async () => {
    as(null); expect((await post({})).status).toBe(401);
    as(author);
    const r = await post({ constituency: A.key, category: "roads", title: "Repair the market road", body: "Please repair it. Call me on 01712345678 about it." });
    expect(r.status).toBe(201); ref = r.json.data.ref;
    expect(r.json.data).toMatchObject({ status: "pending_review", pii_removed: ["phone"] });
    const { data } = await admin.from("ideas").select("body").eq("ref", ref).single(); expect(data!.body).not.toContain("01712345678");
    as(null);
    expect((await call(listIdeas, "GET", `/api/v1/ideas?constituency=${A.key}`)).json.data).toEqual([]);
    expect((await call(getIdea, "GET", `/api/v1/ideas/${ref}`, { params: { ref } })).status).toBe(404);
    as(author); expect((await call(getIdea, "GET", `/api/v1/ideas/${ref}`, { params: { ref } })).json.data.status).toBe("pending_review");
    as(u2); expect((await call(getIdea, "GET", `/api/v1/ideas/${ref}`, { params: { ref } })).status).toBe(404);
  });
  it("validates input and caps ideas at 5 per day", async () => {
    as(u3);
    expect((await post({ constituency: A.key, title: "x", body: "short" })).status).toBe(422);
    expect((await post({ constituency: "nope-area", title: "A valid title", body: "A valid body text here" })).status).toBe(422);
    expect((await post({ constituency: A.key, category: "nope_cat", title: "A valid title", body: "A valid body text here" })).status).toBe(422);
    for (let i = 0; i < 5; i++) expect((await post({ constituency: A.key, title: `Idea number ${i}`, body: `Body for idea number ${i}` })).status).toBe(201);
    expect((await post({ constituency: A.key, title: "One more idea", body: "Body for one more idea" })).json.code).toBe("rule_not_met");
  });
  it("once published: public list and detail with a count only; one support per user, not your own, withdrawable", async () => {
    await publish(ref);
    const sup = (u: TestUser | null, del = false) => { as(u); return call(del ? unsupport : support, del ? "DELETE" : "POST", `/api/v1/ideas/${ref}/support`, { params: { ref } }); };
    expect((await sup(null)).status).toBe(401);
    expect((await sup(author)).json.code).toBe("rule_not_met");
    expect((await sup(u2)).json.data).toMatchObject({ supported: true, support_count: 1 });
    expect((await sup(u2)).json.data.support_count).toBe(1);
    expect((await sup(u3)).json.data.support_count).toBe(2);
    expect((await sup(u3, true)).json.data.support_count).toBe(1);
    as(null);
    const pub = (await call(getIdea, "GET", `/api/v1/ideas/${ref}`, { params: { ref } })).json.data;
    expect(pub).toMatchObject({ ref, support_count: 1, status: "published" });
    expect(JSON.stringify(pub)).not.toContain(u2.id); expect(pub).not.toHaveProperty("author_id");
    expect((await call(listIdeas, "GET", `/api/v1/ideas?constituency=${A.key}&sort=supported`)).json.data[0].ref).toBe(ref);
    expect((await anonClient.from("ideas").select("*")).data ?? []).toEqual([]);
    expect((await anonClient.from("idea_supports").select("*")).data ?? []).toEqual([]);
  });
  it("finds similar ideas in the same area only", async () => {
    await admin.from("ideas").update({ status: "published" }).eq("author_id", u3.id);
    as(u2);
    const mk = async (c: string, t: string) => { as(author); const r = await post({ constituency: c, title: t, body: "The surface is broken near the market and needs repair soon." }); await publish(r.json.data.ref); return r.json.data.ref as string; };
    const other = await mk(B.key, "Repair the market road");
    as(u2);
    const s = await call(similar, "GET", `/api/v1/ideas/${ref}/similar`, { params: { ref } });
    expect(s.status).toBe(200);
    expect(s.json.data.map((x: { ref: string }) => x.ref)).not.toContain(ref);
    expect(s.json.data.map((x: { ref: string }) => x.ref)).not.toContain(other);
    const draft = await call(similar, "GET", `/api/v1/ideas/new/similar?constituency=${A.key}&text=${encodeURIComponent("Repair the market road surface")}`, { params: { ref: "new" } });
    expect(draft.json.data.map((x: { ref: string }) => x.ref)).toContain(ref);
  });
  it("the office with the decide permission decides; a decline needs a reason; others and other offices cannot; it is audited", async () => {
    const dec = (u: TestUser, body: object) => { as(u); return call(decide, "POST", `/api/v1/office/ideas/${ref}/decision`, { body, params: { ref } }); };
    expect((await dec(author, { decision: "planned" })).status).toBe(404);
    expect((await dec(managerB, { decision: "planned" })).status).toBe(404);
    expect((await dec(mp, { decision: "planned" })).status).toBe(403);
    expect((await dec(officer, { decision: "planned" })).status).toBe(404);
    expect((await dec(manager, { decision: "declined" })).status).toBe(422);
    expect((await dec(manager, { decision: "bogus" })).status).toBe(422);
    expect((await dec(manager, { decision: "under_consideration", note: "We are looking at costs." })).json.data.status).toBe("under_consideration");
    expect((await dec(manager, { decision: "declined", note: "Outside our budget this year." })).json.data.status).toBe("declined");
    as(null);
    expect((await call(getIdea, "GET", `/api/v1/ideas/${ref}`, { params: { ref } })).json.data).toMatchObject({ status: "declined", decision_note: "Outside our budget this year." });
    const { data: a } = await admin.from("audit_logs").select("actor_id").eq("action", "idea.decision").eq("resource_id", ref);
    expect(a!.length).toBe(2); expect(a![0].actor_id).toBe(manager.id);
    as(u2); expect((await call(support, "POST", `/api/v1/ideas/${ref}/support`, { params: { ref } })).status).toBe(404);
  });
});

describe("questions", () => {
  let priv: string, pub: string;
  const q = (body: object) => call(ask, "POST", "/api/v1/questions", { body });
  const m = (r: string, body: string) => call(msg, "POST", `/api/v1/questions/${r}/messages`, { body: { body }, params: { ref: r } });
  const get = (r: string) => call(getQ, "GET", `/api/v1/questions/${r}`, { params: { ref: r } });

  it("private questions are seen only by the asker and the in-scope office", async () => {
    as(null); expect((await q({})).status).toBe(401);
    as(author);
    const r = await q({ constituency: A.key, visibility: "private", title: "When will the clinic open?", body: "Is there a date for the new clinic opening?" });
    expect(r.status).toBe(201); priv = r.json.data.ref; expect(r.json.data.visibility).toBe("private");
    expect((await get(priv)).json.data.status).toBe("open");
    for (const u of [u2, managerB]) { as(u); expect((await get(priv)).status).toBe(404); }
    as(null); expect((await get(priv)).status).toBe(404);
    as(manager); expect((await get(priv)).json.data.title).toBe("When will the clinic open?");
    as(officer); expect((await get(priv)).status).toBe(404);          // case officers see only assigned work
    as(mp); expect((await get(priv)).status).toBe(200);
    as(null);
    expect((await call(listQs, "GET", `/api/v1/questions?constituency=${A.key}`)).json.data).toEqual([]);
    expect((await anonClient.from("questions").select("*")).data ?? []).toEqual([]);
  });
  it("assignment (manager only, active member) lets a case officer reply; replying marks it answered; the asker reopens it", async () => {
    const as_ = (u: TestUser, a: string | null) => { as(u); return call(assignQ, "POST", `/api/v1/office/questions/${priv}/assign`, { body: { assignee: a }, params: { ref: priv } }); };
    expect((await as_(officer, officer.id)).status).toBe(404);   // unassigned case officers cannot even see it
    expect((await as_(mp, officer.id)).status).toBe(403);
    expect((await as_(manager, u2.id)).status).toBe(422);
    expect((await as_(manager, officer.id)).json.data.assigned_to).toBe(officer.id);
    as(officer);
    expect((await get(priv)).status).toBe(200);
    expect((await call(officeQs, "GET", "/api/v1/office/questions")).json.data.map((x: { ref: string }) => x.ref)).toContain(priv);
    expect((await m(priv, "It opens next month, see the notice.")).json.data.status).toBe("answered");
    as(mp); expect((await m(priv, "hello")).status).toBe(403);
    as(u2); expect((await m(priv, "hello")).status).toBe(404);
    as(author);
    expect((await m(priv, "Thank you. Which day?")).json.data.status).toBe("open");
    const t = (await get(priv)).json.data;
    expect(t.messages.map((x: { author_kind: string }) => x.author_kind)).toEqual(["office", "citizen"]);
    expect(t).not.toHaveProperty("assigned_to");
    expect((await call(myQs, "GET", "/api/v1/me/questions")).json.data.map((x: { ref: string }) => x.ref)).toEqual([priv]);
    const { data: a } = await admin.from("audit_logs").select("id").eq("action", "question.assign").eq("resource_id", priv); expect(a!.length).toBe(1);
  });
  it("public questions wait for moderation, then show with their thread and no personal fields", async () => {
    as(author);
    const r = await q({ constituency: A.key, visibility: "public", title: "Why is the bridge closed?", body: "The bridge has been closed for a week. Why?" });
    pub = r.json.data.ref; expect(r.json.data.status).toBe("pending_review");
    expect((await m(pub, "Anyone?")).json.code).toBe("rule_not_met");
    as(null); expect((await get(pub)).status).toBe(404);
    await admin.from("questions").update({ status: "open" }).eq("ref", pub);
    as(manager); expect((await m(pub, "Repairs finish on Friday.")).status).toBe(201);
    as(null);
    const d = (await get(pub)).json.data;
    expect(d).toMatchObject({ ref: pub, status: "answered" }); expect(d.messages).toHaveLength(1);
    expect(JSON.stringify(d)).not.toContain(author.id); expect(d).not.toHaveProperty("asker_id");
    expect((await call(listQs, "GET", `/api/v1/questions?constituency=${A.key}`)).json.data.map((x: { ref: string }) => x.ref)).toEqual([pub]);
  });
  it("closing: the asker or the office; a closed question takes no more citizen messages; anti-spam limits apply", async () => {
    as(u2); expect((await call(closeQ, "POST", `/api/v1/questions/${pub}/close`, { params: { ref: pub } })).status).toBe(404);
    as(author); expect((await call(closeQ, "POST", `/api/v1/questions/${pub}/close`, { params: { ref: pub } })).json.data.status).toBe("closed");
    expect((await m(pub, "more")).json.code).toBe("rule_not_met");
    as(u3);
    const mk = (i: number) => q({ constituency: A.key, visibility: "private", title: `Question number ${i}`, body: `Body of question number ${i}` });
    for (let i = 0; i < 3; i++) expect((await mk(i)).status).toBe(201);
    expect((await mk(3)).json.code).toBe("rule_not_met");
    as(u2);
    const one = (await q({ constituency: A.key, visibility: "private", title: "Rate test question", body: "Rate test body text" })).json.data.ref;
    for (let i = 0; i < 5; i++) expect((await m(one, `message ${i}`)).status).toBe(201);
    expect((await m(one, "message 6")).json.code).toBe("rule_not_met");
  });
});
