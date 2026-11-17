import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { GET as listCons } from "../../src/app/api/v1/consultations/route";
import { GET as getCons } from "../../src/app/api/v1/consultations/[ref]/route";
import { POST as addStmt } from "../../src/app/api/v1/consultations/[ref]/statements/route";
import { PUT as voteStmt } from "../../src/app/api/v1/consultations/[ref]/statements/[id]/vote/route";
import { GET as pubReport } from "../../src/app/api/v1/consultations/[ref]/report/route";
import { GET as offListCons, POST as offCreateCons } from "../../src/app/api/v1/office/consultations/route";
import { GET as offGetCons } from "../../src/app/api/v1/office/consultations/[ref]/route";
import { POST as consStatus } from "../../src/app/api/v1/office/consultations/[ref]/status/route";
import { POST as consDecision } from "../../src/app/api/v1/office/consultations/[ref]/decision/route";
import { POST as consSummary } from "../../src/app/api/v1/office/consultations/[ref]/summary/route";
import { PUT as consReport } from "../../src/app/api/v1/office/consultations/[ref]/report/route";
import { POST as consModerate } from "../../src/app/api/v1/office/consultations/[ref]/statements/[id]/moderate/route";
import { GET as getIdea } from "../../src/app/api/v1/ideas/[ref]/route";
import { POST as supportIdea } from "../../src/app/api/v1/ideas/[ref]/support/route";
import { GET as listArgs, POST as addArg } from "../../src/app/api/v1/ideas/[ref]/arguments/route";
import { PUT as helpful } from "../../src/app/api/v1/ideas/[ref]/arguments/[id]/helpful/route";
import { GET as getPolicy, PUT as putPolicy } from "../../src/app/api/v1/office/constituencies/[key]/idea-policy/route";
import { POST as decideIdea } from "../../src/app/api/v1/office/ideas/[ref]/decision/route";
import { POST as report } from "../../src/app/api/v1/reports/route";
import { GET as listCheckins, POST as addCheckin } from "../../src/app/api/v1/projects/[ref]/checkins/route";
import { POST as checkinPhoto } from "../../src/app/api/v1/projects/[ref]/checkins/[id]/photo/route";
import { GET as offCheckins } from "../../src/app/api/v1/office/projects/[ref]/checkins/route";
import { POST as modCheckin } from "../../src/app/api/v1/office/checkins/[id]/moderate/route";
import { POST as respCheckin } from "../../src/app/api/v1/office/checkins/[id]/response/route";
import { GET as myChannels, POST as startLink } from "../../src/app/api/v1/me/channels/route";
import { DELETE as revokeLink, PATCH as patchLink } from "../../src/app/api/v1/me/channels/[id]/route";
import { GET as waVerify, POST as waHook } from "../../src/app/api/v1/webhooks/whatsapp/route";
import { POST as smsHook } from "../../src/app/api/v1/webhooks/sms/route";
import { GET as costs } from "../../src/app/api/v1/admin/channels/costs/route";
import { PUT as budget } from "../../src/app/api/v1/admin/channels/budget/route";
import { PUT as putPrefs } from "../../src/app/api/v1/me/notification-preferences/route";
import { POST as postAlert } from "../../src/app/api/v1/office/area-alerts/route";
import { GET as getAlerts } from "../../src/app/api/v1/area-alerts/route";
import { GET as listSurveys } from "../../src/app/api/v1/surveys/route";
import { GET as getSurvey } from "../../src/app/api/v1/surveys/[ref]/route";
import { POST as answerSurvey } from "../../src/app/api/v1/surveys/[ref]/responses/route";
import { GET as surveyRes } from "../../src/app/api/v1/surveys/[ref]/results/route";
import { GET as offSurveys, POST as offCreateSurvey } from "../../src/app/api/v1/office/surveys/route";
import { POST as surveyStatus } from "../../src/app/api/v1/office/surveys/[ref]/status/route";
import { GET as satisfaction } from "../../src/app/api/v1/analytics/satisfaction/route";
import { GET as listCommit } from "../../src/app/api/v1/commitments/route";
import { GET as getCommit } from "../../src/app/api/v1/commitments/[ref]/route";
import { GET as offCommits, POST as offCreateCommit } from "../../src/app/api/v1/office/commitments/route";
import { POST as commitStatus } from "../../src/app/api/v1/office/commitments/[ref]/status/route";
import { POST as commitDecision } from "../../src/app/api/v1/office/commitments/[ref]/decision/route";
import { GET as listRounds } from "../../src/app/api/v1/priorities/route";
import { GET as getRound } from "../../src/app/api/v1/priorities/[ref]/route";
import { PUT as ranking } from "../../src/app/api/v1/priorities/[ref]/ranking/route";
import { GET as roundResults } from "../../src/app/api/v1/priorities/[ref]/results/route";
import { GET as offRounds, POST as offCreateRound } from "../../src/app/api/v1/office/priorities/route";
import { POST as roundStatus } from "../../src/app/api/v1/office/priorities/[ref]/status/route";
import { GET as offBriefs } from "../../src/app/api/v1/office/briefs/route";
import { POST as reviewBrief } from "../../src/app/api/v1/office/briefs/[id]/review/route";
import { GET as exportGet } from "../../src/app/api/v1/office/exports/route";
import { GET as heatmap } from "../../src/app/api/v1/analytics/heatmap/route";
import { GET as clusters } from "../../src/app/api/v1/office/analytics/clusters/route";
import { GET as offKpis } from "../../src/app/api/v1/office/kpis/release-1-1/route";
import { GET as adminKpis } from "../../src/app/api/v1/admin/kpis/release-1-1/route";
import { GET as speakCfg, POST as speakPost } from "../../src/app/api/v1/ai/speak/route";
import { clearFlagCache } from "../../src/lib/capabilities";
import { hmacHex } from "../../src/lib/channels/signature";
import { setChannelProviderForTests, type ChannelProvider } from "../../src/lib/channels/provider";
import { deliverDue } from "../../src/lib/notify/deliver";
import { runRelease11Maintenance, runWeeklyBriefs } from "../../src/lib/briefs";
import { setTtsProviderForTests } from "../../src/lib/tts";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let mgr: TestUser, mp: TestUser, officer: TestUser, mgrB: TestUser, adminU: TestUser, citizens: TestUser[];
const future = (d = 7) => new Date(Date.now() + d * 86400_000).toISOString();
const svc = () => createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });
const FLAGS = ["whatsapp_intake", "sms_intake", "read_aloud"];
const denied = (n: number) => expect([403, 404]).toContain(n);
const refParam = (ref: string) => ({ ref }); const idParam = (id: string) => ({ id });
const sent: { to: string; text: string }[] = [];
const fakeProvider: ChannelProvider = { send: async (to, text) => { sent.push({ to, text }); return { ok: true, id: `out-${sent.length}` }; } };

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  process.env.WHATSAPP_APP_SECRET = "wa-secret-for-tests"; process.env.WHATSAPP_VERIFY_TOKEN = "verify-me"; process.env.SMS_WEBHOOK_SECRET = "sms-secret-for-tests";
  A = await makeConstituency(); B = await makeConstituency();
  mgr = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  mgrB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
  adminU = await makeUser("admin");
  citizens = []; for (let i = 0; i < 11; i++) citizens.push(await makeUser("citizen"));
  await admin.from("follows").insert(citizens.map((u) => ({ user_id: u.id, target_type: "area", constituency_id: A.id }))).throwOnError();
  await admin.from("feature_flags").update({ enabled: true }).in("key", FLAGS).throwOnError();
  clearFlagCache();
});
afterAll(async () => {
  as(null); setChannelProviderForTests("whatsapp", undefined); setChannelProviderForTests("sms", undefined); setTtsProviderForTests(undefined);
  await admin.from("feature_flags").update({ enabled: false }).in("key", FLAGS); clearFlagCache();
  const ids = [A.id, B.id];
  await admin.from("channel_messages").delete().not("id", "is", null);
  await admin.from("channel_links").delete().in("user_id", citizens.map((u) => u.id));
  await admin.from("channel_budgets").delete().eq("channel", "sms");
  for (const t of ["consultations", "surveys", "commitments", "priority_rounds", "area_alerts", "insight_briefs", "idea_policies", "ideas", "projects"]) await admin.from(t).delete().in("constituency_id", ids);
  await admin.from("pending_file_deletions").delete().not("id", "is", null);
  await cleanup(ids);
});

describe("E2E scenario 16: consultation shows only aggregate groups above the minimum size; one vote per citizen per statement", () => {
  let ref = "", stmts: string[] = [], citizenStmt = "";
  it("the office drafts, opens and moderates; roles and validation are enforced", async () => {
    const body = { constituency: A.key, question: "Which work is needed first in your ward?", description: "Short answers help.", seed_statements: ["Repair the market road", "Build a covered drain"], closes_at: future(5) };
    as(null); expect((await call(offCreateCons, "POST", "/api/v1/office/consultations", { body })).status).toBe(401);
    as(citizens[0]); denied((await call(offCreateCons, "POST", "/api/v1/office/consultations", { body })).status);
    as(mgrB); expect((await call(offCreateCons, "POST", "/api/v1/office/consultations", { body })).status, "other area's office").toBe(404);
    as(mgr);
    expect((await call(offCreateCons, "POST", "/api/v1/office/consultations", { body: { ...body, party: "x" } })).status, "unknown field").toBe(422);
    expect((await call(offCreateCons, "POST", "/api/v1/office/consultations", { body: { ...body, seed_statements: ["ab"] } })).status).toBe(422);
    const made = await call(offCreateCons, "POST", "/api/v1/office/consultations", { body });
    expect(made.status).toBe(201); ref = made.json.data.ref; expect(made.json.data.status).toBe("draft");
    as(null);
    expect((await call(getCons, "GET", `/api/v1/consultations/${ref}`, { params: refParam(ref) })).status, "drafts are not public").toBe(404);
    as(mgr);
    expect((await call(consStatus, "POST", "/x", { params: refParam(ref), body: { action: "bogus" } })).status).toBe(422);
    const opened = await call(consStatus, "POST", "/x", { params: refParam(ref), body: { action: "open" } });
    expect(opened.json.data.status).toBe("open");
    const list = await call(offListCons, "GET", "/api/v1/office/consultations");
    expect(list.json.data.find((r: { ref: string }) => r.ref === ref)).toMatchObject({ constituency: A.key });
    as(null);
    const pub = await call(listCons, "GET", `/api/v1/consultations?constituency=${A.key}&status=open`);
    expect(pub.json.data.map((r: { ref: string }) => r.ref)).toContain(ref);
    const detail = await call(getCons, "GET", `/api/v1/consultations/${ref}`, { params: refParam(ref) });
    stmts = detail.json.data.statements.map((s: { id: string }) => s.id);
    expect(stmts).toHaveLength(2); expect(detail.json.data.next_statement_id).toBeTruthy();
    expect(JSON.stringify(detail.json.data)).not.toMatch(/agree_pct|author|votes"/);   // no counts, no authors
  });

  it("citizens vote once per statement (a changed vote replaces), add a moderated statement, and cannot vote on pending or foreign statements", async () => {
    as(citizens[0]);
    expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: stmts[0] }, body: { vote: "maybe" } })).status).toBe(422);
    expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: crypto.randomUUID() }, body: { vote: "agree" } })).status).toBe(404);
    for (let i = 0; i < 10; i++) {
      as(citizens[i]);
      const first = i < 5 ? "agree" : "disagree";
      expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: stmts[0] }, body: { vote: first } })).status).toBe(200);
      expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: stmts[1] }, body: { vote: i < 6 ? "agree" : "disagree" } })).status).toBe(200);
    }
    as(citizens[0]);
    expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: stmts[1] }, body: { vote: "agree" } })).status, "changing a vote is allowed").toBe(200);
    expect((await admin.from("statement_votes").select("user_id").eq("statement_id", stmts[1])).data).toHaveLength(10);
    const mine = await call(getCons, "GET", `/api/v1/consultations/${ref}`, { params: refParam(ref) });
    expect(mine.json.data.statements.map((s: { my_vote: string }) => s.my_vote)).toEqual(["agree", "agree"].map((v, i) => (i === 0 ? "agree" : v)));
    expect(mine.json.data.next_statement_id).toBeNull();
    // citizen statement
    expect((await call(addStmt, "POST", "/x", { params: refParam(ref), body: { text: "x".repeat(141) } })).status).toBe(422);
    const s = await call(addStmt, "POST", "/x", { params: refParam(ref), body: { text: "Light the footpath, call 01712345678" } });
    expect(s.status).toBe(201); citizenStmt = s.json.data.id;
    const { data: row } = await admin.from("consultation_statements").select("body,status").eq("id", citizenStmt).single();
    expect(row!.status).toBe("pending_review"); expect(row!.body).not.toContain("01712345678");
    expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: citizenStmt }, body: { vote: "agree" } })).status, "pending statements are not votable").toBe(404);
    as(citizens[1]); expect((await call(addStmt, "POST", "/x", { params: refParam(ref), body: { text: "Add a bus shelter at the market" } })).status).toBe(201);
    as(citizens[2]); denied((await call(consModerate, "POST", "/x", { params: { ref, id: citizenStmt }, body: { action: "approve" } })).status);
    as(mgr);
    expect((await call(consModerate, "POST", "/x", { params: { ref, id: citizenStmt }, body: { action: "reject" } })).status, "reject needs a reason").toBe(422);
    expect((await call(consModerate, "POST", "/x", { params: { ref, id: citizenStmt }, body: { action: "approve" } })).status).toBe(200);
    expect((await call(consModerate, "POST", "/x", { params: { ref, id: citizenStmt }, body: { action: "approve" } })).status, "once").toBe(409);
    as(citizens[3]);
    expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: citizenStmt }, body: { vote: "agree" } })).status).toBe(200);
  });

  it("the summary is an aggregate draft: the MP/analytics roles only, groups at least 5, no identities; publishing needs a closed consultation and a you-said-we-did text", async () => {
    as(citizens[0]); expect((await call(consSummary, "POST", "/x", { params: refParam(ref), body: {} })).status).toBe(404);
    as(officer); expect((await call(consSummary, "POST", "/x", { params: refParam(ref), body: {} })).status, "case officer has no analytics right").toBe(404);
    as(mgr);
    const sum = await call(consSummary, "POST", "/x", { params: refParam(ref), body: { generate_narrative: false } });
    expect(sum.status).toBe(201); expect(sum.json.data).toMatchObject({ participants: 10, suppressed: false, ai_summary_source: "none" });
    const view = await call(offGetCons, "GET", "/x", { params: refParam(ref) });
    const rep = view.json.data.report;
    expect(rep.status).toBe("draft"); expect(rep.groups.every((g: { size: number }) => g.size >= 5)).toBe(true);
    expect(rep.agreement.length).toBe(3);
    const blob = JSON.stringify(rep);
    for (const u of citizens) expect(blob).not.toContain(u.id);
    as(null); expect((await call(pubReport, "GET", "/x", { params: refParam(ref) })).status, "draft is not public").toBe(404);
    as(mgr);
    const pubBody = { summary_bn: "অধিকাংশ মানুষ বাজারের রাস্তা মেরামতে একমত।", you_said_we_did: "আপনারা রাস্তা মেরামত চেয়েছেন; আমরা বরাদ্দের জন্য আবেদন করেছি।", actions: [{ text: "Road repair requested" }], publish: true };
    expect((await call(consReport, "PUT", "/x", { params: refParam(ref), body: pubBody })).status, "still open").toBe(409);
    expect((await call(consStatus, "POST", "/x", { params: refParam(ref), body: { action: "close" } })).json.data.status).toBe("closed");
    expect((await call(consReport, "PUT", "/x", { params: refParam(ref), body: { ...pubBody, you_said_we_did: "short" } })).status).toBe(422);
    const draftSave = await call(consReport, "PUT", "/x", { params: refParam(ref), body: { ...pubBody, publish: false } });
    expect(draftSave.json.data.status).toBe("reviewed");
    expect((await call(consReport, "PUT", "/x", { params: refParam(ref), body: pubBody })).json.data).toMatchObject({ status: "published" });
    as(citizens[4]);
    expect((await call(voteStmt, "PUT", "/x", { params: { ref, id: stmts[0] }, body: { vote: "agree" } })).status, "closed").toBe(409);
    as(null);
    const pr = await call(pubReport, "GET", "/x", { params: refParam(ref) });
    expect(pr.status).toBe(200);
    expect(pr.json.data).toMatchObject({ participants: 10, min_group_size: 5 });
    expect(pr.json.data.groups.every((g: { size: number }) => g.size >= 5)).toBe(true);
    expect(JSON.stringify(pr.json.data)).not.toMatch(/user_id|author/);
    const { data: n } = await admin.from("notifications").select("id").eq("user_id", citizens[2].id).eq("type", "consultation_report");
    expect(n).toHaveLength(1);
  });

  it("the MP rule: the office manager's opening waits and the MP decides (decision route)", async () => {
    await admin.from("constituencies").update({ mp_approval_required: true }).eq("id", A.id);
    as(mgr);
    const made = await call(offCreateCons, "POST", "/x", { body: { constituency: A.key, question: "Another question for the ward?", seed_statements: ["First statement here", "Second statement here"], closes_at: future(3) } });
    const r2 = made.json.data.ref;
    expect((await call(consStatus, "POST", "/x", { params: refParam(r2), body: { action: "open" } })).json.data.status).toBe("pending_approval");
    denied((await call(consDecision, "POST", "/x", { params: refParam(r2), body: { decision: "approve" } })).status);
    as(mp);
    expect((await call(consDecision, "POST", "/x", { params: refParam(r2), body: { decision: "reject" } })).status, "reason needed").toBe(422);
    expect((await call(consDecision, "POST", "/x", { params: refParam(r2), body: { decision: "approve" } })).json.data.status).toBe("open");
    await admin.from("constituencies").update({ mp_approval_required: false }).eq("id", A.id);
  });
});

describe("E2E scenario 17: an idea reaching the threshold alerts the office and shows the due date; a missed date shows as overdue", () => {
  let ref = "", ideaId = "", argId = "";
  it("office sets the policy; local supporters reach it; the office is alerted; the public sees the due date", async () => {
    const { data: idea } = await admin.from("ideas").insert({ author_id: citizens[10].id, constituency_id: A.id, title: "Solar street lights", body: "Solar lights along the canal road", status: "published" }).select("id,ref").single();
    ref = idea!.ref; ideaId = idea!.id;
    as(citizens[0]); denied((await call(putPolicy, "PUT", "/x", { params: { key: A.key }, body: { support_threshold: 4, response_days: 10 } })).status);
    as(mgr);
    expect((await call(putPolicy, "PUT", "/x", { params: { key: A.key }, body: { support_threshold: 2, response_days: 10 } })).status).toBe(422);
    expect((await call(putPolicy, "PUT", "/x", { params: { key: A.key }, body: { support_threshold: 4, response_days: 10 } })).status).toBe(200);
    expect((await call(getPolicy, "GET", "/x", { params: { key: A.key } })).json.data).toMatchObject({ support_threshold: 4, response_days: 10 });
    expect((await call(putPolicy, "PUT", "/x", { params: { key: "Bad Key!" }, body: { support_threshold: 4, response_days: 10 } })).status, "malformed key").toBe(404);
    for (let i = 0; i < 3; i++) { as(citizens[i]); expect((await call(supportIdea, "POST", "/x", { params: refParam(ref) })).status).toBe(200); }
    as(null);
    expect((await call(getIdea, "GET", "/x", { params: refParam(ref) })).json.data.response_state).toBeNull();
    as(citizens[3]); await call(supportIdea, "POST", "/x", { params: refParam(ref) });
    as(null);
    const pub = await call(getIdea, "GET", "/x", { params: refParam(ref) });
    expect(pub.json.data).toMatchObject({ response_state: "awaiting_response", support_threshold: 4 });
    expect(new Date(pub.json.data.response_due_at).getTime()).toBeGreaterThan(Date.now() + 9 * 86400_000);
    const { data: n } = await admin.from("notifications").select("id").eq("user_id", mgr.id).eq("type", "idea_threshold");
    expect(n).toHaveLength(1);
  });

  it("a missed due date shows as overdue; the answer needs a reasoned note; a late answer is labelled", async () => {
    await admin.from("ideas").update({ response_due_at: new Date(Date.now() - 86400_000).toISOString() }).eq("id", ideaId);
    as(null);
    expect((await call(getIdea, "GET", "/x", { params: refParam(ref) })).json.data.response_state).toBe("overdue");
    as(mgr);
    expect((await call(decideIdea, "POST", "/x", { params: refParam(ref), body: { decision: "planned", note: "ok" } })).status).toBe(422);
    expect((await call(decideIdea, "POST", "/x", { params: refParam(ref), body: { decision: "planned", note: "We will install lights in the next budget and report in June." } })).status).toBe(200);
    as(null);
    expect((await call(getIdea, "GET", "/x", { params: refParam(ref) })).json.data.response_state).toBe("answered_late");
  });

  it("for/against points: add, list, helpful once, report; validation and roles", async () => {
    as(null); expect((await call(addArg, "POST", "/x", { params: refParam(ref), body: { side: "for", body: "It helps at night" } })).status).toBe(401);
    as(citizens[5]);
    expect((await call(addArg, "POST", "/x", { params: refParam(ref), body: { side: "neutral", body: "It helps at night" } })).status).toBe(422);
    const a = await call(addArg, "POST", "/x", { params: refParam(ref), body: { side: "for", body: "It helps at night, call 01712345678" } });
    expect(a.status).toBe(201); argId = a.json.data.id;
    await call(addArg, "POST", "/x", { params: refParam(ref), body: { side: "against", body: "Maintenance cost is unclear" } });
    as(null);
    const list = await call(listArgs, "GET", "/x", { params: refParam(ref) });
    expect(list.json.data.for).toHaveLength(1); expect(list.json.data.against).toHaveLength(1);
    expect(JSON.stringify(list.json.data)).not.toMatch(/01712345678|author/);
    as(citizens[5]); expect((await call(helpful, "PUT", "/x", { params: { ref, id: argId }, body: { on: true } })).status, "own point").toBe(409);
    as(citizens[6]); expect((await call(helpful, "PUT", "/x", { params: { ref, id: argId }, body: { on: true } })).json.data.helpful_count).toBe(1);
    expect((await call(helpful, "PUT", "/x", { params: { ref, id: argId }, body: { on: true } })).json.data.helpful_count, "once per account").toBe(1);
    expect((await call(helpful, "PUT", "/x", { params: { ref: "ID-0000-0", id: argId }, body: { on: true } })).status, "point belongs to another idea").toBe(404);
    expect((await call(report, "POST", "/x", { body: { type: "idea_argument", ref: argId, reason: "abuse" } })).status).toBe(201);
    expect((await call(report, "POST", "/x", { body: { type: "idea_argument", ref: argId, reason: "abuse" } })).status, "once per person").toBe(409);
  });
});

describe("project check-ins (B7.3)", () => {
  it("citizen-submitted, reviewed before public, photo re-encoded, office response, official status untouched", async () => {
    const { data: proj } = await admin.from("projects").insert({ constituency_id: A.id, title: "Culvert repair", status: "in_progress" }).select("id,ref").single();
    const ref = proj!.ref;
    as(null); expect((await call(addCheckin, "POST", "/x", { params: refParam(ref), body: { note: "Visited today: work started" } })).status).toBe(401);
    as(citizens[0]);
    expect((await call(addCheckin, "POST", "/x", { params: refParam(ref), body: { note: "no", visited_at: "2020-01-01" } })).status).toBe(422);
    expect((await call(addCheckin, "POST", "/x", { params: refParam(ref), body: { note: "Visited today: work started", visited_at: "2020-01-01" } })).status, "too old").toBe(422);
    const c1 = await call(addCheckin, "POST", "/x", { params: refParam(ref), body: { note: "Visited today: work started, call 01712345678" } });
    expect(c1.status).toBe(201); const id = c1.json.data.id; expect(c1.json.data.label).toBe("citizen_submitted");
    // photo
    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const form = new FormData(); form.append("file", new File([new Uint8Array(jpeg)], "p.jpg", { type: "image/jpeg" }));
    const up = await checkinPhoto(new Request("http://localhost/x", { method: "POST", body: form, headers: { "x-forwarded-for": "10.9.9.9" } }), { params: Promise.resolve({ ref, id }) } as never);
    expect(up.status).toBe(201);
    const form2 = new FormData(); form2.append("file", new File([new Uint8Array(jpeg)], "p.jpg", { type: "image/jpeg" }));
    expect((await checkinPhoto(new Request("http://localhost/x", { method: "POST", body: form2, headers: { "x-forwarded-for": "10.9.9.8" } }), { params: Promise.resolve({ ref, id }) } as never)).status, "once").toBe(409);
    const bad = new FormData(); bad.append("file", new File([new Uint8Array(200).fill(7)], "p.jpg", { type: "image/jpeg" }));
    as(citizens[1]); const c2 = await call(addCheckin, "POST", "/x", { params: refParam(ref), body: { note: "Second visitor, finished the footing" } });
    as(citizens[1]);
    expect((await checkinPhoto(new Request("http://localhost/x", { method: "POST", body: bad, headers: { "x-forwarded-for": "10.9.9.7" } }), { params: Promise.resolve({ ref, id: c2.json.data.id }) } as never)).status, "not an image").toBe(422);
    as(citizens[2]);
    expect((await checkinPhoto(new Request("http://localhost/x", { method: "POST", body: form, headers: { "x-forwarded-for": "10.9.9.6" } }), { params: Promise.resolve({ ref, id }) } as never)).status, "someone else's check-in").toBe(404);
    as(null);
    expect((await call(listCheckins, "GET", "/x", { params: refParam(ref) })).json.data).toHaveLength(0);
    as(citizens[3]); denied((await call(modCheckin, "POST", "/x", { params: idParam(id), body: { action: "approve" } })).status);
    as(mgrB); expect((await call(offCheckins, "GET", "/x", { params: refParam(ref) })).json.data, "other area sees none").toHaveLength(0);
    as(mgr);
    expect((await call(offCheckins, "GET", "/x", { params: refParam(ref) })).json.data).toHaveLength(2);
    expect((await call(modCheckin, "POST", "/x", { params: idParam(id), body: { action: "hide" } })).status, "reason needed").toBe(422);
    expect((await call(modCheckin, "POST", "/x", { params: idParam(id), body: { action: "approve" } })).status).toBe(200);
    expect((await call(respCheckin, "POST", "/x", { params: idParam(id), body: { text: "Thank you, the deck is next" } })).status).toBe(200);
    as(null);
    const pub = await call(listCheckins, "GET", "/x", { params: refParam(ref) });
    expect(pub.json.data).toHaveLength(1);
    expect(pub.json.data[0]).toMatchObject({ label: "citizen_submitted", has_photo: true, office_response: "Thank you, the deck is next" });
    expect(pub.json.data[0].photo_url).toMatch(/^https?:\/\//); expect(pub.json.data[0].note).not.toContain("01712345678");
    const photo = await fetch(pub.json.data[0].photo_url);
    const bytes = Buffer.from(await photo.arrayBuffer());
    expect(photo.status).toBe(200); expect((await sharp(bytes).metadata()).format).toBe("jpeg");
    const { data: p2 } = await admin.from("projects").select("status").eq("id", proj!.id).single();
    expect(p2!.status, "official status untouched").toBe("in_progress");
  });
});

describe("messaging channels: link, webhooks, conversation, cost (B7.2, B7.4)", () => {
  const phone = "+8801711000001", waFrom = "8801711000001";
  let linkId = "", user: TestUser;
  const wa = (id: string, text: string, from = waFrom, type = "text") => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, type, text: { body: text } }] } }] }] });
    return { rawBody: raw, headers: { "x-hub-signature-256": `sha256=${hmacHex(process.env.WHATSAPP_APP_SECRET!, raw)}` } };
  };

  it("the webhook is closed while its flag is off, verifies Meta's handshake and rejects bad signatures", async () => {
    await admin.from("feature_flags").update({ enabled: false }).eq("key", "whatsapp_intake"); clearFlagCache();
    as(null); expect((await call(waHook, "POST", "/x", wa("m0", "hi"))).status).toBe(404);
    await admin.from("feature_flags").update({ enabled: true }).eq("key", "whatsapp_intake"); clearFlagCache();
    expect((await call(waVerify, "GET", "/x?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc")).status).toBe(403);
    const ok = await waVerify(new Request("http://localhost/x?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123"));
    expect(ok.status).toBe(200); expect(await ok.text()).toBe("abc123");
    expect((await call(waHook, "POST", "/x", { rawBody: "{}" })).status, "no signature").toBe(401);
    const good = wa("m1", "hi");
    expect((await call(waHook, "POST", "/x", { rawBody: good.rawBody, headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) } })).status, "wrong signature").toBe(401);
    expect((await call(smsHook, "POST", "/x", { rawBody: '{"id":"1","from":"+8801700000000","text":"hi"}' })).status).toBe(401);
  });

  it("linking needs consent, shows only a hint, and a message from an unknown number creates nothing", async () => {
    user = citizens[0]; sent.length = 0; setChannelProviderForTests("whatsapp", fakeProvider);
    as(user);
    expect((await call(startLink, "POST", "/x", { body: { channel: "whatsapp", address: phone } })).status, "consent required").toBe(422);
    expect((await call(startLink, "POST", "/x", { body: { channel: "whatsapp", address: "12345", accept_privacy: true } })).status).toBe(422);
    const s = await call(startLink, "POST", "/x", { body: { channel: "whatsapp", address: phone, accept_privacy: true } });
    expect(s.status).toBe(201); expect(s.json.data.code).toMatch(/^JK\d{6}$/); linkId = s.json.data.id;
    const mine = await call(myChannels, "GET", "/x");
    expect(mine.json.data).toHaveLength(1); expect(JSON.stringify(mine.json.data)).not.toMatch(/8801711|code_hash|address"/);
    // unknown number
    as(null);
    const before = (await admin.from("issues").select("id", { count: "exact", head: true })).count;
    const r1 = await call(waHook, "POST", "/x", wa("m-unk", "রাস্তায় গর্ত", "8801799999999"));
    expect(r1.status).toBe(200);
    expect(sent.at(-1)!.text).toMatch(/লিংক|যুক্ত নয়|not linked/);
    expect((await admin.from("issues").select("id", { count: "exact", head: true })).count).toBe(before);
    const { data: stored } = await admin.from("channel_messages").select("body,link_id").eq("provider_message_id", "m-unk").single();
    expect(stored).toEqual({ body: null, link_id: null });
    // the code from the wrong number does not link; from the right number it does and the privacy notice comes first
    const wrongNumber = await call(waHook, "POST", "/x", wa("m-wrong", `my code ${s.json.data.code}`, "8801788888888"));
    expect(wrongNumber.status).toBe(200);
    expect((await admin.from("channel_links").select("status").eq("id", linkId).single()).data!.status).toBe("pending");
    sent.length = 0;
    expect((await call(waHook, "POST", "/x", wa("m-code", `${s.json.data.code}`))).status).toBe(200);
    expect((await admin.from("channel_links").select("status").eq("id", linkId).single()).data!.status).toBe("active");
    expect(sent).toHaveLength(1); expect(sent[0].text).toMatch(/৯০ দিন/);
  });

  it("text becomes a draft, nothing is created until 'হ্যাঁ', a repeated delivery is ignored, and the case has the app's reference and rules", async () => {
    as(null); sent.length = 0;
    const issues = async () => (await admin.from("issues").select("ref,source_channel,reporter_id,constituency_id").eq("reporter_id", user.id));
    expect((await issues()).data).toHaveLength(0);
    const d = await call(waHook, "POST", "/x", wa("m-draft", "আমাদের পাড়ার রাস্তায় বড় গর্ত, রাতে দুর্ঘটনা হচ্ছে। ফোন 01712345678"));
    expect(d.status).toBe(200);
    expect(sent.at(-1)!.text).toMatch(/খসড়া/);
    expect((await issues()).data, "nothing created yet").toHaveLength(0);
    const { data: conv } = await admin.from("channel_conversations").select("state,draft").eq("link_id", linkId).single();
    expect(conv!.state).toBe("awaiting_confirm"); expect(JSON.stringify(conv!.draft)).not.toContain("01712345678");
    const n0 = sent.length;
    await call(waHook, "POST", "/x", wa("m-draft", "আমাদের পাড়ার রাস্তায় বড় গর্ত"));   // provider retry
    expect(sent.length, "duplicate delivery is ignored").toBe(n0);
    const yes = await call(waHook, "POST", "/x", wa("m-yes", "হ্যাঁ"));
    expect(yes.status).toBe(200);
    const made = (await issues()).data!;
    expect(made).toHaveLength(1); expect(made[0]).toMatchObject({ source_channel: "whatsapp", constituency_id: A.id });
    expect(made[0].ref).toMatch(/^JK-/);
    expect(sent.at(-1)!.text).toContain(made[0].ref);
    expect((await admin.from("channel_conversations").select("state").eq("link_id", linkId).single()).data!.state).toBe("idle");
    const again = await call(waHook, "POST", "/x", wa("m-yes2", "হ্যাঁ"));    // "yes" with no draft is just a new (short) message, not a second case
    expect(again.status).toBe(200); expect((await issues()).data).toHaveLength(1);
    // cancel
    await call(waHook, "POST", "/x", wa("m-d2", "বাজারে নর্দমা উপচে পড়ছে")); await call(waHook, "POST", "/x", wa("m-no", "না"));
    expect((await issues()).data).toHaveLength(1);
    expect(sent.at(-1)!.text).toMatch(/বাতিল/);
    // images are not accepted yet
    await call(waHook, "POST", "/x", wa("m-img", "", waFrom, "image")); expect(sent.at(-1)!.text).toMatch(/ছবি/);
    // imminent harm: fixed guidance, no draft, nothing created
    await call(waHook, "POST", "/x", wa("m-em", "আমি আর বাঁচতে চাই না, নিজেকে শেষ করে দেব"));
    expect(sent.at(-1)!.text).toMatch(/999|৯৯৯/);
    expect((await admin.from("channel_conversations").select("state").eq("link_id", linkId).single()).data!.state).toBe("idle");
    expect((await issues()).data).toHaveLength(1);
  });

  it("updates and office replies go back on the same channel only within preferences; the SMS webhook follows the same rules", async () => {
    const { data: iss } = await admin.from("issues").select("id,ref").eq("reporter_id", user.id).eq("source_channel", "whatsapp").single();
    as(user);
    expect((await call(putPrefs, "PUT", "/x", { body: { channels: { whatsapp: true, sms: false }, muted_types: ["area_alert", "consultation_opened"] } })).json.data.channels).toMatchObject({ whatsapp: true, sms: false });
    expect((await call(putPrefs, "PUT", "/x", { body: { muted_types: ["not_a_type"] } })).status).toBe(422);
    await call(putPrefs, "PUT", "/x", { body: { muted_types: [] } });
    await admin.from("issue_events").insert({ issue_id: iss!.id, actor_id: mgr.id, event_type: "note", public_message: "Our engineer will visit on Sunday", is_public: true }).throwOnError();
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", user.id).eq("type", "channel_reply");
    expect(n).toHaveLength(1);
    sent.length = 0;
    const out = await deliverDue(50);
    expect(out!.claimed).toBeGreaterThan(0);
    expect(sent.some((m) => m.to === phone && m.text.includes(iss!.ref))).toBe(true);
    expect(sent.every((m) => !/Sunday/.test(m.text)), "no case content in the message").toBe(true);
    const { data: msgs } = await admin.from("channel_messages").select("direction,status,segments").eq("direction", "out").eq("status", "sent");
    expect(msgs!.length).toBeGreaterThan(0);
    // SMS channel: link a second number and use the SMS webhook
    as(citizens[1]); setChannelProviderForTests("sms", fakeProvider);
    const s = await call(startLink, "POST", "/x", { body: { channel: "sms", address: "+8801711000002", accept_privacy: true } });
    const smsBody = (id: string, text: string) => { const raw = JSON.stringify({ id, from: "+8801711000002", text }); return { rawBody: raw, headers: { "x-signature": hmacHex(process.env.SMS_WEBHOOK_SECRET!, raw) } }; };
    as(null); sent.length = 0;
    expect((await call(smsHook, "POST", "/x", { rawBody: "nope", headers: { "x-signature": hmacHex(process.env.SMS_WEBHOOK_SECRET!, "nope") } })).status, "not JSON").toBe(400);
    expect((await call(smsHook, "POST", "/x", smsBody("s1", s.json.data.code))).json.data.action).toBe("linked");
    expect((await call(smsHook, "POST", "/x", smsBody("s2", "বাজারের সামনে রাস্তা ভাঙা"))).json.data.action).toBe("draft_sent");
    expect(sent.every((m) => m.text.length <= 300)).toBe(true);
    expect((await call(smsHook, "POST", "/x", smsBody("s3", "yes"))).json.data.action).toBe("created");
    const { data: smsIssue } = await admin.from("issues").select("source_channel").eq("reporter_id", citizens[1].id).single();
    expect(smsIssue!.source_channel).toBe("sms");
  });

  it("administrators see costs (known prices only) and set budgets; link controls: pause updates, revoke deletes the number", async () => {
    as(citizens[2]); expect((await call(costs, "GET", "/x")).status).toBe(403);
    expect((await call(budget, "PUT", "/x", { body: { channel: "sms", budget_usd: 10 } })).status).toBe(403);
    as(adminU);
    expect((await call(budget, "PUT", "/x", { body: { channel: "sms", budget_usd: -1 } })).status).toBe(422);
    expect((await call(budget, "PUT", "/x", { body: { channel: "sms", budget_usd: 10 } })).status).toBe(200);
    const c = await call(costs, "GET", "/x");
    const sms = c.json.data.channels.find((x: { channel: string }) => x.channel === "sms");
    expect(sms.budget_usd).toBe(10); expect(sms.messages_without_known_cost).toBeGreaterThan(0);   // no price configured: counted, never guessed
    expect(Number(sms.spend_usd)).toBe(0);
    as(user);
    expect((await call(patchLink, "PATCH", "/x", { params: idParam(linkId), body: { updates_enabled: false } })).status).toBe(200);
    expect((await call(patchLink, "PATCH", "/x", { params: idParam(linkId), body: { extra: 1 } })).status).toBe(422);
    as(citizens[3]); expect((await call(revokeLink, "DELETE", "/x", { params: idParam(linkId) })).status, "not your link").toBe(404);
    as(user); expect((await call(revokeLink, "DELETE", "/x", { params: idParam(linkId) })).status).toBe(200);
    const { data: l } = await admin.from("channel_links").select("address,status").eq("id", linkId).single();
    expect(l).toEqual({ address: null, status: "revoked" });
    as(null);
    sent.length = 0; await call(waHook, "POST", "/x", wa("m-after", "রাস্তা ভাঙা"));
    expect(sent.at(-1)!.text, "a revoked number is unknown again").toMatch(/যুক্ত নয়|not linked/);
  });

  it("sends pause when the monthly budget is used up, but the confirmation of a case the person asked for still goes", async () => {
    const { sendChannelText } = await import("../../src/lib/channels/send");
    setChannelProviderForTests("sms", fakeProvider);
    await admin.from("channel_budgets").upsert({ channel: "sms", month: new Date().toISOString().slice(0, 8) + "01", budget_usd: 1 });
    await admin.from("channel_messages").insert({ channel: "sms", direction: "out", status: "sent", cost_usd: 2 });
    sent.length = 0;
    expect(await sendChannelText(svc(), { channel: "sms", linkId: null, to: "+8801711000002", text: "update", essential: false })).toBe("skipped_budget");
    expect(await sendChannelText(svc(), { channel: "sms", linkId: null, to: "+8801711000002", text: "confirmation", essential: true })).toBe("sent");
    expect(sent).toHaveLength(1);
    setChannelProviderForTests("sms", null);
    expect(await sendChannelText(svc(), { channel: "sms", linkId: null, to: "+8801711000002", text: "x", essential: true })).toBe("skipped_not_configured");
  });
});

describe("area alerts (B7.4)", () => {
  it("office with publish sends; followers are told; public list; limits", async () => {
    as(citizens[0]); denied((await call(postAlert, "POST", "/x", { body: { constituency: A.key, title_bn: "পানির লাইন বন্ধ থাকবে" } })).status);
    as(officer); denied((await call(postAlert, "POST", "/x", { body: { constituency: A.key, title_bn: "পানির লাইন বন্ধ থাকবে" } })).status);
    as(mgr);
    expect((await call(postAlert, "POST", "/x", { body: { constituency: A.key, title_bn: "ab" } })).status).toBe(422);
    const r = await call(postAlert, "POST", "/x", { body: { constituency: A.key, title_bn: "পানির লাইন বন্ধ থাকবে", title_en: "Water line closed", body: "সকাল ৯টা থেকে ৩টা" } });
    expect(r.status).toBe(201); expect(r.json.data.recipients).toBe(11);
    expect((await call(postAlert, "POST", "/x", { body: { constituency: A.key, title_bn: "দ্বিতীয় সতর্কবার্তা আজ" } })).status).toBe(201);
    expect((await call(postAlert, "POST", "/x", { body: { constituency: A.key, title_bn: "তৃতীয় সতর্কবার্তা আজ" } })).status, "2 a day").toBe(409);
    as(null);
    const list = await call(getAlerts, "GET", `/api/v1/area-alerts?constituency=${A.key}`);
    expect(list.json.data).toHaveLength(2);
    expect((await call(getAlerts, "GET", "/api/v1/area-alerts")).status, "constituency required").toBe(422);
  });
});

describe("surveys, satisfaction, commitments, priorities (B7.6-B7.8)", () => {
  it("surveys: office creates and opens; citizens answer once; results appear after closing with 5+ answers", async () => {
    as(citizens[0]); expect((await call(offCreateSurvey, "POST", "/x", { body: {} })).status).toBe(422);
    as(mgr);
    const q = [{ kind: "rating", prompt: "How satisfied are you with road repair?" }, { kind: "choice", prompt: "Which road next?", options: ["Main road", "Market lane"] }];
    expect((await call(offCreateSurvey, "POST", "/x", { body: { constituency: A.key, title: "Road survey", questions: [{ kind: "text", prompt: "Free text is not allowed" }] } })).status).toBe(422);
    const made = await call(offCreateSurvey, "POST", "/x", { body: { constituency: A.key, title: "Road repair survey", questions: q } });
    expect(made.status).toBe(201); const ref = made.json.data.ref;
    expect((await call(offSurveys, "GET", "/x")).json.data.map((s: { ref: string }) => s.ref)).toContain(ref);
    as(null); expect((await call(getSurvey, "GET", "/x", { params: refParam(ref) })).status, "draft is not public").toBe(404);
    as(mgr); expect((await call(surveyStatus, "POST", "/x", { params: refParam(ref), body: { status: "open" } })).json.data.status).toBe("open");
    as(null);
    const detail = await call(getSurvey, "GET", "/x", { params: refParam(ref) });
    const qs = detail.json.data.questions; expect(qs).toHaveLength(2);
    expect((await call(listSurveys, "GET", `/api/v1/surveys?constituency=${A.key}`)).json.data.map((s: { ref: string }) => s.ref)).toContain(ref);
    as(citizens[0]);
    expect((await call(answerSurvey, "POST", "/x", { params: refParam(ref), body: { answers: { [qs[0].id]: 9, [qs[1].id]: "Main road" } } })).status).toBe(422);
    expect((await call(answerSurvey, "POST", "/x", { params: refParam(ref), body: { answers: { [qs[0].id]: 5 } } })).status, "every question").toBe(422);
    for (let i = 0; i < 5; i++) { as(citizens[i]); expect((await call(answerSurvey, "POST", "/x", { params: refParam(ref), body: { answers: { [qs[0].id]: 3 + (i % 3), [qs[1].id]: "Main road" } } })).status).toBe(201); }
    expect((await call(answerSurvey, "POST", "/x", { params: refParam(ref), body: { answers: { [qs[0].id]: 3, [qs[1].id]: "Main road" } } })).status, "once").toBe(409);
    as(null);
    expect((await call(surveyRes, "GET", "/x", { params: refParam(ref) })).json.data.results_shown, "hidden while open").toBe(false);
    as(mgr); expect((await call(surveyRes, "GET", "/x", { params: refParam(ref) })).json.data.results_shown).toBe(true);
    await call(surveyStatus, "POST", "/x", { params: refParam(ref), body: { status: "closed" } });
    as(null);
    const res = await call(surveyRes, "GET", "/x", { params: refParam(ref) });
    expect(res.json.data).toMatchObject({ results_shown: true, respondents: 5 });
    expect(res.json.data.questions[1].counts).toEqual({ "Main road": 5 });
  });

  it("satisfaction summary is public and hidden under 5 ratings", async () => {
    as(null);
    expect((await call(satisfaction, "GET", `/api/v1/analytics/satisfaction?constituency=${A.key}`)).json.data).toMatchObject({ suppressed: true, average: null });
    const { data: issues } = await admin.from("issues").insert(Array.from({ length: 5 }, (_, i) => ({ reporter_id: citizens[i].id, title: "t", category: "roads", description: "d", constituency_id: A.id }))).select("id,reporter_id");
    await admin.from("issue_feedback").insert(issues!.map((i, k) => ({ issue_id: i.id, user_id: i.reporter_id, rating: k < 3 ? 5 : 3 }))).throwOnError();
    const r = await call(satisfaction, "GET", `/api/v1/analytics/satisfaction?constituency=${A.key}&days=30`);
    expect(r.json.data).toMatchObject({ ratings: 5, suppressed: false, average: 4.2 });
    expect((await call(satisfaction, "GET", `/api/v1/analytics/satisfaction?constituency=${A.key}&days=0`)).status).toBe(422);
  });

  it("commitments: evidence and reasons, links in the area, history is public, MP rule", async () => {
    const { data: proj } = await admin.from("projects").insert({ constituency_id: A.id, title: "Market road project", status: "planned" }).select("ref").single();
    as(citizens[0]); denied((await call(offCreateCommit, "POST", "/x", { body: { constituency: A.key, title: "Repair the market road" } })).status);
    as(mgr);
    expect((await call(offCreateCommit, "POST", "/x", { body: { constituency: A.key, title: "Repair the market road", project_ref: "PR-9999-1", publish: true } })).status, "unknown link").toBe(422);
    const made = await call(offCreateCommit, "POST", "/x", { body: { constituency: A.key, title: "Repair the market road", description: "Before the next monsoon", due_date: "2027-06-30", project_ref: proj!.ref, publish: true } });
    expect(made.status).toBe(201); const ref = made.json.data.ref; expect(made.json.data.status).toBe("planned");
    expect((await call(offCommits, "GET", "/x")).json.data.map((m: { ref: string }) => m.ref)).toContain(ref);
    expect((await call(commitStatus, "POST", "/x", { params: refParam(ref), body: { status: "delivered" } })).status, "evidence").toBe(422);
    expect((await call(commitStatus, "POST", "/x", { params: refParam(ref), body: { status: "delayed", note: "short" } })).status, "reason").toBe(422);
    expect((await call(commitStatus, "POST", "/x", { params: refParam(ref), body: { status: "delivered", evidence_url: "http://insecure.example/x" } })).status, "https only").toBe(422);
    expect((await call(commitStatus, "POST", "/x", { params: refParam(ref), body: { status: "delayed", note: "The contractor withdrew; a new tender is open." } })).status).toBe(200);
    expect((await call(commitStatus, "POST", "/x", { params: refParam(ref), body: { status: "delivered", evidence_url: "https://example.org/road-finished.jpg" } })).status).toBe(200);
    as(null);
    const pub = await call(getCommit, "GET", "/x", { params: refParam(ref) });
    expect(pub.json.data).toMatchObject({ status: "delivered", label: "office_commitment", project_ref: proj!.ref });
    expect(pub.json.data.history.map((h: { to_status: string }) => h.to_status)).toEqual(["planned", "delayed", "delivered"]);
    expect((await call(listCommit, "GET", `/api/v1/commitments?constituency=${A.key}&status=delivered`)).json.data).toHaveLength(1);
    // MP rule
    await admin.from("constituencies").update({ mp_approval_required: true }).eq("id", A.id);
    as(mgr);
    const w = await call(offCreateCommit, "POST", "/x", { body: { constituency: A.key, title: "Build a school drain", publish: true } });
    expect(w.json.data.status).toBe("pending_approval");
    as(null); expect((await call(getCommit, "GET", "/x", { params: refParam(w.json.data.ref) })).status).toBe(404);
    as(mgr); denied((await call(commitDecision, "POST", "/x", { params: refParam(w.json.data.ref), body: { decision: "approve" } })).status);
    as(mp); expect((await call(commitDecision, "POST", "/x", { params: refParam(w.json.data.ref), body: { decision: "approve" } })).json.data.status).toBe("planned");
    await admin.from("constituencies").update({ mp_approval_required: false }).eq("id", A.id);
  });

  it("priorities: non-binding, verified local accounts only, one ranking per person, aggregate points after closing", async () => {
    as(mgr);
    expect((await call(offCreateRound, "POST", "/x", { body: { constituency: A.key, title: "What matters most?", items: ["Roads", "Drains"] } })).status).toBe(422);
    const made = await call(offCreateRound, "POST", "/x", { body: { constituency: A.key, title: "What matters most?", items: ["Roads", "Drains", "Lighting", "Schools"] } });
    expect(made.status).toBe(201); expect(made.json.data.label).toBe("non_binding"); const ref = made.json.data.ref;
    expect((await call(offRounds, "GET", "/x")).json.data.map((r: { ref: string }) => r.ref)).toContain(ref);
    await call(roundStatus, "POST", "/x", { params: refParam(ref), body: { status: "open" } });
    as(null);
    const detail = await call(getRound, "GET", "/x", { params: refParam(ref) });
    const items = detail.json.data.items.map((i: { id: string }) => i.id); expect(detail.json.data.label).toBe("non_binding");
    expect((await call(listRounds, "GET", `/api/v1/priorities?constituency=${A.key}`)).json.data).toHaveLength(1);
    const outsider = await makeUser("citizen");
    as(outsider); expect((await call(ranking, "PUT", "/x", { params: refParam(ref), body: { items: [items[0]] } })).status, "not following the area").toBe(403);
    as(citizens[0]); expect((await call(ranking, "PUT", "/x", { params: refParam(ref), body: { items: [items[0], items[0]] } })).status).toBe(422);
    expect((await call(ranking, "PUT", "/x", { params: refParam(ref), body: { items: [] } })).status).toBe(422);
    for (let i = 0; i < 5; i++) { as(citizens[i]); expect((await call(ranking, "PUT", "/x", { params: refParam(ref), body: { items: [items[i % 2], items[2]] } })).status).toBe(200); }
    as(citizens[0]); await call(ranking, "PUT", "/x", { params: refParam(ref), body: { items: [items[3]] } });
    expect((await admin.from("priority_ranks").select("rank").eq("user_id", citizens[0].id)).data).toHaveLength(1);
    as(null); expect((await call(roundResults, "GET", "/x", { params: refParam(ref) })).json.data.results_shown).toBe(false);
    as(mgr);
    const staff = await call(roundResults, "GET", "/x", { params: refParam(ref) });
    expect(staff.json.data).toMatchObject({ participants: 5, results_shown: true, label: "non_binding" });
    await call(roundStatus, "POST", "/x", { params: refParam(ref), body: { status: "closed" } });
    as(null);
    const pub = await call(roundResults, "GET", "/x", { params: refParam(ref) });
    expect(pub.json.data.results_shown).toBe(true); expect(pub.json.data.note).toMatch(/Non-binding/);
    expect(JSON.stringify(pub.json.data)).not.toMatch(/user_id/);
    await admin.auth.admin.deleteUser(outsider.id);
  });
});

describe("briefs, exports, heatmaps, KPIs, read-aloud, jobs (B7.9-B7.13)", () => {
  it("weekly briefs: the job makes drafts, reviewers see and approve them, others cannot", async () => {
    const out = await runWeeklyBriefs(svc());
    expect(out.created).toBeGreaterThanOrEqual(2);       // both test areas have an active office
    as(citizens[0]); expect((await call(offBriefs, "GET", "/x")).json.data).toHaveLength(0);
    as(officer); expect((await call(offBriefs, "GET", "/x")).json.data, "no analytics right").toHaveLength(0);
    as(mgrB); expect((await call(offBriefs, "GET", "/x")).json.data.every((b: { constituency: string }) => b.constituency === B.key)).toBe(true);
    as(mgr);
    const list = await call(offBriefs, "GET", "/x");
    expect(list.json.data).toHaveLength(1); const b = list.json.data[0];
    expect(b).toMatchObject({ constituency: A.key, status: "draft" }); expect(Object.keys(b.payload)).toContain("top_categories");
    expect((await runWeeklyBriefs(svc())).created, "one per area per week").toBe(0);
    as(officer); expect((await call(reviewBrief, "POST", "/x", { params: idParam(b.id), body: { decision: "approve", narrative: "A reviewed weekly note" } })).status).toBe(404);
    as(mgr);
    expect((await call(reviewBrief, "POST", "/x", { params: idParam(b.id), body: { decision: "approve" } })).status, "no text, no AI draft").toBe(422);
    expect((await call(reviewBrief, "POST", "/x", { params: idParam(b.id), body: { decision: "approve", narrative: "A reviewed weekly note for the office" } })).json.data.status).toBe("approved");
    as(mp); expect((await call(offBriefs, "GET", "/x")).json.data[0]).toMatchObject({ status: "approved", narrative: "A reviewed weekly note for the office" });
  });

  it("exports: CSV with BOM and the right headers, print HTML, permission and audit", async () => {
    await admin.from("issues").insert([{ reporter_id: citizens[0].id, title: "=cmd()", category: "roads", description: "secret words", constituency_id: A.id }]);
    const get = (q: string) => exportGet(new Request(`http://localhost/api/v1/office/exports?${q}`, { headers: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.1` } }));
    as(citizens[0]); denied((await get(`kind=cases&constituency=${A.key}`)).status);
    as(officer); denied((await get(`kind=cases&constituency=${A.key}`)).status);
    as(mgrB); expect((await get(`kind=cases&constituency=${A.key}`)).status, "other area").toBe(404);
    as(mgr);
    expect((await get(`kind=secrets&constituency=${A.key}`)).status).toBe(422);
    const csv = await get(`kind=cases&constituency=${A.key}&days=30`);
    expect(csv.status).toBe(200); expect(csv.headers.get("content-type")).toMatch(/text\/csv/); expect(csv.headers.get("content-disposition")).toMatch(/attachment; filename="jonokotha-.*\.csv"/);
    const bytes = new Uint8Array(await csv.arrayBuffer());
    expect([...bytes.slice(0, 3)], "UTF-8 byte-order mark").toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text).toMatch(/^\uFEFFref,category,status,source_channel,created_at,resolved_at,public\r\n/);
    expect(text).not.toMatch(/secret words|=cmd/);
    const ideas = await get(`kind=ideas&constituency=${A.key}`); expect((await ideas.text()).split("\r\n")[0]).toContain("response_state");
    const html = await get(`kind=cases&constituency=${A.key}&format=html`);
    expect(html.headers.get("content-type")).toMatch(/text\/html/); expect(await html.text()).toContain('lang="bn"');
    const { data: aud } = await admin.from("audit_logs").select("after_data").eq("action", "export.office").eq("resource_id", A.key);
    expect(aud!.length).toBeGreaterThanOrEqual(3); expect(aud![0].after_data).toMatchObject({ kind: expect.any(String), rows: expect.any(Number) });
  });

  it("heatmap and clusters: cells under 5 issues never appear; offices only for clusters", async () => {
    const mk = (n: number, lat: number, lng: number) => Array.from({ length: n }, () => ({ reporter_id: citizens[0].id, title: "t", category: "drainage", description: "d", constituency_id: B.id, lat, lng, public_lat: lat, public_lng: lng, public_visibility: true, location_source: "device" }));
    await admin.from("issues").insert([...mk(6, 23.8103, 90.4125), ...mk(3, 23.95, 90.7)]).throwOnError();
    as(null);
    const h = await call(heatmap, "GET", `/api/v1/analytics/heatmap?constituency=${B.key}&days=30`);
    expect(h.status).toBe(200); expect(h.json.data.cells).toHaveLength(1); expect(h.json.data.cells[0]).toMatchObject({ count: 6, top_category: "drainage" });
    expect(h.json.data.cells_hidden).toBe(1); expect(JSON.stringify(h.json.data.cells)).not.toContain("23.8103");
    expect(h.headers.get("cache-control")).toMatch(/public/);
    expect((await call(heatmap, "GET", `/api/v1/analytics/heatmap?constituency=${B.key}&cell_m=100`)).status).toBe(422);
    expect((await call(heatmap, "GET", `/api/v1/analytics/heatmap?constituency=${B.key}&category=Bad;Cat`)).status).toBe(422);
    expect((await call(clusters, "GET", `/api/v1/office/analytics/clusters?constituency=${B.key}`)).status).toBe(401);
    as(citizens[0]); expect((await call(clusters, "GET", `/api/v1/office/analytics/clusters?constituency=${B.key}`)).status).toBe(404);
    as(mgrB);
    const o = await call(clusters, "GET", `/api/v1/office/analytics/clusters?constituency=${B.key}&cell_m=250`);
    expect(o.json.data.cells.every((c: { count: number }) => c.count >= 5)).toBe(true);
    expect(o.json.data.category_clusters).toEqual([{ category: "drainage", count: 9 }]);
    as(mgr); expect((await call(clusters, "GET", `/api/v1/office/analytics/clusters?constituency=${B.key}`)).status, "other area").toBe(404);
  });

  it("Release 1.1 KPIs: office for its area, administrators platform-wide, each with a definition", async () => {
    as(mgr);
    const k = await call(offKpis, "GET", `/api/v1/office/kpis/release-1-1?constituency=${A.key}&days=90`);
    expect(k.status).toBe(200);
    expect(k.json.data.kpis.consultation_participants).toMatchObject({ value: 10 });
    expect(k.json.data.kpis.consultation_report_rate.value).toBe(1);
    expect(k.json.data.kpis.idea_threshold_on_time).toMatchObject({ value: 0, n: 1 });
    expect(k.json.data.kpis.channel_intake_share.definition).toBeTruthy();
    expect((await call(offKpis, "GET", "/x")).status, "office route needs an area").toBe(403);
    as(mgrB); expect((await call(offKpis, "GET", `/api/v1/office/kpis/release-1-1?constituency=${A.key}`)).status).toBe(404);
    as(adminU);
    expect((await call(adminKpis, "GET", "/api/v1/admin/kpis/release-1-1")).json.data.kpis.area_alerts_sent.value).toBeGreaterThanOrEqual(2);
    as(mgr); expect((await call(adminKpis, "GET", "/api/v1/admin/kpis/release-1-1")).status).toBe(403);
    as(citizens[0]); expect((await call(adminKpis, "GET", "/api/v1/admin/kpis/release-1-1")).status).toBe(403);
  });

  it("read-aloud: configuration is public; audio needs a provider and a signed-in person; personal data is removed first", async () => {
    as(null);
    setTtsProviderForTests(null);
    expect((await call(speakCfg, "GET", "/x")).json.data).toMatchObject({ available: false, fallback: "browser_speech_synthesis", lang: "bn-BD" });
    as(citizens[0]);
    const none = await call(speakPost, "POST", "/x", { body: { text: "নমস্কার" } });
    expect(none.status).toBe(503); expect(none.json.field_errors?._).toBe("tts_not_configured");
    let seen = "";
    setTtsProviderForTests({ speak: async (t) => { seen = t; return { ok: true, audio: new Uint8Array([73, 68, 51]), contentType: "audio/mpeg" }; } });
    const res = await speakPost(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ text: "অফিসের উত্তর: ফোন 01712345678" }), headers: { "content-type": "application/json", "x-forwarded-for": "10.7.7.7" } }));
    expect(res.status).toBe(200); expect(res.headers.get("content-type")).toBe("audio/mpeg"); expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([73, 68, 51]));
    expect(seen).not.toContain("01712345678");
    expect((await call(speakPost, "POST", "/x", { body: { text: "ক".repeat(1201) } })).status).toBe(422);
    as(null); expect((await call(speakPost, "POST", "/x", { body: { text: "hi" } })).status).toBe(401);
  });

  it("maintenance job: due consultations, surveys and rounds close; idea reminders run; old messages and erased files are cleaned", async () => {
    as(mgr);
    const made = await call(offCreateCons, "POST", "/x", { body: { constituency: A.key, question: "A short-lived question here?", seed_statements: ["First statement here", "Second statement here"], closes_at: future(1) } });
    await call(consStatus, "POST", "/x", { params: refParam(made.json.data.ref), body: { action: "open" } });
    await admin.from("consultations").update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq("ref", made.json.data.ref);
    await admin.from("channel_messages").insert({ channel: "sms", direction: "in", created_at: new Date(Date.now() - 100 * 86400_000).toISOString() });
    await admin.from("pending_file_deletions").insert({ bucket: "project-checkins", path: "nothing/here.jpg" });
    const out = await runRelease11Maintenance(svc());
    expect(out.consultations_closed).toBeGreaterThanOrEqual(1); expect(out.channel_messages_purged).toBeGreaterThanOrEqual(1);
    expect(out.files_deleted).toBeGreaterThanOrEqual(1);
    expect((await admin.from("consultations").select("status").eq("ref", made.json.data.ref).single()).data!.status).toBe("closed");
  });
});
