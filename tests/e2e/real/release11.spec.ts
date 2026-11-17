import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, buildWorld, dropWorld, gotoOk, localEnv, sessionFor, skipUnlessReal, type Account, type World } from "./support";

/**
 * §21.3 scenarios 16 and 17 (Release 1.1), on the real API: no mocks.
 * Needs the backend Phase 7 migrations (0070-0074) and the flags on (`GET /features`). Without them the whole file skips with a reason.
 * Written 2026-11-17 against docs/api-v1.md "Phase 7"; not yet run (no Docker on the frontend machine), so expect small fixes on a first run.
 */
test.describe.configure({ mode: "serial" });

let w: World;
let office: BrowserContext, citizenA: BrowserContext, citizenB: BrowserContext, visitor: BrowserContext;
const extra: { acct: Account; ctx: BrowserContext }[] = [];
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

test.beforeAll(async ({ browser }, info) => {
  test.setTimeout(120_000);   // twelve sign-ins and a world: more than the 30 s default
  skipUnlessReal();
  w = await buildWorld(info);
  [office, citizenA, citizenB, visitor] = await Promise.all([sessionFor(browser, info, w.accounts.officeA), sessionFor(browser, info, w.accounts.citizenA), sessionFor(browser, info, w.accounts.citizenB), sessionFor(browser, info, null)]);
  const feats = await api(visitor.request, "GET", "/features");
  const on = new Set<string>(((feats.json.data ?? []) as { key: string; enabled: boolean }[]).filter((f) => f.enabled).map((f) => f.key));
  test.skip(!on.has("consultations") || !on.has("idea_threshold"), "backend Phase 7 (migrations 0070-0074) is not on this local database");
  // Eight more verified citizens, so a consultation can reach the minimum group size of 5.
  const env = localEnv();
  const admin = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = Date.now().toString(36);
  for (let i = 0; i < 8; i++) {
    const email = `e2e-r11-${i}-${run}@example.test`, password = `E2e-${run}-Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    const acct: Account = { who: "citizenA", id: data.user.id, email, password };
    extra.push({ acct, ctx: await sessionFor(browser, info, acct) });
  }
});
test.afterAll(async () => {
  await Promise.all([office?.close(), citizenA?.close(), citizenB?.close(), visitor?.close(), ...extra.map((e) => e.ctx.close())]);
  if (w) {
    for (const e of extra) await w.admin.auth.admin.deleteUser(e.acct.id);
    await dropWorld(w);
  }
});

test("16. a consultation shows only aggregate groups above the minimum size; one vote per citizen per statement", async () => {
  const create = await api(office.request, "POST", "/office/consultations", { constituency: w.A.key, question: "এই ওয়ার্ডে আগে কোন কাজ দরকার?", seed_statements: ["রাস্তা মেরামত আগে হোক", "রাতে বাতির ব্যবস্থা হোক", "নালা পরিষ্কার আগে হোক"], closes_at: day(7) });
  expect(create.status, JSON.stringify(create.json)).toBe(201);
  const ref = create.json.data.ref as string;
  const opened = await api(office.request, "POST", `/office/consultations/${ref}/status`, { action: "open" });
  expect(opened.status, JSON.stringify(opened.json)).toBe(200);

  // Two voters first: the public count is hidden (under 5), and no per-statement counts are public before the report.
  const voters = [citizenA, citizenB];
  const detail = await api(voters[0].request, "GET", `/consultations/${ref}`);
  expect(detail.status).toBe(200);
  const ids = (detail.json.data.statements as { id: string }[]).map((s) => s.id);
  expect(ids).toHaveLength(3);
  for (const [i, c] of voters.entries()) for (const id of ids) expect((await api(c.request, "PUT", `/consultations/${ref}/statements/${id}/vote`, { vote: i === 0 ? "agree" : "disagree" })).status).toBe(200);
  const afterTwo = await api(visitor.request, "GET", `/consultations/${ref}`);
  expect(afterTwo.json.data.participant_count).toBeNull();
  expect(JSON.stringify(afterTwo.json.data.statements)).not.toMatch(/agree_pct|votes|agree_count/);

  // One vote per statement: voting again changes the answer, it does not add a second one.
  expect((await api(citizenA.request, "PUT", `/consultations/${ref}/statements/${ids[0]}/vote`, { vote: "disagree" })).status).toBe(200);
  const mine = await api(citizenA.request, "GET", `/consultations/${ref}`);
  expect((mine.json.data.statements as { id: string; my_vote: string }[]).find((s) => s.id === ids[0])?.my_vote).toBe("disagree");
  expect(mine.json.data.next_statement_id).toBeNull();   // all three answered: nothing left to show

  // A visitor cannot vote.
  expect((await api(visitor.request, "PUT", `/consultations/${ref}/statements/${ids[0]}/vote`, { vote: "agree" })).status).toBeGreaterThanOrEqual(400);

  // Eight more citizens vote (ten in all), then the office closes, drafts and publishes.
  for (const [n, e] of extra.entries()) for (const [j, id] of ids.entries()) expect((await api(e.ctx.request, "PUT", `/consultations/${ref}/statements/${id}/vote`, { vote: (n + j) % 3 === 0 ? "agree" : (n + j) % 3 === 1 ? "disagree" : "pass" })).status).toBe(200);
  expect((await api(office.request, "POST", `/office/consultations/${ref}/status`, { action: "close" })).status).toBe(200);
  const draft = await api(office.request, "POST", `/office/consultations/${ref}/summary`, { generate_narrative: false });
  expect(draft.status, JSON.stringify(draft.json)).toBe(201);
  const pub = await api(office.request, "PUT", `/office/consultations/${ref}/report`, { summary_bn: "রাস্তা ও বাতি নিয়ে বেশির ভাগ মানুষ একমত হয়েছেন।", you_said_we_did: "রাস্তা মেরামতের কাজ আগামী মাসে শুরু হবে এবং বাতির জন্য টাকা চাওয়া হয়েছে।", actions: [{ text: "রাস্তা মেরামত শুরু" }], publish: true });
  expect(pub.status, JSON.stringify(pub.json)).toBe(200);

  const rep = await api(visitor.request, "GET", `/consultations/${ref}/report`);
  expect(rep.status).toBe(200);
  const r = rep.json.data as { participants: number | null; groups: { group: string; size: number }[]; agreement: { votes: number | null; groups: { votes: number; agree_pct: number | null }[] }[] };
  expect(r.participants).toBe(10);
  for (const g of r.groups) expect(g.size, "every shown group has at least 5 people").toBeGreaterThanOrEqual(5);
  for (const a of r.agreement) {
    expect(a.votes === null || a.votes >= 5).toBe(true);
    for (const g of a.groups) expect(g.agree_pct === null || g.votes >= 5).toBe(true);
  }
  // The public page shows the same: the "you said, we did" text and no individual votes.
  const page = await visitor.newPage();
  await gotoOk(page, `/consultations/${ref}/report`);
  await expect(page.getByText("রাস্তা মেরামতের কাজ", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/আপনারা বললেন|You said/);
  await page.close();

  // A second consultation with only two voters publishes no group and no figure.
  const small = await api(office.request, "POST", "/office/consultations", { constituency: w.A.key, question: "স্কুলের পাশে কী দরকার সবচেয়ে বেশি?", seed_statements: ["রাস্তায় গতিরোধক হোক", "পাশে একটি মাঠ হোক"], closes_at: day(7) });
  const sref = small.json.data.ref as string;
  await api(office.request, "POST", `/office/consultations/${sref}/status`, { action: "open" });
  const sids = ((await api(citizenA.request, "GET", `/consultations/${sref}`)).json.data.statements as { id: string }[]).map((s) => s.id);
  for (const c of [citizenA, citizenB]) for (const id of sids) await api(c.request, "PUT", `/consultations/${sref}/statements/${id}/vote`, { vote: "agree" });
  await api(office.request, "POST", `/office/consultations/${sref}/status`, { action: "close" });
  await api(office.request, "POST", `/office/consultations/${sref}/summary`, { generate_narrative: false });
  const sp = await api(office.request, "PUT", `/office/consultations/${sref}/report`, { summary_bn: "খুব কম মানুষ অংশ নিয়েছেন।", you_said_we_did: "অংশ কম হওয়ায় কোনো হিসাব দেখানো হচ্ছে না।", actions: [], publish: true });
  expect(sp.status, JSON.stringify(sp.json)).toBe(200);
  const sr = (await api(visitor.request, "GET", `/consultations/${sref}/report`)).json.data as { participants: number | null; groups: unknown[]; agreement: { votes: number | null }[] };
  expect(sr.participants).toBeNull();
  expect(sr.groups).toEqual([]);
  expect(sr.agreement.every((a) => a.votes === null)).toBe(true);
});

test("17. an idea reaching the threshold alerts the office and shows the due date; a missed date shows as overdue", async ({ browser }, info) => {
  const policy = await api(office.request, "PUT", `/office/constituencies/${w.A.key}/idea-policy`, { support_threshold: 3, response_days: 3 });
  expect(policy.status, JSON.stringify(policy.json)).toBe(200);
  // An idea from citizen B, published by the moderator.
  const mod = await sessionFor(browser, info, w.accounts.moderator);
  const made = await api(citizenB.request, "POST", "/ideas", { constituency: w.A.key, category: "roads", title: "বাজারের পথে বাতি বসানো হোক", body: "রাতে বাজারের পথ অন্ধকার থাকে, তাই সেখানে সোলার বাতি বসানো হোক।" });
  expect(made.status, JSON.stringify(made.json)).toBe(201);
  const ref = made.json.data.ref as string;
  expect((await api(mod.request, "POST", "/admin/moderation/review", { type: "idea", ref, action: "publish" })).status).toBe(200);
  await mod.close();

  // Support counts toward the threshold only from people who follow the area.
  const supporters = [citizenA, extra[0].ctx, extra[1].ctx];
  for (const c of supporters) {
    expect((await api(c.request, "POST", "/me/follows", { type: "area", target: w.A.key })).status).toBeLessThan(300);
    expect((await api(c.request, "POST", `/ideas/${ref}/support`)).status, "supporting").toBe(200);
  }
  const reached = (await api(visitor.request, "GET", `/ideas/${ref}`)).json.data;
  expect(reached.support_threshold).toBe(3);
  expect(reached.threshold_reached_at).toBeTruthy();
  expect(reached.response_due_at).toBeTruthy();
  expect(reached.response_state).toBe("awaiting_response");

  // The office is alerted (a notification of the threshold kind for the office account).
  const notes = await api(office.request, "GET", "/me/notifications?limit=30");
  expect((notes.json.data as { type: string }[]).some((n) => n.type === "idea_threshold")).toBe(true);

  // The citizen page shows the due date and the waiting label.
  const page = await citizenB.newPage();
  await gotoOk(page, `/ideas/${ref}`);
  await expect(page.getByText("উত্তরের অপেক্ষায়").or(page.getByText("Waiting for an answer"))).toBeVisible();
  await page.close();

  // The due date passes (the clock is moved in the database): the public view says overdue, and an answer needs a reasoned note of 20+ characters.
  await w.admin.from("ideas").update({ response_due_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("ref", ref).throwOnError();
  const late = (await api(visitor.request, "GET", `/ideas/${ref}`)).json.data;
  expect(late.response_state).toBe("overdue");
  const page2 = await visitor.newPage();
  await gotoOk(page2, `/ideas/${ref}`);
  await expect(page2.getByText("অফিস উত্তর দিতে দেরি করেছে").or(page2.getByText("The office is late with its answer"))).toBeVisible();
  await page2.close();
  expect((await api(office.request, "POST", `/office/ideas/${ref}/decision`, { decision: "planned", note: "ছোট" })).status).toBeGreaterThanOrEqual(400);
  const ok = await api(office.request, "POST", `/office/ideas/${ref}/decision`, { decision: "planned", note: "বাজেটে সোলার বাতির জন্য টাকা রাখা হয়েছে, কাজ শীতে শুরু হবে।" });
  expect(ok.status, JSON.stringify(ok.json)).toBe(200);
  const answered = (await api(visitor.request, "GET", `/ideas/${ref}`)).json.data;
  expect(answered.response_state).toBe("answered_late");
});
