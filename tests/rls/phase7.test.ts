import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createUser, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";

/** RLS for the Phase 7 tables (migrations 0070-0074). Reads are scoped (office of the area, the author, the owner of the row); no user session writes any of them directly. */
const one = async (c: Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0].id as string;
const count = async (c: Client, who: string | null, sql: string, p: unknown[] = []) => { await actAs(c, who); const r = await attempt(c, sql, p); return r.ok ? r.rowCount : 0; };

async function seed(c: Client) {
  const A = await createConstituency(c), B = await createConstituency(c);
  const citizenA = await createUser(c), citizenB = await createUser(c);
  const officeA = await createUser(c, "staff"), officeB = await createUser(c, "staff"), mod = await createUser(c, "moderator"), admin = await createUser(c, "admin");
  await addMember(c, officeA, A, "office_manager"); await addMember(c, officeB, B, "office_manager");
  const cons = await one(c, "insert into consultations (constituency_id, question, closes_at, status) values ($1,'Which work is needed first?', now() + interval '3 days','open') returning id", [A]);
  const stmt = await one(c, "insert into consultation_statements (consultation_id, author_id, body, status) values ($1,$2,'Fix the market road','pending_review') returning id", [cons, citizenA]);
  await c.query("insert into statement_votes (statement_id, user_id, vote) values ($1,$2,'agree')", [stmt, citizenA]);
  await c.query("insert into consultation_reports (consultation_id) values ($1)", [cons]);
  const idea = await one(c, "insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'An idea title','An idea body text','published') returning id", [citizenA, A]);
  const arg = await one(c, "insert into idea_arguments (idea_id, author_id, side, body, status) values ($1,$2,'for','A point in favour','hidden') returning id", [idea, citizenA]);
  await c.query("insert into idea_argument_votes (argument_id, user_id) values ($1,$2)", [arg, citizenA]);
  await c.query("insert into idea_policies (constituency_id, support_threshold, response_days) values ($1,10,14)", [A]);
  const proj = await one(c, "insert into projects (constituency_id, title, status) values ($1,'A project title','planned') returning id", [A]);
  await c.query("insert into project_checkins (project_id, author_id, note, visited_at) values ($1,$2,'Visited today, work started', current_date)", [proj, citizenA]);
  const survey = await one(c, "insert into surveys (constituency_id, title, status) values ($1,'A survey title','draft') returning id", [A]);
  const q = await one(c, "insert into survey_questions (survey_id, position, kind, prompt) values ($1,1,'rating','How satisfied are you?') returning id", [survey]);
  await c.query("insert into survey_responses (survey_id, user_id, answers) values ($1,$2,$3)", [survey, citizenA, JSON.stringify({ [q]: 4 })]);
  const cm = await one(c, "insert into commitments (constituency_id, title, status) values ($1,'A commitment title','draft') returning id", [A]);
  await c.query("insert into commitment_events (commitment_id, to_status) values ($1,'draft')", [cm]);
  const round = await one(c, "insert into priority_rounds (constituency_id, title, status) values ($1,'A priority round','draft') returning id", [A]);
  const item = await one(c, "insert into priority_items (round_id, position, label) values ($1,1,'Roads') returning id", [round]);
  await c.query("insert into priority_ranks (round_id, user_id, item_id, rank) values ($1,$2,$3,1)", [round, citizenA, item]);
  const link = await one(c, "insert into channel_links (user_id, channel, address, address_hash, address_hint, status) values ($1,'sms','+8801712345678','h','…678','active') returning id", [citizenA]);
  await c.query("insert into channel_conversations (link_id) values ($1)", [link]);
  await c.query("insert into channel_messages (link_id, channel, direction, body) values ($1,'sms','in','secret words')", [link]);
  await c.query("insert into channel_budgets (channel, month, budget_usd) values ('sms', date_trunc('month', now())::date, 10)");
  await c.query("insert into area_alerts (constituency_id, title_bn, created_by) values ($1,'A short alert title',$2)", [A, officeA]);
  await c.query("insert into insight_briefs (constituency_id, week_start, payload) values ($1, current_date, '{}')", [A]);
  await c.query("insert into pending_file_deletions (bucket, path) values ('project-checkins','x/y.jpg')");
  return { A, B, citizenA, citizenB, officeA, officeB, mod, admin };
}

const OFFICE_SCOPED = ["consultations", "consultation_reports", "idea_policies", "surveys", "survey_questions", "commitments", "commitment_events", "priority_rounds", "priority_items", "area_alerts", "insight_briefs"];
const NOBODY = ["channel_conversations", "channel_messages", "pending_file_deletions"];
const ALL = [...OFFICE_SCOPED, ...NOBODY, "consultation_statements", "statement_votes", "idea_arguments", "idea_argument_votes", "project_checkins", "survey_responses", "priority_ranks", "channel_links", "channel_budgets"];

describe("Phase 7 tables: deny by default", () => {
  it("office-scoped tables: the area's office and administrators read them; other areas, citizens, anonymous and moderators do not", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of OFFICE_SCOPED) {
      expect(await count(c, w.officeA, `select 1 from ${t}`), `${t} as office A`).toBeGreaterThan(0);
      expect(await count(c, w.admin, `select 1 from ${t}`), `${t} as admin`).toBeGreaterThan(0);
      for (const [name, who] of [["anon", null], ["citizen", w.citizenB], ["office B", w.officeB], ["moderator", w.mod]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
  })));

  it("internal tables (conversations, stored messages, deletion queue) are readable by nobody with a user session, not even administrators", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of NOBODY) for (const who of [null, w.citizenA, w.officeA, w.mod, w.admin]) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${who ?? "anon"}`).toBe(0);
  })));

  it("rows owned by a person: only they (and, for content, the office and moderators) read them", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of ["statement_votes", "idea_argument_votes", "survey_responses", "priority_ranks", "channel_links"]) {
      expect(await count(c, w.citizenA, `select 1 from ${t}`), `${t} owner`).toBe(1);
      for (const [name, who] of [["anon", null], ["other citizen", w.citizenB], ["office A", w.officeA], ["moderator", w.mod], ["admin", w.admin]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
    for (const t of ["consultation_statements", "idea_arguments", "project_checkins"]) {
      for (const [name, who] of [["author", w.citizenA], ["office A", w.officeA], ["moderator", w.mod], ["admin", w.admin]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBeGreaterThan(0);
      for (const [name, who] of [["anon", null], ["other citizen", w.citizenB], ["office B", w.officeB]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
    expect(await count(c, w.admin, "select 1 from channel_budgets")).toBe(1);
    for (const who of [null, w.citizenA, w.officeA, w.mod]) expect(await count(c, who, "select 1 from channel_budgets")).toBe(0);
  })));

  it("a person cannot read their own phone number or link code back: only the hint columns are granted", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    await actAs(c, w.citizenA);
    expect((await attempt(c, "select address from channel_links")).ok).toBe(false);
    expect((await attempt(c, "select address_hash from channel_links")).ok).toBe(false);
    expect((await attempt(c, "select code_hash from channel_links")).ok).toBe(false);
    expect((await attempt(c, "select id, address_hint, status, updates_enabled from channel_links")).ok).toBe(true);
  })));

  it("nobody writes any Phase 7 table directly with a user session (writes go through audited functions)", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of ALL) {
      await actAsOwner(c);
      const col = (await c.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position limit 1", [t])).rows[0].column_name;
      for (const who of [w.citizenA, w.officeA, w.mod, w.admin]) {
        await actAs(c, who);
        expect((await attempt(c, `insert into ${t} default values`)).ok, `insert ${t}`).toBe(false);
        expect((await attempt(c, `update ${t} set ${col} = ${col}`)).ok, `update ${t}`).toBe(false);
        expect((await attempt(c, `delete from ${t}`)).ok, `delete ${t}`).toBe(false);
      }
    }
  })));

  it("public views show only what a visitor may see: no pending content, no drafts, no private fields", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    await actAsOwner(c);
    for (const v of ["public_consultation_statements", "public_idea_arguments", "public_project_checkins", "public_surveys", "public_commitments", "public_commitment_events", "public_priority_rounds", "public_priority_items", "public_consultation_reports"]) {
      expect(await count(c, null, `select 1 from ${v}`), `${v} (only drafts and pending rows exist)`).toBe(0);
    }
    expect(await count(c, null, "select 1 from public_consultations")).toBe(1);           // open consultation: question only
    const cols = (await c.query("select column_name from information_schema.columns where table_name = 'public_consultations'")).rows.map((r) => r.column_name);
    expect(cols).not.toContain("created_by");
    for (const v of ["public_idea_arguments", "public_project_checkins", "public_consultation_statements"]) {
      const vc = (await c.query("select column_name from information_schema.columns where table_name = $1", [v])).rows.map((r) => r.column_name as string);
      expect(vc.filter((x) => /author|user_id|moderated_by|photo_path/.test(x)), `${v} must not show who wrote it`).toEqual([]);
    }
    void w;
  })));

  it("an office manager of another area cannot act on this area's content through the functions", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    await actAs(c, w.officeB);
    const cons = (await c.query("select id from consultations limit 1")).rows;
    expect(cons).toHaveLength(0);
    await actAsOwner(c);
    const ref = (await c.query("select ref from consultations limit 1")).rows[0].ref;
    await actAs(c, w.officeB);
    for (const sql of ["select open_consultation($1)", "select close_consultation($1)", "select consultation_office_view($1)", "select * from consultation_vote_matrix($1)"]) expect((await attempt(c, sql, [ref])).ok, sql).toBe(false);
  })));
});
