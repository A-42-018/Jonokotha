import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createUser, scalar, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";
import { buildWorld, userOf, WHO, type Who, type World } from "./world";

const RLS = "42501"; // insufficient_privilege: both RLS violations and missing grants

async function as<T>(c: Client, w: World, who: Who, fn: () => Promise<T>) {
  await actAs(c, userOf(w, who));
  try { return await fn(); } finally { await actAsOwner(c); }
}
const NEW_ISSUE = (reporter: string, col?: string, val?: string) =>
  `insert into issues (reporter_id, title, category, description, constituency_id${col ? `, ${col}` : ""}) values ('${reporter}', 't', 'roads', 'd', (select id from constituencies limit 1)${val ? `, ${val}` : ""})`;

describe("RLS write rules", () => {
  it("citizens create issues only as themselves with a clean initial state", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    expect((await as(c, w, "citizenA", () => attempt(c, NEW_ISSUE(w.citizenA)))).ok).toBe(true);
    const forged = await as(c, w, "citizenA", () => attempt(c, NEW_ISSUE(w.citizenB)));
    expect(forged).toMatchObject({ ok: false, code: RLS });
    const bad: [string, string][] = [["status", "'resolved'"], ["assigned_to", `'${w.officeA}'`], ["priority", "'urgent'"], ["is_demo", "true"], ["public_visibility", "false"]];
    for (const [col, val] of bad) {
      const r = await as(c, w, "citizenA", () => attempt(c, NEW_ISSUE(w.citizenA, col, val)));
      expect(r, `${col}=${val}`).toMatchObject({ ok: false, code: RLS });
    }
    expect(await as(c, w, "anon", () => attempt(c, NEW_ISSUE(w.citizenA)))).toMatchObject({ ok: false, code: RLS });
  })));

  it("suspended accounts cannot submit", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    await c.query("update profiles set account_status='suspended' where id=$1", [w.citizenA]);
    expect(await as(c, w, "citizenA", () => attempt(c, NEW_ISSUE(w.citizenA)))).toMatchObject({ ok: false, code: RLS });
  })));

  it("only the owning office can change status; citizens, other offices and moderators cannot", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    const ack = (who: Who, id: string) => as(c, w, who, () => attempt(c, "select transition_issue($1, 'acknowledged')", [id]));
    // Citizens (even the owner), other offices and moderators are refused; issues they cannot see look like "not found".
    for (const who of ["anon", "citizenA", "citizenB", "officeB", "moderator"] as Who[]) {
      expect((await ack(who, w.issueA.id)).ok, `${who} acknowledging issue A`).toBe(false);
    }
    expect(await ack("officeA", w.issueA.id)).toMatchObject({ ok: true, rowCount: 1 });
    expect(await ack("officeA", w.issueB.id)).toMatchObject({ ok: false, code: "JK404" });
    expect(await ack("admin", w.issueB.id)).toMatchObject({ ok: true, rowCount: 1 });
    expect(await scalar(c, "select status::text from issues where id=$1", [w.issueA.id])).toBe("acknowledged");
  })));

  it("status and workflow columns cannot be edited directly, even by the owning office or admin", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of ["officeA", "admin"] as Who[]) {
      for (const set of ["status='acknowledged'", `assigned_to='${w.officeA}'`, "resolution_note='x'", "resolved_at=now()", "appeal_route='x'"]) {
        const r = await as(c, w, who, () => attempt(c, `update issues set ${set} where id=$1`, [w.issueA.id]));
        expect(r, `${who} ${set}`).toMatchObject({ ok: false, code: RLS });
      }
    }
    // Not even the trusted server may skip the state machine for status.
    expect(await attempt(c, "update issues set status='closed' where id=$1", [w.issueA.id])).toMatchObject({ ok: false, code: RLS });
  })));

  it("nobody rewrites the content of a report through a user session", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of ["officeA", "admin"] as Who[]) {
      for (const set of ["title='x'", "description='x'", `reporter_id='${w.citizenB}'`, "area='x'", "is_demo=true"]) {
        const r = await as(c, w, who, () => attempt(c, `update issues set ${set} where id=$1`, [w.issueA.id]));
        expect(r, `${who} ${set}`).toMatchObject({ ok: false, code: RLS });
      }
    }
  })));

  it("case officers, MPs and agency liaisons cannot acknowledge (a manager action), even on their own assigned issue", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const role of ["case_officer", "mp", "agency_liaison"]) {
      const u = await createUser(c, "staff"); await addMember(c, u, w.A, role);
      await c.query("update issues set assigned_to=$1 where id=$2", [u, w.issueA.id]);
      await actAs(c, u);
      const r = await attempt(c, "select transition_issue($1, 'acknowledged')", [w.issueA.id]);
      await actAsOwner(c);
      expect(r.ok, role).toBe(false);
    }
  })));

  it("nobody deletes issues or events through the API", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of WHO) {
      for (const t of ["issues", "issue_events", "audit_logs", "notifications", "consents", "profiles", "ai_runs"]) {
        const r = await as(c, w, who, () => attempt(c, `delete from ${t}`));
        expect(r.ok ? r.rowCount : 0, `${who} delete from ${t}`).toBe(0);
      }
    }
    expect(await scalar<number>(c, "select count(*)::int from issues where id = any($1::uuid[])", [[w.issueA.id, w.issueB.id]])).toBe(2);
  })));

  it("server-written tables refuse inserts from every user session", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    const inserts: Record<string, string> = {
      audit_logs: "insert into audit_logs (action, resource_type) values ('x','y')",
      notifications: `insert into notifications (user_id, type, title) values ('${w.citizenA}','t','x')`,
      ai_runs: "insert into ai_runs (agent, status) values ('intake','ok')",
      ai_suggestions: `insert into ai_suggestions (target_type, target_id, suggestion_type, payload) values ('issue','${w.issueA.id}','x','{}')`,
      graph_edges: "insert into graph_edges (from_type, from_id, relation, to_type, to_id) values ('a','1','r','b','2')",
      issue_events: `insert into issue_events (issue_id, event_type) values ('${w.issueA.id}','note')`,
      issue_assignments: `insert into issue_assignments (issue_id, assigned_to) values ('${w.issueA.id}','${w.officeA}')`,
      issue_agency_referrals: `insert into issue_agency_referrals (issue_id, agency_name) values ('${w.issueA.id}','x')`,
      office_members: `insert into office_members (user_id, constituency_id) values ('${w.officeA}','${w.A}')`,
      app_settings: "insert into app_settings (key, value) values ('x','1')",
      representatives: "insert into representatives (full_name) values ('x')",
      knowledge_chunks: "insert into knowledge_chunks (source_id, content) select id, 'x' from knowledge_sources limit 1",
    };
    for (const who of WHO) for (const [t, sql] of Object.entries(inserts)) {
      const r = await as(c, w, who, () => attempt(c, sql));
      expect(r.ok, `${who} insert into ${t}`).toBe(false);
    }
  })));

  it("users change only their own notification read flag, consent withdrawal and preferences", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    expect(await as(c, w, "citizenA", () => attempt(c, "update notifications set read_at=now() where id=$1", [w.notifA]))).toMatchObject({ ok: true, rowCount: 1 });
    expect(await as(c, w, "citizenB", () => attempt(c, "update notifications set read_at=now() where id=$1", [w.notifA]))).toMatchObject({ ok: true, rowCount: 0 });
    expect(await as(c, w, "citizenA", () => attempt(c, "update notifications set title='x' where id=$1", [w.notifA]))).toMatchObject({ ok: false, code: RLS });
    expect(await as(c, w, "citizenA", () => attempt(c, "update consents set withdrawn_at=now() where id=$1", [w.consentA]))).toMatchObject({ ok: true, rowCount: 1 });
    expect(await as(c, w, "citizenA", () => attempt(c, "update consents set policy_version='v9' where id=$1", [w.consentA]))).toMatchObject({ ok: false, code: RLS });
    expect(await as(c, w, "citizenA", () => attempt(c, "insert into consents (user_id, consent_type, policy_version) values ($1,'push','v1')", [w.citizenA]))).toMatchObject({ ok: true });
    expect(await as(c, w, "citizenA", () => attempt(c, "insert into consents (user_id, consent_type, policy_version) values ($1,'push','v1')", [w.citizenB]))).toMatchObject({ ok: false, code: RLS });
    expect(await as(c, w, "citizenA", () => attempt(c, "update user_preferences set voice_first=true where user_id=$1", [w.citizenA]))).toMatchObject({ ok: true, rowCount: 1 });
    expect(await as(c, w, "citizenA", () => attempt(c, "update user_preferences set voice_first=true where user_id=$1", [w.citizenB]))).toMatchObject({ ok: true, rowCount: 0 });
  })));

  it("citizens attach media only to their own issues, as private and pending", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    const ins = (who: Who, uploader: string, issue: string, extra = "'private','pending'") =>
      as(c, w, who, () => attempt(c, `insert into issue_media (issue_id, uploader_id, storage_path, media_type, visibility, moderation_status) values ($1,$2,'x','image',${extra})`, [issue, uploader]));
    expect(await ins("citizenA", w.citizenA, w.issueA.id)).toMatchObject({ ok: true });
    expect(await ins("citizenB", w.citizenB, w.issueA.id)).toMatchObject({ ok: false, code: RLS });
    expect(await ins("citizenA", w.citizenB, w.issueA.id)).toMatchObject({ ok: false, code: RLS });
    expect(await ins("citizenA", w.citizenA, w.issueA.id, "'public','approved'")).toMatchObject({ ok: false, code: RLS });
  })));

  it("nobody can promote themselves or change their own profile", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of ["citizenA", "officeA", "moderator", "admin"] as Who[]) {
      const r = await as(c, w, who, () => attempt(c, "update profiles set role='admin' where id=$1", [w[who as "citizenA"]]));
      expect(r.ok ? r.rowCount : 0, who).toBe(0);
    }
    expect(await scalar(c, "select role from profiles where id=$1", [w.citizenA])).toBe("citizen");
  })));

  it("the legacy compatibility view enforces the same rules", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    // The deployed app inserts through the view as the signed-in citizen (as itself only).
    const legacyInsert = (who: Who, reporter: string) => as(c, w, who, () => attempt(c,
      "insert into cases (reporter_id,title,category,description,area,constituency_key,ai_summary,ai_agency,ai_confidence,ai_similar) values ($1,'t','roads','d','x','demo-1','s','ag-lged',0.7,'{}') returning ref", [reporter]));
    expect(await legacyInsert("citizenA", w.citizenA)).toMatchObject({ ok: true, rowCount: 1 });
    expect(await legacyInsert("citizenA", w.citizenB)).toMatchObject({ ok: false });
    expect(await legacyInsert("anon", w.citizenA)).toMatchObject({ ok: false });
    const upd = (who: Who) => as(c, w, who, () => attempt(c, "update cases set status='acknowledged' where ref=$1", [w.issueA.ref]));
    for (const who of ["anon", "citizenA", "citizenB", "officeB", "moderator"] as Who[]) {
      const r = await upd(who);
      expect(r.ok ? r.rowCount : 0, who).toBe(0);
    }
    expect(await upd("officeA")).toMatchObject({ ok: true, rowCount: 1 });
  })));
});
