import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency as mkConstituency, createIssue as mkIssue, createUser as mkUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

/** Phase 7 (migrations 0070-0074) at database level: rules the API relies on, so a bug in a route cannot widen them. */
const asService = async (c: Client) => { await c.query("reset role"); await c.query("set local role service_role"); await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]); };
const createUser: typeof mkUser = async (c, ...a) => { await actAsOwner(c); return mkUser(c, ...a); };
const createConstituency: typeof mkConstituency = async (c) => { await actAsOwner(c); return mkConstituency(c); };
const createIssue: typeof mkIssue = async (c, ...a) => { await actAsOwner(c); return mkIssue(c, ...a); };
/** A verified citizen: confirmed email, and optionally following the area. */
const citizen = async (c: Client, area?: string) => {
  const u = await createUser(c);
  await c.query("update auth.users set email_confirmed_at = now() where id = $1", [u]);
  if (area) await c.query("insert into follows (user_id, target_type, constituency_id) values ($1,'area',$2)", [u, area]);
  return u;
};
const keyOf = async (c: Client, id: string) => { await actAsOwner(c); return scalar<string>(c, "select key from constituencies where id = $1", [id]); };
const future = (days = 7) => new Date(Date.now() + days * 86400_000).toISOString();
const call = async <T = Record<string, unknown>>(c: Client, sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows[0] as T;
const fn = async (c: Client, who: string | null, sql: string, params: unknown[] = []) => { await actAs(c, who); return attempt(c, sql, params); };
async function office(c: Client, A: string) {
  const mgr = await createUser(c, "staff"), mp = await createUser(c, "staff");
  await addMember(c, mgr, A, "office_manager"); await addMember(c, mp, A, "mp");
  return { mgr, mp };
}

describe("consultations (B7.1)", () => {
  it("full lifecycle: seed, open, one vote per statement, matrix without identities, group minimum, publish rules, notifications", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A);
    const follower = await citizen(c, A), voters = [] as string[];
    for (let i = 0; i < 9; i++) voters.push(await citizen(c, A));
    await actAs(c, mgr);
    const made = (await c.query("select create_consultation($1,'Which work is needed first?','About local needs',array['Fix the market road','Build a drain'],$2) r", [key, future(5)])).rows[0].r;
    expect(made.status).toBe("draft");
    expect((await attempt(c, "select open_consultation($1)", [made.ref])).ok, "open").toBe(true);   // no MP rule here: opens at once
    expect(await scalar(c, "select count(*)::int from consultation_statements cs join consultations x on x.id = cs.consultation_id where x.ref = $1 and cs.status = 'approved'", [made.ref])).toBe(2);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'consultation_opened'", [follower])).toBe(1);
    const ids = (await c.query("select cs.id from consultation_statements cs join consultations x on x.id = cs.consultation_id where x.ref = $1 order by cs.created_at", [made.ref])).rows.map((r) => r.id as string);

    // citizens vote; changing a vote does not add a row
    for (let i = 0; i < voters.length; i++) {
      await actAs(c, voters[i]);
      const a = i < 5 ? "agree" : "disagree";
      await c.query("select vote_consultation_statement($1,$2)", [ids[0], a]);
      await c.query("select vote_consultation_statement($1,'agree')", [ids[1]]);
    }
    await c.query("select vote_consultation_statement($1,'disagree')", [ids[1]]);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from statement_votes where statement_id = $1", [ids[1]])).toBe(9);
    expect((await fn(c, voters[0], "select vote_consultation_statement($1,'maybe')", [ids[0]])).ok).toBe(false);
    expect((await fn(c, null, "select vote_consultation_statement($1,'agree')", [ids[0]])).ok, "anonymous").toBe(false);

    // a citizen statement waits for review, is not public, and cannot be voted on
    await actAs(c, voters[0]);
    const st = (await c.query("select add_consultation_statement($1,'Light the footpath near the school') r", [made.ref])).rows[0].r;
    expect(st.status).toBe("pending_review");
    expect((await attempt(c, "select add_consultation_statement($1,'Light the footpath near the school')", [made.ref])).ok, "duplicate").toBe(false);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_consultation_statements where consultation_ref = $1", [made.ref])).toBe(2);
    expect((await fn(c, voters[1], "select vote_consultation_statement($1,'agree')", [st.id])).ok).toBe(false);
    // only the author and office see the pending text
    expect((await fn(c, voters[1], "select count(*)::int n from consultation_statements where id = $1", [st.id])).ok && (await c.query("select count(*)::int n from consultation_statements where id = $1", [st.id])).rows[0].n).toBe(0);
    await actAs(c, mgr);
    await c.query("select moderate_consultation_statement($1,'approve',null)", [st.id]);
    expect((await attempt(c, "select moderate_consultation_statement($1,'approve',null)", [st.id])).ok, "already moderated").toBe(false);

    // the matrix has no user ids and only office with analytics rights may read it
    const m = await c.query("select * from consultation_vote_matrix($1)", [made.ref]);
    expect(m.fields.map((f) => f.name)).toEqual(["participant", "statement_id", "vote"]);
    expect(m.rows).toHaveLength(18);
    expect((await fn(c, voters[0], "select * from consultation_vote_matrix($1)", [made.ref])).ok).toBe(false);

    // the database drops groups under 5 and hides everything under 5 participants
    await actAs(c, mgr);
    const rep = (await c.query("select save_consultation_report($1, 9, $2::jsonb, '[{\"statement_id\":\"x\"}]'::jsonb, 'draft text') r", [made.ref, JSON.stringify([{ group: "A", size: 6 }, { group: "B", size: 3 }])])).rows[0].r;
    expect(rep).toMatchObject({ groups_shown: 1, groups_hidden: 1, suppressed: false });
    const tiny = (await c.query("select save_consultation_report($1, 4, '[{\"group\":\"A\",\"size\":9}]'::jsonb, '[{\"statement_id\":\"x\"}]'::jsonb, null) r", [made.ref])).rows[0].r;
    expect(tiny).toMatchObject({ groups_shown: 0, suppressed: true });
    await c.query("select save_consultation_report($1, 9, $2::jsonb, '[{\"statement_id\":\"x\"}]'::jsonb, 'draft text')", [made.ref, JSON.stringify([{ group: "A", size: 6 }, { group: "B", size: 3 }])]);

    // publish rules: closed first, "you said, we did" text, reviewed summary
    expect((await attempt(c, "select review_consultation_report($1,'Reviewed summary text','You said and we did this and that',null,true)", [made.ref])).ok, "not closed").toBe(false);
    await c.query("select close_consultation($1)", [made.ref]);
    expect((await attempt(c, "select review_consultation_report($1,'Reviewed summary text','too short',null,true)", [made.ref])).ok, "short").toBe(false);
    expect((await attempt(c, "select review_consultation_report($1,'short','You said and we did this and that',null,true)", [made.ref])).ok, "summary").toBe(false);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_consultation_reports where consultation_ref = $1", [made.ref])).toBe(0);
    await actAs(c, mgr);
    const pub = (await c.query("select review_consultation_report($1,'Reviewed summary text','You said and we did this and that','[{\"text\":\"Road repaired\"}]'::jsonb,true) r", [made.ref])).rows[0].r;
    expect(pub.status).toBe("published");
    expect(pub.notified).toBeGreaterThanOrEqual(10);
    await actAs(c, null);
    const pr = await call<{ groups: { size: number }[]; participants: number }>(c, "select * from public_consultation_reports where consultation_ref = $1", [made.ref]);
    expect(pr.groups).toEqual([{ group: "A", size: 6 }]); expect(pr.participants).toBe(9);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'consultation_report'", [voters[3]])).toBe(1);
    expect(await scalar(c, "select count(*)::int from audit_logs where resource_id = $1 and action like 'consultation.%'", [made.ref])).toBeGreaterThanOrEqual(5);
    // voting after close is refused
    expect((await fn(c, voters[0], "select vote_consultation_statement($1,'agree')", [ids[0]])).ok).toBe(false);
  })));

  it("MP approval rule: the office manager's opening waits for the MP; the manager cannot approve; the follower hears only after approval", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr, mp } = await office(c, A), key = await keyOf(c, A), follower = await citizen(c, A);
    await actAsOwner(c); await c.query("update constituencies set mp_approval_required = true where id = $1", [A]);
    await actAs(c, mgr);
    const made = (await c.query("select create_consultation($1,'Which work is needed first?',null,array['Fix the market road','Build a drain'],$2) r", [key, future()])).rows[0].r;
    expect((await c.query("select open_consultation($1) r", [made.ref])).rows[0].r.status).toBe("pending_approval");
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'consultation_opened'", [follower])).toBe(0);
    expect((await fn(c, mgr, "select decide_consultation($1,'approve',null)", [made.ref])).ok, "manager cannot approve").toBe(false);
    expect((await fn(c, mp, "select decide_consultation($1,'reject','no')", [made.ref])).ok, "reject needs a reason").toBe(false);
    expect((await c.query("select decide_consultation($1,'approve',null) r", [made.ref])).rows[0].r.status).toBe("open");
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'consultation_opened'", [follower])).toBe(1);
    expect(await scalar(c, "select count(*)::int from notifications where type = 'approval_decision' and data ->> 'ref' = $1", [made.ref])).toBe(2);
  })));

  it("rules: closing time, seed limits, other offices, unverified accounts, 3 statements each", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr } = await office(c, A), keyA = await keyOf(c, A);
    const otherOffice = await createUser(c, "staff"); await addMember(c, otherOffice, B, "office_manager");
    expect((await fn(c, mgr, "select create_consultation($1,'A fine question here',null,'{}',$2)", [keyA, new Date(Date.now() - 1000).toISOString()])).ok, "past").toBe(false);
    expect((await fn(c, mgr, "select create_consultation($1,'A fine question here',null,'{}',$2)", [keyA, future(200)])).ok, "too far").toBe(false);
    expect((await fn(c, mgr, "select create_consultation($1,'A fine question here',null,array['a','bcdef'],$2)", [keyA, future()])).ok, "short seed").toBe(false);
    expect((await fn(c, otherOffice, "select create_consultation($1,'A fine question here',null,'{}',$2)", [keyA, future()])).ok, "other office").toBe(false);
    await actAs(c, mgr);
    const made = (await c.query("select create_consultation($1,'A fine question here',null,array['One idea about roads','Another idea about water'],$2) r", [keyA, future()])).rows[0].r;
    expect((await attempt(c, "select open_consultation($1)", [made.ref])).ok).toBe(true);
    const unverified = await createUser(c);
    expect((await fn(c, unverified, "select add_consultation_statement($1,'A statement from nobody')", [made.ref])).ok, "unverified").toBe(false);
    const cit = await citizen(c);
    await actAs(c, cit);
    for (let i = 0; i < 3; i++) await c.query("select add_consultation_statement($1,$2)", [made.ref, `Citizen statement number ${i}`]);
    expect((await attempt(c, "select add_consultation_statement($1,'Citizen statement number 4')", [made.ref])).ok, "limit").toBe(false);
    expect((await fn(c, otherOffice, "select open_consultation($1)", [made.ref])).ok).toBe(false);
  })));
});

describe("idea support threshold (B7.5)", () => {
  it("local supporters count, due date is fixed, response state is computed, reasoned response needed, reminders run", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A);
    const author = await citizen(c, A);
    await actAsOwner(c);
    const idea = (await c.query("insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'Solar lights','Solar lights along the canal road','published') returning id, ref", [author, A])).rows[0];
    const local = [] as string[]; for (let i = 0; i < 3; i++) local.push(await citizen(c, A));
    const outsider = await citizen(c);
    await actAs(c, mgr);
    expect((await attempt(c, "select set_idea_policy($1, 2, 10)", [key])).ok, "below minimum").toBe(false);
    await c.query("select set_idea_policy($1, 3, 10)", [key]);
    expect((await fn(c, local[0], "select set_idea_policy($1, 3, 10)", [key])).ok, "citizen").toBe(false);
    for (const u of [outsider, local[0], local[1]]) { await actAs(c, u); await c.query("select set_idea_support($1,true)", [idea.ref]); }
    await actAsOwner(c);
    expect(await scalar(c, "select threshold_reached_at is null from ideas where id = $1", [idea.id]), "two local supporters only").toBe(true);
    await actAs(c, local[2]); await c.query("select set_idea_support($1,true)", [idea.ref]);
    await actAsOwner(c);
    const i1 = await call<{ threshold_reached_at: string; response_due_at: string }>(c, "select threshold_reached_at, response_due_at from ideas where id = $1", [idea.id]);
    expect(i1.threshold_reached_at).not.toBeNull();
    expect(Math.round((+new Date(i1.response_due_at) - +new Date(i1.threshold_reached_at)) / 86400_000)).toBe(10);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'idea_threshold'", [mgr])).toBe(1);
    // withdrawing support does not cancel the commitment
    await actAs(c, local[2]); await c.query("select set_idea_support($1,false)", [idea.ref]);
    await actAsOwner(c);
    expect(await scalar(c, "select threshold_reached_at is not null from ideas where id = $1", [idea.id])).toBe(true);
    await actAs(c, null);
    expect(await scalar(c, "select response_state from public_ideas where ref = $1", [idea.ref])).toBe("awaiting_response");
    // reasoned response required; then answered
    await actAs(c, mgr);
    expect((await attempt(c, "select decide_idea($1,'under_consideration','ok')", [idea.ref])).ok, "short note").toBe(false);
    // overdue is computed, never stored
    await actAsOwner(c); await c.query("update ideas set response_due_at = now() - interval '1 day' where id = $1", [idea.id]);
    await actAs(c, null);
    expect(await scalar(c, "select response_state from public_ideas where ref = $1", [idea.ref])).toBe("overdue");
    await asService(c);
    expect(await scalar(c, "select idea_response_reminders()")).toBe(1);
    expect(await scalar(c, "select idea_response_reminders()"), "only once").toBe(0);
    await actAs(c, mgr);
    await c.query("select decide_idea($1,'planned','We will install lights in the next budget and report in June.')", [idea.ref]);
    await actAs(c, null);
    expect(await scalar(c, "select response_state from public_ideas where ref = $1", [idea.ref])).toBe("answered_late");
  })));

  it("an existing idea is marked when the policy is set later, and following the area later makes a supporter local", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), author = await citizen(c, A);
    await actAsOwner(c);
    const idea = (await c.query("insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'Library hours','Longer library hours at the weekend','published') returning id, ref", [author, A])).rows[0];
    const people = [] as string[]; for (let i = 0; i < 3; i++) people.push(await citizen(c));
    for (const u of people) await c.query("insert into idea_supports (idea_id, user_id) values ($1,$2)", [idea.id, u]);
    await actAs(c, mgr);
    expect((await c.query("select set_idea_policy($1,3,14) r", [key])).rows[0].r.ideas_now_awaiting_response).toBe(0);
    await actAsOwner(c);
    for (const u of people) await c.query("insert into follows (user_id, target_type, constituency_id) values ($1,'area',$2)", [u, A]);
    expect(await scalar(c, "select threshold_reached_at is not null from ideas where id = $1", [idea.id])).toBe(true);
  })));
});

describe("idea arguments and check-ins (B7.5, B7.3)", () => {
  it("points: sides, limits, helpful once, not on your own, hidden points leave the public view", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), author = await citizen(c, A), other = await citizen(c, A), mod = await createUser(c, "moderator");
    await actAsOwner(c);
    const idea = (await c.query("insert into ideas (author_id, constituency_id, title, body, status) values ($1,$2,'Bus stop','A covered bus stop near the market','published') returning id, ref", [author, A])).rows[0];
    await actAs(c, other);
    const p1 = (await c.query("select add_idea_argument($1,'for','It rains here for months') r", [idea.ref])).rows[0].r;
    expect((await attempt(c, "select add_idea_argument($1,'maybe','It rains here for months')", [idea.ref])).ok).toBe(false);
    await c.query("select add_idea_argument($1,'against','It costs too much for now')", [idea.ref]);
    await c.query("select add_idea_argument($1,'for','Children wait there daily')", [idea.ref]);
    expect((await attempt(c, "select add_idea_argument($1,'for','A fourth point from me')", [idea.ref])).ok, "3 per idea").toBe(false);
    expect((await attempt(c, "select set_argument_helpful($1,true)", [p1.id])).ok, "own point").toBe(false);
    await actAs(c, author);
    await c.query("select set_argument_helpful($1,true)", [p1.id]); await c.query("select set_argument_helpful($1,true)", [p1.id]);
    await actAs(c, null);
    expect(await scalar(c, "select helpful_count from public_idea_arguments where id = $1", [p1.id])).toBe(1);
    await actAs(c, mod);
    await c.query("select moderate_item('idea_argument',$1,'hide','Personal attack on someone')", [p1.id]);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_idea_arguments where idea_ref = $1", [idea.ref])).toBe(2);
    await actAs(c, author);
    expect((await attempt(c, "select report_content('idea_argument',$1,'abuse')", [p1.id])).ok, "hidden points cannot be reported").toBe(false);
  })));

  it("check-ins: pending until reviewed, labelled, never touch the project's status, hidden after moderation, erased with the account", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), cit = await citizen(c, A), other = await citizen(c, A);
    await actAsOwner(c);
    const proj = (await c.query("insert into projects (constituency_id, title, status) values ($1,'Culvert repair','in_progress') returning id, ref", [A])).rows[0];
    await actAs(c, cit);
    const k = (await c.query("select create_project_checkin($1,'Visited today: work has started at the site') r", [proj.ref])).rows[0].r;
    expect(k).toMatchObject({ status: "pending_review", label: "citizen_submitted" });
    expect((await attempt(c, "select create_project_checkin($1,'Visited today: second note')", [proj.ref])).ok, "second same day").toBe(true);
    expect((await attempt(c, "select create_project_checkin($1,'Visited today: third note')", [proj.ref])).ok, "2 a day per project").toBe(false);
    expect((await attempt(c, "select create_project_checkin($1,'Visited long ago','2020-01-01')", [proj.ref])).ok, "old date").toBe(false);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_project_checkins where project_ref = $1", [proj.ref])).toBe(0);
    expect((await fn(c, other, "select moderate_project_checkin($1,'approve')", [k.id])).ok, "citizen cannot moderate").toBe(false);
    await actAs(c, mgr);
    await c.query("select moderate_project_checkin($1,'approve')", [k.id]);
    expect((await attempt(c, "select moderate_project_checkin($1,'hide')", [k.id])).ok, "hide needs a reason").toBe(false);
    await c.query("select respond_to_checkin($1,'Thank you, the contractor starts the deck next week')", [k.id]);
    await actAs(c, null);
    const pub = await call<{ label: string; office_response: string }>(c, "select * from public_project_checkins where id = $1", [k.id]);
    expect(pub.label).toBe("citizen_submitted"); expect(pub.office_response).toMatch(/Thank you/);
    await actAsOwner(c);
    expect(await scalar(c, "select status from projects where id = $1", [proj.id]), "official status untouched").toBe("in_progress");
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'checkin_response'", [cit])).toBe(1);
    // photo path is erased with the account and queued for deletion
    await c.query("update project_checkins set photo_path = $2 where id = $1", [k.id, `${proj.id}/${k.id}.jpg`]);
    await asService(c);
    await c.query("select erase_user_data($1)", [cit]);
    await actAsOwner(c);
    expect(await scalar(c, "select photo_path is null and note like '[removed%' and moderation_status = 'hidden' from project_checkins where id = $1", [k.id])).toBe(true);
    expect(await scalar(c, "select count(*)::int from pending_file_deletions where bucket = 'project-checkins' and path like $1", [`${proj.id}%`])).toBe(1);
  })));
});

describe("channels (B7.2, B7.4)", () => {
  it("link flow: consent recorded, code needs the claimed number, one account per number, revoke deletes the number", () => withClient((c) => tx(c, async () => {
    const u1 = await citizen(c), u2 = await citizen(c);
    await actAs(c, u1);
    const s = (await c.query("select start_channel_link('sms','+8801712345678','2026-11') r")).rows[0].r;
    expect(s.code).toMatch(/^JK\d{6}$/); expect(s.address_hint).toBe("…678");
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from consents where user_id = $1 and consent_type = 'channel_sms' and policy_version = '2026-11'", [u1])).toBe(1);
    // the table never stores the code, only its hash
    expect(await scalar(c, "select code_hash <> $2 from channel_links where id = $1", [s.id, s.code])).toBe(true);
    await asService(c);
    expect((await c.query("select channel_confirm_link('sms','+8801799999999',$1) r", [s.code])).rows[0].r.linked, "wrong number").toBe(false);
    expect((await c.query("select channel_confirm_link('sms','+8801712345678','JK000000') r")).rows[0].r.linked, "wrong code").toBe(false);
    expect((await c.query("select channel_confirm_link('sms','+8801712345678',$1) r", [s.code])).rows[0].r.linked).toBe(true);
    expect((await c.query("select channel_confirm_link('sms','+8801712345678',$1) r", [s.code])).rows[0].r.linked, "code is single use").toBe(false);
    const found = (await c.query("select * from channel_find_link('sms','+8801712345678')")).rows[0];
    expect(found.user_id).toBe(u1); expect(found.state).toBe("idle");
    expect((await fn(c, u2, "select start_channel_link('sms','+8801712345678','2026-11')")).ok, "number already in use").toBe(false);
    expect((await fn(c, u1, "select start_channel_link('sms','12345','2026-11')")).ok, "bad number").toBe(false);
    // the person cannot read the number or the code hash back through the table
    expect((await fn(c, u1, "select address from channel_links")).ok).toBe(false);
    expect((await c.query("select id, address_hint, status from channel_links")).rows).toHaveLength(1);
    expect((await fn(c, u2, "select revoke_channel_link($1)", [s.id])).ok, "someone else's link").toBe(false);
    await actAs(c, u1);
    await c.query("select revoke_channel_link($1)", [s.id]);
    await actAsOwner(c);
    expect(await scalar(c, "select address is null and address_hash is null and status = 'revoked' from channel_links where id = $1", [s.id])).toBe(true);
    expect(await scalar(c, "select withdrawn_at is not null from consents where user_id = $1 and consent_type = 'channel_sms'", [u1])).toBe(true);
    await asService(c);
    expect((await c.query("select count(*)::int n from channel_find_link('sms','+8801712345678')")).rows[0].n).toBe(0);
  })));

  it("deliveries: SMS and WhatsApp only with the switch AND an active link, only for own case updates and area alerts", () => withClient((c) => tx(c, async () => {
    const u = await citizen(c);
    await actAsOwner(c);
    await c.query("insert into user_preferences (user_id, channels) values ($1, '{\"in_app\":true,\"sms\":true,\"whatsapp\":false}') on conflict (user_id) do update set channels = excluded.channels", [u]);
    await c.query("select notify_user($1,'issue_status','t','b','{}','d1','JK-1')", [u]);
    expect(await scalar(c, "select count(*)::int from notification_deliveries where user_id = $1 and channel = 'sms'", [u]), "no link yet").toBe(0);
    await actAs(c, u);
    const s = (await c.query("select start_channel_link('sms','+8801712345679','2026-11') r")).rows[0].r;
    await asService(c); await c.query("select channel_confirm_link('sms','+8801712345679',$1)", [s.code]);
    await actAsOwner(c);
    await c.query("select notify_user($1,'issue_status','t','b','{}','d2','JK-1')", [u]);
    await c.query("select notify_user($1,'announcement','t','b','{}','d3','AN-1')", [u]);
    await c.query("select notify_user($1,'area_alert','t','b','{}','d4',null)", [u]);
    expect(await scalar(c, "select count(*)::int from notification_deliveries where user_id = $1 and channel = 'sms'", [u]), "status and area alert, not the announcement").toBe(2);
    expect(await scalar(c, "select count(*)::int from notification_deliveries where user_id = $1 and channel = 'whatsapp'", [u])).toBe(0);
    await actAs(c, u); await c.query("select set_channel_updates($1,false)", [s.id]);
    await actAsOwner(c);
    await c.query("select notify_user($1,'issue_status','t','b','{}','d5','JK-1')", [u]);
    expect(await scalar(c, "select count(*)::int from notification_deliveries where user_id = $1 and channel = 'sms'", [u]), "updates switched off").toBe(2);
    await asService(c);
    expect(await scalar(c, "select channel_destination($1,'sms')", [u]), "no destination while off").toBeNull();
  })));

  it("a public office reply on a case that came in by SMS becomes a channel_reply notification", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), u = await citizen(c, A);
    const issue = await createIssue(c, A, u);
    await c.query("update issues set source_channel = 'sms' where id = $1", [issue.id]);
    await c.query("insert into issue_events (issue_id, actor_id, event_type, public_message, is_public) values ($1,$2,'note','We are looking into it',true)", [issue.id, mgr]);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'channel_reply'", [u])).toBe(1);
    const issue2 = await createIssue(c, A, u);
    await c.query("insert into issue_events (issue_id, actor_id, event_type, public_message, is_public) values ($1,$2,'note','Seen',true)", [issue2.id, mgr]);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'channel_reply'", [u]), "app cases are not affected").toBe(1);
  })));

  it("budgets: alert once at 80 and once at 100 percent, sends pause at 100, only administrators set budgets, spend counts only known costs", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), citizenU = await citizen(c);
    expect((await fn(c, citizenU, "select set_channel_budget('sms', null, 10)")).ok).toBe(false);
    await actAs(c, admin);
    expect((await attempt(c, "select set_channel_budget('sms', null, 0)")).ok).toBe(false);
    await c.query("select set_channel_budget('sms', null, 10)");
    await asService(c);
    expect(await scalar(c, "select channel_send_allowed('sms')")).toBe(true);
    await c.query("insert into channel_messages (channel, direction, status, cost_usd) values ('sms','out','sent', 8.5), ('sms','out','sent', null)");
    expect(await scalar(c, "select channel_cost_alerts()")).toBe(1);
    expect(await scalar(c, "select channel_cost_alerts()"), "once").toBe(0);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'channel_cost_alert'", [admin])).toBe(1);
    expect(await scalar(c, "select channel_send_allowed('sms')")).toBe(true);
    await c.query("insert into channel_messages (channel, direction, status, cost_usd) values ('sms','out','sent', 2)");
    expect(await scalar(c, "select channel_cost_alerts()")).toBe(1);
    expect(await scalar(c, "select channel_send_allowed('sms')")).toBe(false);
    expect(await scalar(c, "select channel_send_allowed('whatsapp')"), "other channel unaffected").toBe(true);
    const sp = await call<{ r: { spend_usd: number; messages_without_known_cost: number } }>(c, "select channel_spend('sms') r");
    expect(Number(sp.r.spend_usd)).toBe(10.5); expect(sp.r.messages_without_known_cost).toBe(1);
    await actAs(c, admin);
    expect((await c.query("select channel_cost_report() r")).rows[0].r.channels).toHaveLength(2);
    expect((await fn(c, citizenU, "select channel_cost_report()")).ok).toBe(false);
  })));

  it("area alerts: office with publish only, two a day, followers hear, others do not", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A);
    const f = await citizen(c, A), notF = await citizen(c, B), caseOfficer = await createUser(c, "staff"); await addMember(c, caseOfficer, A, "case_officer");
    expect((await fn(c, caseOfficer, "select send_area_alert($1,'Water supply cut tomorrow',null,null)", [key])).ok, "case officer cannot publish").toBe(false);
    expect((await fn(c, f, "select send_area_alert($1,'Water supply cut tomorrow',null,null)", [key])).ok, "citizen").toBe(false);
    await actAs(c, mgr);
    expect((await c.query("select send_area_alert($1,'Water supply cut tomorrow','Water cut tomorrow','From 9 to 3') r", [key])).rows[0].r.recipients).toBe(1);
    await c.query("select send_area_alert($1,'Second alert of the day',null,null)", [key]);
    expect((await attempt(c, "select send_area_alert($1,'Third alert of the day',null,null)", [key])).ok).toBe(false);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'area_alert'", [f])).toBe(2);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'area_alert'", [notF])).toBe(0);
  })));
});

describe("surveys, commitments, priorities (B7.6-B7.8)", () => {
  it("surveys: every question answered, one response, results hidden until closed and 5 respondents, no free text", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A);
    await actAs(c, mgr);
    const made = (await c.query("select create_survey($1,'Road repair survey',null,$2::jsonb,null) r", [key, JSON.stringify([{ kind: "rating", prompt: "How satisfied are you?" }, { kind: "choice", prompt: "Which road first?", options: ["Main road", "Market lane"] }])])).rows[0].r;
    expect((await attempt(c, "select create_survey($1,'Bad survey',null,$2::jsonb,null)", [key, JSON.stringify([{ kind: "choice", prompt: "Only one option", options: ["a"] }])])).ok).toBe(false);
    expect((await attempt(c, "select create_survey($1,'Bad survey',null,$2::jsonb,null)", [key, JSON.stringify([{ kind: "text", prompt: "Free text is not allowed" }])])).ok).toBe(false);
    await c.query("select set_survey_status($1,'open')", [made.ref]);
    await actAsOwner(c);
    const qs = (await c.query("select q.id, q.kind from survey_questions q join surveys s on s.id = q.survey_id where s.ref = $1 order by q.position", [made.ref])).rows;
    const good = (n: number) => JSON.stringify({ [qs[0].id]: n, [qs[1].id]: "Main road" });
    const people = [] as string[]; for (let i = 0; i < 5; i++) people.push(await citizen(c));
    expect((await fn(c, people[0], "select submit_survey_response($1,$2::jsonb)", [made.ref, JSON.stringify({ [qs[0].id]: 9, [qs[1].id]: "Main road" })])).ok, "rating range").toBe(false);
    expect((await fn(c, people[0], "select submit_survey_response($1,$2::jsonb)", [made.ref, JSON.stringify({ [qs[0].id]: 3 })])).ok, "unanswered").toBe(false);
    expect((await fn(c, people[0], "select submit_survey_response($1,$2::jsonb)", [made.ref, JSON.stringify({ [qs[0].id]: 3, [qs[1].id]: "Other" })])).ok, "unknown option").toBe(false);
    for (let i = 0; i < 5; i++) { await actAs(c, people[i]); await c.query("select submit_survey_response($1,$2::jsonb)", [made.ref, good(3 + (i % 3))]); }
    expect((await attempt(c, "select submit_survey_response($1,$2::jsonb)", [made.ref, good(3)])).ok, "twice").toBe(false);
    await actAs(c, null);
    expect((await c.query("select survey_results($1) r", [made.ref])).rows[0].r).toMatchObject({ results_shown: false, respondents: 5 });
    await actAs(c, mgr);
    const staff = (await c.query("select survey_results($1) r", [made.ref])).rows[0].r;
    expect(staff.results_shown).toBe(true); expect(Number(staff.questions[0].average)).toBe(3.8);
    await c.query("select set_survey_status($1,'closed')", [made.ref]);
    await actAs(c, null);
    expect((await c.query("select survey_results($1) r", [made.ref])).rows[0].r.results_shown).toBe(true);
    expect((await attempt(c, "select submit_survey_response($1,$2::jsonb)", [made.ref, good(3)])).ok, "anonymous").toBe(false);
  })));

  it("satisfaction summary: nothing below 5 ratings, then average and distribution", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), key = await keyOf(c, A), u = await citizen(c, A);
    await actAs(c, null);
    expect((await c.query("select satisfaction_summary($1,90) r", [key])).rows[0].r).toMatchObject({ ratings: null, suppressed: true, average: null });
    await actAsOwner(c);
    for (let i = 0; i < 5; i++) { const issue = await createIssue(c, A, u); await c.query("insert into issue_feedback (issue_id, user_id, rating) values ($1,$2,$3)", [issue.id, u, i < 3 ? 5 : 3]); }
    await actAs(c, null);
    const r = (await c.query("select satisfaction_summary($1,90) r", [key])).rows[0].r;
    expect(r).toMatchObject({ ratings: 5, suppressed: false, average: 4.2 }); expect(r.distribution).toEqual({ "3": 2, "5": 3 });
  })));

  it("commitments: evidence for delivered, reasons for delayed and dropped, append-only history, MP rule, links stay in the area", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr, mp } = await office(c, A), key = await keyOf(c, A);
    await actAsOwner(c);
    const projB = (await c.query("insert into projects (constituency_id, title, status) values ($1,'Other area project','planned') returning ref", [B])).rows[0];
    const projA = (await c.query("insert into projects (constituency_id, title, status) values ($1,'Our area project','planned') returning ref", [A])).rows[0];
    await actAs(c, mgr);
    expect((await attempt(c, "select create_commitment($1,'Repair the market road',null,null,null,$2,null,true)", [key, projB.ref])).ok, "link to another area").toBe(false);
    const m = (await c.query("select create_commitment($1,'Repair the market road','By the next budget',current_date + 90,null,$2,null,true) r", [key, projA.ref])).rows[0].r;
    expect(m.status).toBe("planned");
    await actAs(c, null);
    expect(await scalar(c, "select project_ref from public_commitments where ref = $1", [m.ref])).toBe(projA.ref);
    await actAs(c, mgr);
    expect((await attempt(c, "select update_commitment_status($1,'delivered',null,null,null)", [m.ref])).ok, "no evidence").toBe(false);
    expect((await attempt(c, "select update_commitment_status($1,'delayed','short',null,null)", [m.ref])).ok, "no reason").toBe(false);
    expect((await attempt(c, "select update_commitment_status($1,'delivered',null,'http://insecure.example/x',null)", [m.ref])).ok, "https only").toBe(false);
    await c.query("select update_commitment_status($1,'delayed','The contractor withdrew; a new tender is open.',null,null)", [m.ref]);
    await c.query("select update_commitment_status($1,'delivered',null,'https://example.org/photo-of-finished-road',null)", [m.ref]);
    expect((await attempt(c, "select update_commitment_status($1,'in_progress',null,null,null)", [m.ref])).ok, "delivered is final here").toBe(false);
    await actAsOwner(c);
    expect((await attempt(c, "update commitment_events set note = 'changed' where commitment_id = (select id from commitments where ref = $1)", [m.ref])).ok, "history is append-only").toBe(false);
    expect((await attempt(c, "delete from commitment_events where commitment_id = (select id from commitments where ref = $1)", [m.ref])).ok).toBe(false);
    expect(await scalar(c, "select count(*)::int from commitment_events e join commitments m on m.id = e.commitment_id where m.ref = $1", [m.ref])).toBe(3);
    // MP rule
    await c.query("update constituencies set mp_approval_required = true where id = $1", [A]);
    await actAs(c, mgr);
    const m2 = (await c.query("select create_commitment($1,'Build a drain near the school',null,null,null,null,null,true) r", [key])).rows[0].r;
    expect(m2.status).toBe("pending_approval");
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_commitments where ref = $1", [m2.ref])).toBe(0);
    expect((await fn(c, mgr, "select decide_commitment($1,'approve',null)", [m2.ref])).ok).toBe(false);
    await actAs(c, mp);
    expect((await c.query("select decide_commitment($1,'approve',null) r", [m2.ref])).rows[0].r.status).toBe("planned");
  })));

  it("priorities: verified local accounts only, one ranking replaced not added, aggregate points, hidden under 5, non-binding label", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A);
    await actAs(c, mgr);
    const made = (await c.query("select create_priority_round($1,'What matters most?',null,array['Roads','Drains','Lighting','Schools'],null) r", [key])).rows[0].r;
    expect(made.label).toBe("non_binding");
    expect((await attempt(c, "select create_priority_round($1,'Too few needs',null,array['a1a','b2b'],null)", [key])).ok).toBe(false);
    await c.query("select set_priority_status($1,'open')", [made.ref]);
    await actAsOwner(c);
    const items = (await c.query("select i.id from priority_items i join priority_rounds r on r.id = i.round_id where r.ref = $1 order by i.position", [made.ref])).rows.map((r) => r.id as string);
    const local = [] as string[]; for (let i = 0; i < 5; i++) local.push(await citizen(c, A));
    const outsider = await citizen(c), unverifiedFollower = await createUser(c);
    await c.query("insert into follows (user_id, target_type, constituency_id) values ($1,'area',$2)", [unverifiedFollower, A]);
    expect((await fn(c, outsider, "select submit_priority_ranking($1,$2::uuid[])", [made.ref, [items[0]]])).ok, "not following the area").toBe(false);
    expect((await fn(c, unverifiedFollower, "select submit_priority_ranking($1,$2::uuid[])", [made.ref, [items[0]]])).ok, "not verified").toBe(false);
    expect((await fn(c, local[0], "select submit_priority_ranking($1,$2::uuid[])", [made.ref, [items[0], items[0]]])).ok, "duplicates").toBe(false);
    expect((await fn(c, local[0], "select submit_priority_ranking($1,$2::uuid[])", [made.ref, items.concat(items).slice(0, 6)])).ok, "more than five").toBe(false);
    for (let i = 0; i < 4; i++) { await actAs(c, local[i]); await c.query("select submit_priority_ranking($1,$2::uuid[])", [made.ref, [items[0], items[1]]]); }
    await actAs(c, local[0]); await c.query("select submit_priority_ranking($1,$2::uuid[])", [made.ref, [items[2]]]);   // replaces, does not add
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from priority_ranks pr join priority_rounds r on r.id = pr.round_id where r.ref = $1 and pr.user_id = $2", [made.ref, local[0]])).toBe(1);
    await actAs(c, null);
    expect((await c.query("select priority_results($1) r", [made.ref])).rows[0].r).toMatchObject({ participants: null, results_shown: false, label: "non_binding" });
    await actAs(c, local[4]); await c.query("select submit_priority_ranking($1,$2::uuid[])", [made.ref, [items[1], items[0], items[3]]]);
    await actAs(c, mgr);
    const staff = (await c.query("select priority_results($1) r", [made.ref])).rows[0].r;
    expect(staff.participants).toBe(5); expect(staff.results_shown).toBe(true);
    const pts = Object.fromEntries(staff.items.map((x: { label: string; points: number }) => [x.label, x.points]));
    expect(pts).toEqual({ Roads: 3 * 5 + 4, Drains: 3 * 4 + 5, Lighting: 5, Schools: 3 });   // rank 1 = 5 points ... rank 5 = 1
    expect(staff.note).toMatch(/Non-binding/);
    await c.query("select set_priority_status($1,'closed')", [made.ref]);
    await actAs(c, null);
    expect((await c.query("select priority_results($1) r", [made.ref])).rows[0].r.results_shown).toBe(true);
  })));
});

describe("briefs, exports, heatmaps, KPIs, erasure (B7.9-B7.13)", () => {
  it("weekly brief: one draft per area per week, drafts only for reviewers, approval shares and notifies", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr, mp } = await office(c, A);
    await asService(c);
    const gen = (await c.query("select * from generate_weekly_briefs()")).rows.find((r) => r.id);
    expect(gen).toBeTruthy();
    expect(Object.keys(gen.payload)).toEqual(expect.arrayContaining(["received", "top_categories", "ideas_awaiting_response", "privacy"]));
    const mine = (await c.query("select * from generate_weekly_briefs()")).rows.filter((r) => r.constituency_key === gen.constituency_key);
    expect(mine, "second run creates nothing for the same week").toHaveLength(0);
    await actAsOwner(c);
    const id = await scalar<string>(c, "select id from insight_briefs where constituency_id = $1", [A]);
    await asService(c); await c.query("select set_brief_draft($1,'Draft prose written by the assistant')", [id]);
    expect((await c.query("select count(*)::int n from insight_briefs")).rows[0].n).toBeGreaterThanOrEqual(1);
    const officer = await createUser(c, "staff"); await addMember(c, officer, A, "case_officer");
    await actAs(c, officer);   // staff without analytics rights see no brief at all
    expect((await c.query("select count(*)::int n from insight_briefs where constituency_id = $1", [A])).rows[0].n).toBe(0);
    expect((await attempt(c, "select review_insight_brief($1,'approve','Reviewed and edited weekly note')", [id])).ok, "case officer cannot review").toBe(false);
    await actAs(c, await citizen(c, A));
    expect((await c.query("select count(*)::int n from insight_briefs")).rows[0].n, "citizens see none").toBe(0);
    await actAs(c, mgr);
    expect((await c.query("select count(*)::int n from insight_briefs where constituency_id = $1", [A])).rows[0].n).toBe(1);
    expect((await attempt(c, "select review_insight_brief($1,'approve','short')", [id])).ok, "text too short").toBe(false);
    expect((await c.query("select review_insight_brief($1,'approve','Reviewed and edited weekly note') r", [id])).rows[0].r.status).toBe("approved");
    expect((await attempt(c, "select review_insight_brief($1,'withdraw',null)", [id])).ok, "only once").toBe(false);
    await actAs(c, mp);
    expect((await c.query("select narrative from insight_briefs where constituency_id = $1", [A])).rows[0].narrative).toBe("Reviewed and edited weekly note");
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from notifications where user_id = $1 and type = 'brief_ready'", [mp])).toBe(2);   // ready for review, then shared
  })));

  it("exports: office with analytics rights only, no free text or identities, audited with the row count", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), u = await citizen(c, A);
    const officerA = await createUser(c, "staff"); await addMember(c, officerA, A, "case_officer");
    await createIssue(c, A, u); await createIssue(c, A, u);
    expect((await fn(c, u, "select export_rows('cases',$1,90,'csv')", [key])).ok, "citizen").toBe(false);
    expect((await fn(c, officerA, "select export_rows('cases',$1,90,'csv')", [key])).ok, "case officer has no analytics right").toBe(false);
    const otherMgr = await createUser(c, "staff"); await addMember(c, otherMgr, B, "office_manager");
    expect((await fn(c, otherMgr, "select export_rows('cases',$1,90,'csv')", [key])).ok, "other area").toBe(false);
    await actAs(c, mgr);
    const out = (await c.query("select export_rows('cases',$1,90,'csv') r", [key])).rows[0].r;
    expect(out.columns).toEqual(["ref", "category", "status", "source_channel", "created_at", "resolved_at", "public"]);
    expect(out.row_count).toBe(2); expect(JSON.stringify(out.rows)).not.toMatch(/test issue|reporter|@/);
    expect((await attempt(c, "select export_rows('secrets',$1,90,'csv')", [key])).ok).toBe(false);
    expect((await attempt(c, "select export_rows('ideas',$1,90,'docx')", [key])).ok).toBe(false);
    await actAsOwner(c);
    const a = await call<{ after_data: { kind: string; rows: number } }>(c, "select after_data from audit_logs where action = 'export.office' and resource_id = $1 order by created_at desc limit 1", [key]);
    expect(a.after_data).toMatchObject({ kind: "cases", rows: 2 });
  })));

  it("heatmap: cells under 5 issues are never returned, the hidden count is only a number, private locations are not used", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), u = await citizen(c, A);
    await actAsOwner(c);
    const mk = async (n: number, lat: number, lng: number, vis = true) => {
      for (let i = 0; i < n; i++) await c.query("insert into issues (reporter_id, title, category, description, constituency_id, lat, lng, public_lat, public_lng, public_visibility, location_source) values ($1,'t','roads','d',$2,$3,$4,$3,$4,$5,'device')", [u, A, lat, lng, vis]);
    };
    await mk(6, 23.8103, 90.4125); await mk(3, 23.9, 90.6); await mk(7, 23.7, 90.3, false);
    await actAs(c, null);
    const h = (await c.query("select public_heatmap($1,30,null,1000) r", [key])).rows[0].r;
    expect(h.cells).toHaveLength(1); expect(h.cells[0].count).toBe(6); expect(h.cells_hidden).toBe(1); expect(h.min_group_size).toBe(5);
    expect(JSON.stringify(h.cells)).not.toMatch(/23\.8103/);    // snapped to the cell centre, not an exact point
    expect((await attempt(c, "select public_heatmap($1,30,null,100)", [key])).ok, "cell size below 500 m").toBe(false);
    expect((await attempt(c, "select public_heatmap($1,30,'Roads;drop',1000)", [key])).ok).toBe(false);
    expect((await fn(c, null, "select office_clusters($1,30,null,250)", [key])).ok, "office only").toBe(false);
    await actAs(c, mgr);
    const o = (await c.query("select office_clusters($1,30,null,250) r", [key])).rows[0].r;
    expect(o.cells.every((x: { count: number }) => x.count >= 5)).toBe(true);
    expect(o.category_clusters).toEqual(expect.arrayContaining([expect.objectContaining({ category: "roads" })]));
  })));

  it("Release 1.1 KPIs: scoped to the caller, suppressed under 5, each with a definition", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), admin = await createUser(c, "admin");
    const otherMgr = await createUser(c, "staff"); await addMember(c, otherMgr, B, "office_manager");
    expect((await fn(c, otherMgr, "select release11_kpis($1,90)", [key])).ok).toBe(false);
    expect((await fn(c, mgr, "select release11_kpis(null,90)")).ok, "area managers cannot read the platform-wide view").toBe(false);
    await actAs(c, mgr);
    const k = (await c.query("select release11_kpis($1,90) r", [key])).rows[0].r;
    expect(Object.keys(k.kpis).sort()).toEqual(["area_alerts_sent", "channel_intake_share", "commitments_delivered", "consultation_participants", "consultation_report_rate", "idea_threshold_on_time", "priority_participants", "project_checkins", "satisfaction_average", "survey_responses"]);
    for (const v of Object.values(k.kpis) as { definition: string }[]) expect(v.definition.length).toBeGreaterThan(10);
    expect(k.kpis.consultation_participants).toMatchObject({ value: null, suppressed: true });
    await actAs(c, admin);
    expect((await attempt(c, "select release11_kpis(null,90)")).ok).toBe(true);
  })));

  it("jobs and flags: new job kinds are scheduled, the flags exist with honest labels, erasure removes votes, ranks, responses and numbers", () => withClient((c) => tx(c, async () => {
    await asService(c);
    await c.query("select ensure_periodic_jobs()");
    expect(await scalar(c, "select count(distinct kind)::int from background_jobs where kind in ('release11_maintenance','weekly_briefs')")).toBe(2);
    expect(await scalar(c, "select count(*)::int from feature_flags where key in ('whatsapp_intake','sms_intake','channel_notifications','read_aloud') and not enabled and data_status = 'planned'")).toBe(4);
    expect(await scalar(c, "select count(*)::int from feature_flags where key in ('consultations','project_checkins','idea_threshold','surveys','commitments','priority_ranking','weekly_briefs','exports') and enabled")).toBe(8);
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), u = await citizen(c, A);
    await actAs(c, mgr);
    const k = (await c.query("select create_consultation($1,'Which work is needed first?',null,array['Fix the market road','Build a drain'],$2) r", [key, future()])).rows[0].r;
    await c.query("select open_consultation($1)", [k.ref]);
    const s = (await c.query("select create_survey($1,'Erasure survey',null,$2::jsonb,null) r", [key, JSON.stringify([{ kind: "rating", prompt: "How are we doing?" }])])).rows[0].r;
    await c.query("select set_survey_status($1,'open')", [s.ref]);
    await actAsOwner(c);
    const st = (await c.query("select cs.id from consultation_statements cs join consultations x on x.id = cs.consultation_id where x.ref = $1 limit 1", [k.ref])).rows[0].id;
    await actAs(c, u);
    await c.query("select vote_consultation_statement($1,'agree')", [st]);
    const link = (await c.query("select start_channel_link('whatsapp','+8801712345670','2026-11') r")).rows[0].r;
    await asService(c); await c.query("select channel_confirm_link('whatsapp','+8801712345670',$1)", [link.code]);
    await c.query("select erase_user_data($1)", [u]);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from statement_votes where user_id = $1", [u])).toBe(0);
    expect(await scalar(c, "select address is null and status = 'revoked' from channel_links where user_id = $1", [u])).toBe(true);
  })));
});
