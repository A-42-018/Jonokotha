import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

type Audit = { action: string; actor_id: string | null; actor_role: string | null; actor_kind: string; resource_type: string; resource_id: string | null;
  before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null; request_id: string | null; metadata: Record<string, unknown> };

const auditFor = async (c: Client, where: string, params: unknown[]) =>
  (await c.query(`select * from audit_logs where ${where} order by created_at, id`, params)).rows as Audit[];
const forIssue = (c: Client, id: string) => auditFor(c, "resource_type='issue' and resource_id=$1", [id]);
const asWithRequest = async (c: Client, uid: string | null, rid: string) => {
  await actAs(c, uid);
  await c.query("select set_config('request.headers', $1, true)", [JSON.stringify({ "x-jk-request-id": rid, "user-agent": "test" })]);
};

describe("audit log is append-only (migration 0010)", () => {
  it("refuses UPDATE, DELETE and TRUNCATE on audit_logs for every role", () => withClient((c) => tx(c, async () => {
    await c.query("insert into audit_logs (action, resource_type) values ('t.test','t')");
    for (const sql of ["update audit_logs set action='x'", "delete from audit_logs", "truncate audit_logs"]) {
      const r = await attempt(c, sql);
      expect(r, `owner: ${sql}`).toMatchObject({ ok: false, code: "23000" });
    }
    // The service role has no privilege to rewrite history at all; API roles have no access.
    for (const role of ["service_role", "authenticated", "anon"]) {
      await c.query(`set local role ${role}`);
      for (const sql of ["update audit_logs set action='x'", "delete from audit_logs", "truncate audit_logs"]) {
        expect((await attempt(c, sql)).ok, `${role}: ${sql}`).toBe(false);
      }
      await c.query("reset role");
    }
    expect(await scalar<number>(c, "select count(*)::int from audit_logs where action='t.test'")).toBe(1);
  })));

  it("refuses UPDATE, TRUNCATE, and DELETE of events while their issue exists; events go only with their issue", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), owner = await createUser(c);
    const issue = await createIssue(c, A, owner);
    await c.query("select transition_issue($1, 'acknowledged')", [issue.id]);
    expect(await scalar<number>(c, "select count(*)::int from issue_events where issue_id=$1", [issue.id])).toBe(2);
    for (const sql of ["update issue_events set public_message='rewritten'", "delete from issue_events", "truncate issue_events"]) {
      expect(await attempt(c, sql), sql).toMatchObject({ ok: false, code: "23000" });
    }
    expect(await attempt(c, "delete from issue_events where issue_id=$1", [issue.id])).toMatchObject({ ok: false, code: "23000" });
    // Deleting the issue (a privileged, audited act) is the only way the events disappear.
    expect(await attempt(c, "delete from issues where id=$1", [issue.id])).toMatchObject({ ok: true, rowCount: 1 });
    expect(await scalar<number>(c, "select count(*)::int from issue_events where issue_id=$1", [issue.id])).toBe(0);
    const del = (await forIssue(c, issue.id)).filter((a) => a.action === "issue.delete");
    expect(del).toHaveLength(1);
    expect(del[0].before_data).toMatchObject({ ref: issue.ref, status: "acknowledged" });
  })));
});

describe("every privileged change writes an audit row", () => {
  it("records issue creation, transitions, assignment, notes and referrals with actor, before/after and request id", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const citizen = await createUser(c), manager = await createUser(c, "staff"), officer = await createUser(c, "staff");
    await addMember(c, manager, A, "office_manager"); await addMember(c, officer, A, "case_officer");

    // Creation by the citizen themself.
    await asWithRequest(c, citizen, "req-create-0001");
    const { rows } = await c.query("insert into issues (reporter_id, title, category, description, constituency_id) values ($1,'t','roads','d',$2) returning id, ref", [citizen, A]);
    const issue = rows[0] as { id: string; ref: string };
    await actAsOwner(c);
    let log = await forIssue(c, issue.id);
    expect(log[0]).toMatchObject({ action: "issue.create", actor_id: citizen, actor_role: "citizen", actor_kind: "user", request_id: "req-create-0001", before_data: null });
    expect(log[0].after_data).toMatchObject({ ref: issue.ref, status: "submitted", reporter_id: citizen });

    // Status change by the manager.
    await asWithRequest(c, manager, "req-ack-000001");
    await c.query("select transition_issue($1, 'acknowledged', '{}', $2)", [issue.id, "req-ack-000001"]);
    await actAsOwner(c);
    log = await forIssue(c, issue.id);
    const ack = log.find((a) => a.action === "issue.status_change")!;
    expect(ack).toMatchObject({ actor_id: manager, actor_role: "staff", actor_kind: "user", request_id: "req-ack-000001" });
    expect(ack.before_data).toEqual({ status: "submitted" });
    expect(ack.after_data).toMatchObject({ status: "acknowledged", ref: issue.ref });

    // Assignment, note, referral.
    await asWithRequest(c, manager, "req-asg-000001");
    await c.query("select assign_issue($1,$2,'nearest')", [issue.id, officer]);
    await c.query("select add_issue_note($1,'internal remark',false)", [issue.id]);
    await c.query("select add_issue_note($1,'shown to the citizen',true)", [issue.id]);
    await c.query("select transition_issue($1,'referred_to_authority', $2)", [issue.id, JSON.stringify({ agency_name: "Road dept", contact_channel: "https://example.test", external_reference: "R-1" })]);
    await actAsOwner(c);
    log = await forIssue(c, issue.id);
    const byAction = (a: string) => log.filter((x) => x.action === a);
    expect(byAction("issue.assign")[0]).toMatchObject({ actor_id: manager, request_id: "req-asg-000001" });
    expect(byAction("issue.assign")[0].before_data).toEqual({ assigned_to: null });
    expect(byAction("issue.assign")[0].after_data).toMatchObject({ assigned_to: officer });
    expect(byAction("issue.note").map((n) => n.after_data!.is_public)).toEqual([false, true]);
    expect(byAction("issue.referral")[0].after_data).toMatchObject({ agency_name: "Road dept", external_reference: "R-1" });
    expect(byAction("issue.status_change").map((x) => x.after_data!.status)).toEqual(["acknowledged", "referred_to_authority"]);
    // Note text is not copied into the audit log (internal notes stay in issue_events).
    expect(JSON.stringify(log)).not.toMatch(/internal remark|shown to the citizen/);
  })));

  it("labels server/SQL changes as system actions, and never copies report text into the log", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), owner = await createUser(c);
    const issue = await createIssue(c, A, owner);
    await c.query("update issues set title='NEW-SECRET-TITLE', description='NEW-SECRET-DESCRIPTION', priority='high' where id=$1", [issue.id]);
    const upd = (await forIssue(c, issue.id)).find((a) => a.action === "issue.update")!;
    expect(upd).toMatchObject({ actor_id: null, actor_kind: "system", actor_role: null });
    expect(upd.before_data).toEqual({ priority: "normal" });
    expect(upd.after_data).toMatchObject({ priority: "high" });
    expect(upd.metadata).toEqual({ content_columns_changed: expect.arrayContaining(["title", "description"]) });
    expect(JSON.stringify(upd)).not.toMatch(/SECRET/);
    // A no-op update (only updated_at moves) writes nothing.
    const before = (await forIssue(c, issue.id)).length;
    await c.query("update issues set priority='high' where id=$1", [issue.id]);
    expect((await forIssue(c, issue.id)).length).toBe(before);
  })));

  it("records office memberships, platform roles, settings and the permission and transition rules", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const user = await createUser(c, "staff");
    await addMember(c, user, A, "case_officer");
    await c.query("update office_members set office_role='office_manager' where user_id=$1", [user]);
    await c.query("delete from office_members where user_id=$1", [user]);
    const mem = await auditFor(c, "resource_type='office_member'", []);
    const mine = mem.filter((m) => (m.after_data?.user_id ?? m.before_data?.user_id) === user);
    expect(mine.map((m) => m.action)).toEqual(["office_member.insert", "office_member.update", "office_member.delete"]);
    expect(mine[1].before_data).toMatchObject({ office_role: "case_officer" });
    expect(mine[1].after_data).toMatchObject({ office_role: "office_manager" });

    await c.query("update profiles set role='citizen' where id=$1", [user]);
    await c.query("update profiles set display_name='Renamed' where id=$1", [user]);   // not a privileged field
    const prof = await auditFor(c, "resource_type='profile' and resource_id=$1", [user]);
    // Two audited changes: the promotion to staff when the fixture was built, then the demotion. The rename is not audited.
    expect(prof.map((p) => p.action)).toEqual(["profile.update", "profile.update"]);
    expect(prof[0].after_data).toEqual({ role: "staff", account_status: "active" });
    expect(prof[1].before_data).toEqual({ role: "staff", account_status: "active" });
    expect(prof[1].after_data).toEqual({ role: "citizen", account_status: "active" });

    await c.query("update app_settings set value='true' where key='enforce_mfa'");
    const set = (await auditFor(c, "resource_type='setting' and resource_id='enforce_mfa'", []))[0];
    expect(set).toMatchObject({ action: "setting.update", before_data: { key: "enforce_mfa", value: false }, after_data: { key: "enforce_mfa", value: true } });

    await c.query("insert into office_permissions (office_role, action) values ('mp','resolve')");
    expect((await auditFor(c, "resource_type='permission' and resource_id='mp:resolve'", []))[0]).toMatchObject({ action: "permission.insert" });
    await c.query("delete from issue_transitions where from_status='resolved' and to_status='closed' and actor_kind='system'");
    expect((await auditFor(c, "resource_type='transition_rule'", []))[0]).toMatchObject({ action: "transition_rule.delete", resource_id: "resolved:closed:system" });
  })));

  it("takes the request id from the forwarded header or app.request_id, and ignores malformed ones", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), owner = await createUser(c);
    const run = async (setup: () => Promise<unknown>) => {
      await setup();
      const issue = await createIssue(c, A, owner);
      const row = (await forIssue(c, issue.id))[0];
      await c.query("select set_config('request.headers', '', true), set_config('app.request_id', '', true)");
      return row.request_id;
    };
    expect(await run(() => c.query("select set_config('request.headers', '{\"x-jk-request-id\":\"header-req-001\"}', true)"))).toBe("header-req-001");
    expect(await run(() => c.query("select set_config('app.request_id', 'job-run-000001', true)"))).toBe("job-run-000001");
    expect(await run(() => c.query("select set_config('request.headers', '{\"x-jk-request-id\":\"bad id <script>\"}', true)"))).toBeNull();
    expect(await run(() => c.query("select set_config('request.headers', '{\"x-jk-request-id\":\"short\"}', true)"))).toBeNull();
    expect(await run(async () => undefined)).toBeNull();
  })));
});

describe("administrator access to private records is audited", () => {
  it("record_admin_access writes a row for admins only", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const admin = await createUser(c, "admin"), manager = await createUser(c, "staff"), citizen = await createUser(c), mod = await createUser(c, "moderator");
    await addMember(c, manager, A, "office_manager");
    await asWithRequest(c, admin, "req-admin-0001");
    expect(await attempt(c, "select record_admin_access('issue', 'JK-2026-1001', '{\"why\":\"support ticket\"}')")).toMatchObject({ ok: true });
    await actAsOwner(c);
    const row = (await auditFor(c, "action='admin.access'", []))[0];
    expect(row).toMatchObject({ actor_id: admin, actor_role: "admin", resource_type: "issue", resource_id: "JK-2026-1001", request_id: "req-admin-0001", metadata: { why: "support ticket" } });
    for (const [who, uid] of Object.entries({ manager, citizen, mod })) {
      await actAs(c, uid);
      expect(await attempt(c, "select record_admin_access('issue', 'x')"), who).toMatchObject({ ok: false, code: "42501" });
      await actAsOwner(c);
    }
    await actAs(c, null);
    expect((await attempt(c, "select record_admin_access('issue', 'x')")).ok).toBe(false);
    await actAs(c, admin);
    expect(await attempt(c, "select record_admin_access('Bad Type!', 'x')")).toMatchObject({ ok: false, code: "22023" });
    await actAsOwner(c);
    expect(await scalar<number>(c, "select count(*)::int from audit_logs where action='admin.access'")).toBe(1);
  })));

  it("nobody but an admin can read the audit log, and nobody can write to it through the API", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const admin = await createUser(c, "admin"), manager = await createUser(c, "staff");
    await addMember(c, manager, A, "office_manager");
    await c.query("insert into audit_logs (action, resource_type) values ('t.probe','t')");
    const count = async (uid: string | null) => { await actAs(c, uid); const r = await attempt(c, "select count(*)::int n from audit_logs where action='t.probe'"); await actAsOwner(c); return r.ok ? (r.rows[0].n as number) : 0; };
    expect(await count(admin)).toBe(1);
    expect(await count(manager)).toBe(0);
    expect(await count(null)).toBe(0);
    for (const uid of [admin, manager, null]) {
      await actAs(c, uid);
      expect((await attempt(c, "insert into audit_logs (action, resource_type) values ('forged','x')")).ok).toBe(false);
      expect((await attempt(c, "select audit_write('forged','x','1',null,null)")).ok).toBe(false);
      await actAsOwner(c);
    }
  })));
});
