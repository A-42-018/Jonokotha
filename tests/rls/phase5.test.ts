import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createUser, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";
import { buildWorld, userOf, visible, WHO, type Who, type World } from "./world";

/**
 * Phase 5 tables (migrations 0030-0036): who can read each row, and that no user session can write them directly. Writes go through audited
 * SECURITY DEFINER functions (tested in tests/api/phase5-*.test.ts). Extra roles: MP, case officer and agency liaison of area A.
 */
const one = async (c: Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0].id as string;
type Extra = { mp: string; officer: string; liaison: string };

async function extra(c: Client, w: World): Promise<Extra> {
  const mp = await createUser(c, "staff"), officer = await createUser(c, "staff"), liaison = await createUser(c, "staff");
  await addMember(c, mp, w.A, "mp"); await addMember(c, officer, w.A, "case_officer");
  const ag = await one(c, "insert into agencies (name_bn, name_en, categories, source) values ('x','x','{}','t') returning id");
  await c.query("insert into office_members (user_id, constituency_id, office_role, agency_id) values ($1,$2,'agency_liaison',$3)", [liaison, w.A, ag]);
  return { mp, officer, liaison };
}

async function rows(c: Client, w: World, x: Extra) {
  const idea = await one(c, "insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'An idea title','An idea body text','published') returning id", [w.citizenA, w.A]);
  const hiddenIdea = await one(c, "insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'Hidden idea','Hidden idea body text','pending_review') returning id", [w.citizenA, w.A]);
  const poll = await one(c, "insert into polls (constituency_id, question, status) values ($1,'Which road first?','open') returning id", [w.A]);
  const draft = await one(c, "insert into polls (constituency_id, question, status) values ($1,'A draft poll?','draft') returning id", [w.A]);
  const opt = await one(c, "insert into poll_options (poll_id, label, position) values ($1,'Yes',1) returning id", [poll]);
  const proj = await one(c, "insert into projects (constituency_id, title, status) values ($1,'A project title','completed') returning id", [w.A]);
  const unit = await one(c, "insert into admin_units (level, code, name_bn, name_en) values ('division','D1','বিভাগ','Division') returning id");
  const ag = await one(c, "select agency_id as id from office_members where user_id = $1", [x.liaison]);
  return {
    approval: await one(c, "insert into approval_requests (constituency_id, target_type, target_ref, requested_by) values ($1,'announcement','AN-X-1',$2) returning id", [w.A, w.officeA]),
    task: await one(c, "insert into office_tasks (constituency_id, title, assigned_to, created_by) values ($1,'A task title',$2,$3) returning id", [w.A, x.officer, w.officeA]),
    integration: await one(c, "insert into agency_integrations (agency_id, kind) values ($1,'api') returning id", [ag]),
    flag: (await c.query("select key from feature_flags limit 1")).rows[0].key as string,
    comment: await one(c, "insert into idea_comments (idea_id, author_id, body) values ($1,$2,'A comment') returning id", [idea, w.citizenA]),
    hiddenComment: await one(c, "insert into idea_comments (idea_id, author_id, body) values ($1,$2,'On a hidden idea') returning id", [hiddenIdea, w.citizenB]),
    poll, draft, option: opt,
    vote: (await c.query("insert into poll_votes (poll_id, option_id, user_id) values ($1,$2,$3) returning user_id", [poll, opt, w.citizenA])).rows[0].user_id as string,
    feedback: (await c.query("insert into project_feedback (project_id, user_id, rating) values ($1,$2,4) returning user_id", [proj, w.citizenA])).rows[0].user_id as string,
    unit, cunit: (await c.query("insert into constituency_units (constituency_id, unit_id) values ($1,$2) returning unit_id", [w.A, unit])).rows[0].unit_id as string,
    locChange: await one(c, "insert into location_change_requests (issue_id, requested_by, new_lat, new_lng) values ($1,$2,23.8,90.4) returning id", [w.issueA.id, w.citizenA]),
    platformInv: await one(c, "insert into platform_invitations (email, role, token_hash) values ('p@example.test','moderator','ph1') returning id"),
    integrationSetting: (await c.query("select provider from integration_settings limit 1")).rows[0].provider as string,
    security: await one(c, "insert into security_events (kind, route) values ('rate_limit','GET /x') returning id"),
    job: await one(c, "insert into background_jobs (kind) values ('purge') returning id"),
    inbox: (await c.query("select constituency_id from office_inbox_counts where constituency_id = $1", [w.A])).rows[0]?.constituency_id as string ?? (await c.query("insert into office_inbox_counts (constituency_id) values ($1) returning constituency_id", [w.A])).rows[0].constituency_id as string,
    event: (await c.query("insert into product_events (day, name, lang, count) values (current_date - 400,'search_used','bn',1) returning name")).rows[0].name as string,
    country: "BD",
  };
}
type P5 = Awaited<ReturnType<typeof rows>>;

const ALL: Who[] = [...WHO];
const everyone = (v: string): Partial<Record<Who | "mp" | "officer" | "liaison", string[]>> => Object.fromEntries([...ALL, "mp", "officer", "liaison"].map((x) => [x, [v]]));
type Row = { table: string; col: string; key: keyof P5; expect: (w: World, p: P5, x: Extra) => Partial<Record<Who | "mp" | "officer" | "liaison", string[]>> };
const MATRIX: Row[] = [
  // Approvals: the requester, the MP of the area and admin. Not the case officer, not the liaison, not another office.
  { table: "approval_requests", col: "id", key: "approval", expect: (w, p) => ({ officeA: [p.approval], admin: [p.approval], mp: [p.approval] }) },
  { table: "office_tasks", col: "id", key: "task", expect: (w, p) => ({ officeA: [p.task], admin: [p.task], mp: [p.task], officer: [p.task] }) },
  { table: "agency_integrations", col: "id", key: "integration", expect: (w, p) => ({ admin: [p.integration] }) },
  { table: "feature_flags", col: "key", key: "flag", expect: (w, p) => Object.fromEntries([...ALL.filter((x) => x !== "anon"), "mp", "officer", "liaison"].map((x) => [x, [p.flag]])) },
  { table: "idea_comments", col: "id", key: "comment", expect: (w, p) => ({ citizenA: [p.comment], officeA: [p.comment], moderator: [p.comment], admin: [p.comment], mp: [p.comment] }) },
  { table: "idea_comments", col: "id", key: "hiddenComment", expect: (w, p) => ({ citizenB: [p.hiddenComment], officeA: [p.hiddenComment], moderator: [p.hiddenComment], admin: [p.hiddenComment], mp: [p.hiddenComment] }) },
  { table: "polls", col: "id", key: "poll", expect: (w, p) => ({ officeA: [p.poll], admin: [p.poll], mp: [p.poll] }) },
  { table: "polls", col: "id", key: "draft", expect: (w, p) => ({ officeA: [p.draft], admin: [p.draft], mp: [p.draft] }) },
  { table: "poll_options", col: "id", key: "option", expect: (w, p) => ({ officeA: [p.option], admin: [p.option], mp: [p.option] }) },
  { table: "poll_votes", col: "user_id", key: "vote", expect: (w, p) => ({ citizenA: [p.vote] }) },
  { table: "project_feedback", col: "user_id", key: "feedback", expect: (w, p) => ({ citizenA: [p.feedback], officeA: [p.feedback], admin: [p.feedback], mp: [p.feedback] }) },
  { table: "admin_units", col: "id", key: "unit", expect: (w, p) => everyone(p.unit) },
  { table: "constituency_units", col: "unit_id", key: "cunit", expect: (w, p) => everyone(p.cunit) },
  { table: "country_adapters", col: "code", key: "country", expect: (w, p) => everyone(p.country) },
  { table: "location_change_requests", col: "id", key: "locChange", expect: (w, p) => ({ citizenA: [p.locChange], officeA: [p.locChange], admin: [p.locChange], mp: [p.locChange] }) },
  { table: "platform_invitations", col: "id", key: "platformInv", expect: (w, p) => ({ admin: [p.platformInv] }) },
  { table: "integration_settings", col: "provider", key: "integrationSetting", expect: (w, p) => ({ admin: [p.integrationSetting] }) },
  { table: "security_events", col: "id", key: "security", expect: (w, p) => ({ admin: [p.security] }) },
  { table: "background_jobs", col: "id", key: "job", expect: (w, p) => ({ admin: [p.job] }) },
  { table: "office_inbox_counts", col: "constituency_id", key: "inbox", expect: (w, p) => ({ officeA: [p.inbox], admin: [p.inbox], mp: [p.inbox] }) },
  { table: "product_events", col: "name", key: "event", expect: (w, p) => ({ admin: [p.event] }) },
];

describe("Phase 5 tables: who reads what", () => {
  for (const r of MATRIX) {
    it(`${r.table} (${String(r.key)})`, () => withClient((c) => tx(c, async () => {
      const w = await buildWorld(c), x = await extra(c, w), p = await rows(c, w, x);
      const id = String(p[r.key]);
      const expected = r.expect(w, p, x);
      for (const who of WHO) expect(await visible(c, w, who, r.table, r.col, [id]), `${who} reading ${r.table}`).toEqual(expected[who] ?? []);
      for (const k of ["mp", "officer", "liaison"] as const) {
        await actAs(c, x[k]);
        const q = await attempt(c, `select ${r.col} as v from ${r.table} where ${r.col}::text = $1`, [id]);
        await actAsOwner(c);
        expect(q.ok ? q.rows.map((z) => String(z.v)) : [], `${k} reading ${r.table}`).toEqual(expected[k] ?? []);
      }
    })));
  }

  it("another office's tasks, polls and approvals are invisible; the case officer sees only their own tasks", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c), x = await extra(c, w), p = await rows(c, w, x);
    for (const [t, id] of [["office_tasks", p.task], ["polls", p.poll], ["approval_requests", p.approval], ["office_inbox_counts", w.A]] as const) {
      const col = t === "office_inbox_counts" ? "constituency_id" : "id";
      expect(await visible(c, w, "officeB", t, col, [id]), `officeB reading ${t}`).toEqual([]);
    }
  })));

  it("the public views expose only public rows and no private columns", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c), x = await extra(c, w), p = await rows(c, w, x);
    const refs = (await c.query("select ref from polls where id = any($1)", [[p.poll, p.draft]])).rows.map((r) => r.ref);
    await actAs(c, null);
    const pubPolls = await attempt(c, "select ref, question from public_polls where ref = any($1)", [refs]);
    await actAsOwner(c);
    expect(pubPolls.ok && pubPolls.rows).toHaveLength(1);
    await actAs(c, null);
    const cols = await attempt(c, "select column_name from information_schema.columns where table_schema='public' and table_name in ('public_idea_comments','public_polls','public_poll_options','public_case_referrals','public_project_feedback','public_open311_requests')");
    await actAsOwner(c);
    expect(cols.ok && cols.rows.filter((r) => /author|user|reporter|actor|voter|proof|internal|email|phone|option_id|token/.test(String(r.column_name)))).toEqual([]);
    // comments on a non-public idea never reach the public view
    await actAs(c, null);
    const pc = await attempt(c, "select id from public_idea_comments where id = any($1)", [[p.comment, p.hiddenComment]]);
    await actAsOwner(c);
    expect(pc.ok && pc.rows.map((r) => r.id)).toEqual([p.comment]);
  })));
});

describe("Phase 5 tables: no direct writes from any user session", () => {
  const WRITES: [string, (w: World, p: P5, x: Extra) => string][] = [
    ["approval_requests", (w) => `insert into approval_requests (constituency_id, target_type, target_ref) values ('${w.A}','announcement','AN-X-2')`],
    ["office_tasks", (w, _p, x) => `insert into office_tasks (constituency_id, title, assigned_to) values ('${w.A}','A task title','${x.officer}')`],
    ["agency_integrations", (w, _p, x) => `insert into agency_integrations (agency_id, kind, status, confirmed_by, confirmed_at) values ((select agency_id from office_members where user_id='${x.liaison}'),'api','confirmed','${w.admin}',now())`],
    ["feature_flags", () => `insert into feature_flags (key, enabled) values ('forged_flag', true)`],
    ["idea_comments", (w, p) => `insert into idea_comments (idea_id, author_id, body) values ((select idea_id from idea_comments where id='${p.comment}'),'${w.citizenA}','forged')`],
    ["polls", (w) => `insert into polls (constituency_id, question, status) values ('${w.A}','A forged poll?','open')`],
    ["poll_options", (w, p) => `insert into poll_options (poll_id, label, position) values ('${p.poll}','Forged',2)`],
    ["poll_votes", (w, p) => `insert into poll_votes (poll_id, option_id, user_id) values ('${p.poll}','${p.option}','${w.citizenB}')`],
    ["project_feedback", (w) => `insert into project_feedback (project_id, user_id, rating) values ((select project_id from project_feedback where user_id='${w.citizenA}' limit 1),'${w.citizenB}',5)`],
    ["admin_units", () => `insert into admin_units (level, code, name_bn, name_en) values ('division','FORGED','x','x')`],
    ["constituency_units", (w, p) => `insert into constituency_units (constituency_id, unit_id) values ('${w.B}','${p.unit}')`],
    ["country_adapters", () => `insert into country_adapters (code, name_en, name_native, default_locale, locales, currency, date_format, timezone, admin_levels) values ('ZZ','x','x','xx','{xx}','XXX','d','UTC','[]')`],
    ["location_change_requests", (w) => `insert into location_change_requests (issue_id, requested_by, new_lat, new_lng) values ('${w.issueA.id}','${w.citizenA}',23.8,90.4)`],
    ["platform_invitations", () => `insert into platform_invitations (email, role, token_hash) values ('f@example.test','admin','forged')`],
    ["integration_settings", () => `insert into integration_settings (provider, kind) values ('forged','ai')`],
    ["security_events", () => `insert into security_events (kind) values ('rate_limit')`],
    ["background_jobs", () => `insert into background_jobs (kind) values ('purge')`],
    ["office_inbox_counts", (w) => `insert into office_inbox_counts (constituency_id) values ('${w.B}')`],
    ["product_events", () => `insert into product_events (day, name, lang, count) values (current_date,'search_used','en',99)`],
  ];
  for (const [table, sql] of WRITES) {
    it(`insert into ${table} is refused for every account, including staff and admin`, () => withClient((c) => tx(c, async () => {
      const w = await buildWorld(c), x = await extra(c, w), p = await rows(c, w, x);
      const actors: [string, string | null][] = [...WHO.map((who) => [who, userOf(w, who)] as [string, string | null]), ["mp", x.mp], ["officer", x.officer], ["liaison", x.liaison]];
      for (const [name, id] of actors) {
        await actAs(c, id);
        const r = await attempt(c, sql(w, p, x));
        await actAsOwner(c);
        expect(r, `${name} inserting into ${table}`).toMatchObject({ ok: false, code: "42501" });
      }
    })));
  }

  it("updates and deletes are refused for the tables people can read, and nobody can touch audit history, referral proof or issues", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c), x = await extra(c, w), p = await rows(c, w, x);
    const statements = [
      `update office_tasks set status = 'done' where id = '${p.task}'`, `delete from office_tasks where id = '${p.task}'`,
      `update polls set status = 'closed' where id = '${p.poll}'`, `delete from poll_votes where poll_id = '${p.poll}'`, `update poll_votes set option_id = '${p.option}'`,
      `update approval_requests set status = 'approved' where id = '${p.approval}'`, `update idea_comments set status = 'hidden' where id = '${p.comment}'`,
      `update feature_flags set enabled = false`, `update country_adapters set is_active = false`, `update admin_units set name_en = 'x'`,
      `update audit_logs set action = 'forged'`, `delete from audit_logs`, `delete from issues`, `delete from issue_events`,
      `update issue_agency_referrals set registration_status = 'officially_registered', registration_proof = 'forged proof', registered_at = now()`,
      `update office_members set agency_id = null`, `update constituencies set mp_approval_required = true`,
    ];
    const actors: [string, string][] = [["mp", x.mp], ["officer", x.officer], ["liaison", x.liaison], ["officeA", w.officeA], ["citizenA", w.citizenA], ["moderator", w.moderator], ["admin", w.admin]];
    for (const [name, id] of actors) {
      await actAs(c, id);
      for (const sql of statements) {
        const r = await attempt(c, sql);
        expect(r.ok === false || r.rowCount === 0, `${name}: ${sql}`).toBe(true);
      }
      await actAsOwner(c);
    }
  })));

  it("only an MP of the area (or admin) can decide an approval and delegate; a manager cannot approve; a liaison cannot do either", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c), x = await extra(c, w), p = await rows(c, w, x);
    const call = async (id: string, sql: string, params: unknown[]) => { await actAs(c, id); const r = await attempt(c, sql, params); await actAsOwner(c); return r; };
    expect(await call(w.officeA, "select decide_approval($1,'approve')", [p.approval])).toMatchObject({ ok: false, code: "42501" });
    expect(await call(x.officer, "select decide_approval($1,'approve')", [p.approval])).toMatchObject({ ok: false });
    expect(await call(x.liaison, "select decide_approval($1,'approve')", [p.approval])).toMatchObject({ ok: false });
    expect(await call(w.officeB, "select decide_approval($1,'approve')", [p.approval])).toMatchObject({ ok: false, code: "JK404" });
    expect((await call(x.mp, "select delegate_task($1,$2,'A task for you')", [(await c.query("select key from constituencies where id=$1", [w.A])).rows[0].key, x.officer])).ok).toBe(true);
    expect(await call(x.liaison, "select delegate_task($1,$2,'A task for you')", [(await c.query("select key from constituencies where id=$1", [w.A])).rows[0].key, x.officer])).toMatchObject({ ok: false });
    expect(await call(x.officer, "select delegate_task($1,$2,'A task for you')", [(await c.query("select key from constituencies where id=$1", [w.A])).rows[0].key, x.officer])).toMatchObject({ ok: false });
  })));
});

describe("Phase 5 functions: who can call them", () => {
  it("admin, office and citizen entry points are closed to anonymous visitors; internal job and worker functions are closed to every API role", () => withClient(async (c) => {
    const authed = ["decide_approval(uuid,text,text)", "delegate_task(text,uuid,text,text,date,text)", "set_task_status(uuid,text)", "post_public_reply(text,text)", "set_mp_approval_required(text,boolean)",
      "register_referral(uuid,text,text)", "liaison_cases()", "liaison_acknowledge(uuid)", "liaison_add_update(uuid,text,boolean)", "liaison_close_task(uuid,text,text)",
      "set_feature_flag(text,boolean,text,text)", "admin_upsert_category(text,text,text,text,text,boolean)", "set_sla_policy(text,text,integer,integer,text)", "admin_upsert_agency(text,text,text,text[],text,text,date,text,text)",
      "create_platform_invitation(text,text)", "accept_platform_invitation(text)", "admin_list_accounts(text,text,integer)", "set_integration_setting(text,boolean,text)", "admin_manage_knowledge_source(text,uuid,text,text,text,text)",
      "load_demo_data()", "reset_demo_data()", "create_idea_comment(text,text)", "create_poll(text,text,text[],timestamptz,text)", "set_poll_status(text,text)", "cast_poll_vote(text,uuid)", "submit_project_feedback(text,integer,text)",
      "set_project_details(text,text,date,text,text)", "import_admin_units(jsonb,jsonb)", "request_location_change(text,double precision,double precision)", "decide_location_change(uuid,text,text,text)", "requeue_job(uuid)",
      "update_my_personalization(boolean,boolean,text,boolean,boolean)", "reset_my_personalization()", "set_country_adapter(text,jsonb,boolean)", "set_agency_integration(uuid,text,text,text)"];
    for (const f of authed) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authed", [`public.${f}`]);
      expect(rows[0], f).toEqual({ anon: false, authed: true });
    }
    const internal = ["enqueue_job(text,jsonb,timestamptz,text)", "claim_jobs(integer,text)", "finish_job(uuid,boolean,text)", "ensure_periodic_jobs()", "close_due_polls()", "poll_closing_reminders()", "purge_security_events()",
      "refresh_inbox_count(uuid)", "liaison_for_referral(uuid)", "platform_invite_accepted(uuid,text)", "claim_deliveries(integer)"];
    for (const f of internal) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authed", [`public.${f}`]);
      expect(rows[0], f).toEqual({ anon: false, authed: false });
    }
    const open = ["public_feature_flags()", "constituency_snapshot(text,date,date)", "poll_results(text)", "constituency_candidates(double precision,double precision)", "search_public(text,text,integer)", "track_product_event(text,text)", "record_security_event(text,text,text,text)", "active_country()", "search_skeleton(text)", "normalize_digits(text)"];
    for (const f of open) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon", [`public.${f}`]);
      expect(rows[0].anon, f).toBe(true);
    }
  }));
});
