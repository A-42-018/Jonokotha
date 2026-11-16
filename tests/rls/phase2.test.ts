import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, attempt, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";
import { buildWorld, userOf, visible, WHO, type Who, type World } from "./world";

/** Phase 2 tables: who can read each row, and that no user session can write them directly (writes go through audited SECURITY DEFINER functions). */
const one = async (c: Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0].id as string;

async function phase2(c: Client, w: World) {
  const idea = await one(c, "insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'An idea title','An idea body text','published') returning id", [w.citizenA, w.A]);
  const q = await one(c, "insert into questions (asker_id, constituency_id, visibility, title, body) values ($1,$2,'private','A question title','A question body text') returning id", [w.citizenA, w.A]);
  const proj = await one(c, "insert into projects (constituency_id, title) values ($1,'A project title') returning id", [w.A]);
  const unverifiedField = await one(c, "insert into representative_fields (representative_id, field, value, source_url, source_checked_at) values ($1,'bio','x','https://e.test','2026-01-01') returning id", [w.repHidden]);
  const verifiedField = await one(c, "insert into representative_fields (representative_id, field, value, source_url, source_checked_at) values ($1,'bio','x','https://e.test','2026-01-01') returning id", [w.repVerified]);
  const notif = await one(c, "insert into notifications (user_id, type, title) values ($1,'t','x') returning id", [w.citizenA]);
  return {
    affected: (await c.query("insert into issue_affected (issue_id, user_id) values ($1,$2) returning user_id", [w.issueB.id, w.citizenA])).rows[0].user_id as string,
    follow: await one(c, "insert into follows (user_id, target_type, constituency_id) values ($1,'area',$2) returning id", [w.citizenA, w.A]),
    idea, support: (await c.query("insert into idea_supports (idea_id, user_id) values ($1,$2) returning user_id", [idea, w.citizenA])).rows[0].user_id as string,
    question: q, message: await one(c, "insert into question_messages (question_id, author_id, author_kind, body) values ($1,$2,'citizen','hello') returning id", [q, w.citizenA]),
    announcement: await one(c, "insert into announcements (constituency_id, title, body) values ($1,'An announcement','Body of the announcement') returning id", [w.A]),
    project: proj, milestone: await one(c, "insert into project_milestones (project_id, title) values ($1,'A milestone') returning id", [proj]),
    unverifiedField, verifiedField,
    delivery: await one(c, "insert into notification_deliveries (notification_id, user_id, channel) values ($1,$2,'email') returning id", [notif, w.citizenA]),
    push: await one(c, "insert into push_subscriptions (user_id, endpoint) values ($1,'https://push.example.test/x') returning id", [w.citizenA]),
    report: await one(c, "insert into moderation_reports (reporter_id, target_type, target_ref, reason_code) values ($1,'issue',$2,'spam') returning id", [w.citizenA, w.issueA.ref]),
    invitation: await one(c, "insert into office_invitations (email, constituency_id, office_role, token_hash) values ('a@example.test',$1,'case_officer','h1') returning id", [w.A]),
    analytics: await one(c, "insert into analytics_reports (constituency_id, period_days, payload) values ($1,30,'{}') returning id", [w.A]),
    evalRun: await one(c, "insert into ai_eval_runs (dataset_name, dataset_size, metrics) values ('v0',1,'{}') returning id"),
  };
}
type P2 = Awaited<ReturnType<typeof phase2>>;

type Row = { table: string; col: string; key: keyof P2; expect: (w: World, p: P2) => Partial<Record<Who, string[]>> };
const mine = (w: World, v: string) => ({ citizenA: [v] });
const MATRIX: Row[] = [
  { table: "issue_affected", col: "user_id", key: "affected", expect: (w, p) => ({ citizenA: [p.affected] }) },
  { table: "follows", col: "id", key: "follow", expect: (w, p) => mine(w, p.follow) },
  { table: "ideas", col: "id", key: "idea", expect: (w, p) => ({ citizenA: [p.idea], officeA: [p.idea], moderator: [p.idea], admin: [p.idea] }) },
  { table: "idea_supports", col: "user_id", key: "support", expect: (w, p) => mine(w, p.support) },
  { table: "questions", col: "id", key: "question", expect: (w, p) => ({ citizenA: [p.question], officeA: [p.question], admin: [p.question] }) },
  { table: "question_messages", col: "id", key: "message", expect: (w, p) => ({ citizenA: [p.message], officeA: [p.message], admin: [p.message] }) },
  { table: "announcements", col: "id", key: "announcement", expect: (w, p) => ({ officeA: [p.announcement], admin: [p.announcement] }) },
  { table: "projects", col: "id", key: "project", expect: (w, p) => ({ officeA: [p.project], admin: [p.project] }) },
  { table: "project_milestones", col: "id", key: "milestone", expect: (w, p) => ({ officeA: [p.milestone], admin: [p.milestone] }) },
  { table: "representative_fields", col: "id", key: "verifiedField", expect: (w, p) => Object.fromEntries(WHO.map((x) => [x, [p.verifiedField]])) },
  { table: "representative_fields", col: "id", key: "unverifiedField", expect: (w, p) => ({ admin: [p.unverifiedField] }) },
  { table: "notification_deliveries", col: "id", key: "delivery", expect: (w, p) => mine(w, p.delivery) },
  { table: "push_subscriptions", col: "id", key: "push", expect: (w, p) => mine(w, p.push) },
  { table: "moderation_reports", col: "id", key: "report", expect: (w, p) => ({ citizenA: [p.report], moderator: [p.report], admin: [p.report] }) },
  { table: "office_invitations", col: "id", key: "invitation", expect: (w, p) => ({ officeA: [p.invitation], admin: [p.invitation] }) },
  { table: "analytics_reports", col: "id", key: "analytics", expect: (w, p) => ({ officeA: [p.analytics], admin: [p.analytics] }) },
  { table: "ai_eval_runs", col: "id", key: "evalRun", expect: (w, p) => ({ admin: [p.evalRun] }) },
];

describe("RLS read matrix for the Phase 2 tables", () => {
  for (const row of MATRIX) {
    it(`${row.table} (${row.key})`, () => withClient((c) => tx(c, async () => {
      const w = await buildWorld(c), p = await phase2(c, w);
      const want = row.expect(w, p);
      for (const who of WHO) {
        expect(await visible(c, w, who, row.table, row.col, [p[row.key]]), `${who} reading ${row.table}`).toEqual(want[who] ?? []);
      }
    })));
  }

  it("the sensitive columns of invitations and subscriptions are not readable even by their owners", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c), p = await phase2(c, w);
    await actAs(c, w.officeA);
    expect((await attempt(c, "select token_hash from office_invitations")).ok).toBe(false);
    await actAsOwner(c); await actAs(c, w.citizenA);
    expect((await attempt(c, "select endpoint from push_subscriptions")).ok).toBe(false);
    expect((await attempt(c, "select p256dh, auth from push_subscriptions")).ok).toBe(false);
    await actAsOwner(c); expect(p.push).toBeTruthy();
  })));
});

describe("no direct writes to the Phase 2 tables from a user session", () => {
  const WRITES: [string, (w: World, p: P2) => string][] = [
    ["issue_affected", (w) => `insert into issue_affected (issue_id, user_id) values ('${w.issueA.id}','${w.citizenB}')`],
    ["follows", (w) => `insert into follows (user_id, target_type, constituency_id) values ('${w.citizenA}','area','${w.B}')`],
    ["ideas", (w) => `insert into ideas (author_id, constituency_id, title, body, status) values ('${w.citizenA}','${w.A}','A title here','A body of text here','published')`],
    ["idea_supports", (w, p) => `insert into idea_supports (idea_id, user_id) values ('${p.idea}','${w.citizenB}')`],
    ["questions", (w) => `insert into questions (asker_id, constituency_id, visibility, title, body) values ('${w.citizenA}','${w.A}','public','A title here','A body of text here')`],
    ["question_messages", (w, p) => `insert into question_messages (question_id, author_id, author_kind, body) values ('${p.question}','${w.officeA}','office','x')`],
    ["announcements", (w) => `insert into announcements (constituency_id, title, body, status) values ('${w.A}','A title here','A body of text here','published')`],
    ["projects", (w) => `insert into projects (constituency_id, title) values ('${w.A}','A title here')`],
    ["project_milestones", (w, p) => `insert into project_milestones (project_id, title) values ('${p.project}','A milestone')`],
    ["notification_deliveries", (w, p) => `insert into notification_deliveries (notification_id, user_id, channel) values ('${p.delivery}','${w.citizenA}','push')`],
    ["push_subscriptions", (w) => `insert into push_subscriptions (user_id, endpoint) values ('${w.citizenA}','https://push.example.test/y')`],
    ["moderation_reports", (w) => `insert into moderation_reports (reporter_id, target_type, target_ref, reason_code) values ('${w.citizenA}','issue','JK-1','spam')`],
    ["office_invitations", (w) => `insert into office_invitations (email, constituency_id, office_role, token_hash) values ('b@example.test','${w.A}','case_officer','h2')`],
    ["analytics_reports", (w) => `insert into analytics_reports (constituency_id, period_days, payload, status) values ('${w.A}',30,'{}','approved')`],
    ["ai_eval_runs", () => `insert into ai_eval_runs (dataset_name, dataset_size, metrics) values ('x',1,'{}')`],
    ["representative_fields", (w) => `insert into representative_fields (representative_id, field, value, source_url, source_checked_at) values ('${w.repVerified}','bio','forged','https://e.test','2026-01-01')`],
  ];
  for (const [table, sql] of WRITES) {
    it(`insert into ${table} is refused for every account, including staff and admin`, () => withClient((c) => tx(c, async () => {
      const w = await buildWorld(c), p = await phase2(c, w);
      for (const who of WHO) {
        await actAs(c, userOf(w, who));
        const r = await attempt(c, sql(w, p));
        await actAsOwner(c);
        expect(r, `${who} inserting into ${table}`).toMatchObject({ ok: false, code: "42501" });
      }
    })));
  }

  it("updates and deletes are refused too, and a user may change only the read flag of a notification", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c), p = await phase2(c, w);
    await actAs(c, w.citizenA);
    for (const sql of [`update ideas set status = 'planned' where id = '${p.idea}'`, `update questions set status = 'closed' where id = '${p.question}'`, `delete from follows where id = '${p.follow}'`,
      `update follows set category = 'roads' where id = '${p.follow}'`, `update moderation_reports set status = 'dismissed' where id = '${p.report}'`, `update notifications set title = 'forged' where user_id = '${w.citizenA}'`]) {
      const r = await attempt(c, sql);
      expect(r.ok === false || r.rowCount === 0, sql).toBe(true);
    }
    expect((await attempt(c, `update notifications set read_at = now() where user_id = '${w.citizenA}'`)).ok).toBe(true);
    await actAsOwner(c);
  })));

  it("the SECURITY DEFINER entry points are closed to anonymous visitors", () => withClient(async (c) => {
    const fns = ["set_issue_affected(text,boolean)", "add_follow(text,text)", "create_idea(text,text,text,text)", "set_idea_support(text,boolean)", "decide_idea(text,text,text)", "ask_question(text,text,text,text)",
      "post_question_message(text,text)", "save_announcement(text,text,text,boolean)", "create_project(text,text,text,text,text,date,date,text,date)", "review_issue_media(uuid,text,text)",
      "me_feed(boolean,integer,integer,timestamptz,text)", "report_content(text,text,text,text)", "moderation_queue(integer)", "moderate_item(text,text,text,text)", "verify_representative(uuid,text,text,text)",
      "create_office_invitation(text,text,text,uuid,uuid)", "accept_office_invitation(text)", "analytics_overview(text,integer)", "retrieve_knowledge(uuid,vector,integer)", "record_mcp_call(text,jsonb,integer)",
      "import_constituencies(jsonb,jsonb)", "save_push_subscription(text,text,text)"];
    for (const f of fns) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authed", [`public.${f}`]);
      expect(rows[0], f).toEqual({ anon: false, authed: true });
    }
    for (const f of ["notify_user(uuid,text,text,text,jsonb,text,text)", "claim_deliveries(integer)", "finish_delivery(uuid,boolean,text,boolean)", "quiet_until(uuid)", "audit_write(text,text,text,jsonb,jsonb,jsonb)"]) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authed", [`public.${f}`]);
      expect(rows[0], f).toEqual({ anon: false, authed: false });
    }
    // public lookup helpers are deliberately open
    for (const f of ["lookup_constituency(double precision,double precision)", "search_constituencies(text)", "similar_ideas(text,text,text,integer)", "constituency_responsiveness(text,date,date)", "issue_affected_counts(text[])"]) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon", [`public.${f}`]); expect(rows[0].anon, f).toBe(true);
    }
  }));
});
