import { describe, expect, it } from "vitest";
import { can, OFFICE_PERMISSIONS, type Actor, type OfficeAction, type OfficeRole } from "../../src/lib/auth";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

const ROLES: OfficeRole[] = ["case_officer", "office_manager", "mp", "agency_liaison"];
const ACTIONS: OfficeAction[] = ["view", "acknowledge", "assign", "request_information", "forward", "update", "resolve", "close", "view_analytics"];

describe("roles and scopes (migration 0006)", () => {
  it("DB permission matrix equals the TypeScript matrix", () => withClient(async (c) => {
    const { rows } = await c.query("select office_role, action, assigned_only from office_permissions");
    const db = rows.map((r) => `${r.office_role}:${r.action}:${r.assigned_only}`).sort();
    const ts = ROLES.flatMap((r) => Object.entries(OFFICE_PERMISSIONS[r]).map(([a, v]) => `${r}:${a}:${v!.assignedOnly}`)).sort();
    expect(db).toEqual(ts);
  }));

  it("office_can() agrees with can() for every role, action and assignment, and denies other constituencies", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c);
    const reporter = await createUser(c);
    for (const role of ROLES) {
      const uid = await createUser(c, "staff");
      await addMember(c, uid, A, role);
      const actor: Actor = { id: uid, role: "staff", aal: "aal1", offices: [{ constituencyId: A, constituencyKey: "a", officeRole: role }] };
      for (const action of ACTIONS) {
        for (const assigned of [true, false]) {
          const issue = await createIssue(c, A, reporter, assigned ? uid : null);
          await actAs(c, uid);
          const db = await scalar<boolean>(c, "select office_can($1, $2, $3)", [A, action, assigned ? uid : null]);
          await actAsOwner(c);
          expect(db, `${role}/${action}/assigned=${assigned}`).toBe(can(actor, action, { constituencyId: A, assignedTo: assigned ? uid : null }));
          expect(issue.id).toBeTruthy();
        }
        await actAs(c, uid);
        expect(await scalar<boolean>(c, "select office_can($1, $2, $3)", [B, action, uid]), `${role}/${action} in other constituency`).toBe(false);
        await actAsOwner(c);
      }
    }
  })));

  it("denies citizens, moderators, staff without membership, suspended members and suspended accounts", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const citizen = await createUser(c), moderator = await createUser(c, "moderator"), lone = await createUser(c, "staff");
    const suspendedMember = await createUser(c, "staff"); await addMember(c, suspendedMember, A, "office_manager", "suspended");
    const suspendedAccount = await createUser(c, "staff", "suspended"); await addMember(c, suspendedAccount, A, "office_manager");
    for (const [who, uid] of Object.entries({ citizen, moderator, lone, suspendedMember, suspendedAccount })) {
      await actAs(c, uid);
      expect(await scalar<boolean>(c, "select office_can($1, 'view', null)", [A]), who).toBe(false);
      expect(await scalar<number>(c, "select count(*)::int from office_scope()"), `${who} scope`).toBe(0);
      await actAsOwner(c);
    }
    await actAs(c, null);
    expect(await scalar<boolean>(c, "select office_can($1, 'view', null)", [A])).toBe(false);
  })));

  it("office_scope lists only the caller's constituencies; admin sees all", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c);
    const a = await createUser(c, "staff"); await addMember(c, a, A, "office_manager");
    const admin = await createUser(c, "admin");
    await actAs(c, a);
    expect((await c.query("select office_scope() as id")).rows.map((r) => r.id)).toEqual([A]);
    await actAsOwner(c);
    await actAs(c, admin);
    const ids = (await c.query("select office_scope() as id")).rows.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([A, B]));
    expect(await scalar<boolean>(c, "select is_admin()")).toBe(true);
    expect(await scalar<boolean>(c, "select office_can($1, 'close', null)", [B])).toBe(true);
  })));

  it("requires aal2 for MP, moderator and admin once enforce_mfa is on, and never for other staff", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const mp = await createUser(c, "staff"); await addMember(c, mp, A, "mp");
    const mgr = await createUser(c, "staff"); await addMember(c, mgr, A, "office_manager");
    const admin = await createUser(c, "admin"), mod = await createUser(c, "moderator");
    await c.query("update app_settings set value = 'true' where key = 'enforce_mfa'");
    const check = async (uid: string, aal: "aal1" | "aal2", sql: string) => { await actAs(c, uid, aal); const v = await scalar<boolean>(c, sql, sql.includes("$1") ? [A] : []); await actAsOwner(c); return v; };
    expect(await check(mp, "aal1", "select office_can($1,'view',null)")).toBe(false);
    expect(await check(mp, "aal2", "select office_can($1,'view',null)")).toBe(true);
    expect(await check(admin, "aal1", "select is_admin()")).toBe(false);
    expect(await check(admin, "aal2", "select is_admin()")).toBe(true);
    expect(await check(mod, "aal1", "select is_moderator()")).toBe(false);
    expect(await check(mod, "aal2", "select is_moderator()")).toBe(true);
    expect(await check(mgr, "aal1", "select office_can($1,'acknowledge',null)")).toBe(true);
  })));

  it("blocks self-promotion: a user cannot change their own role or status", () => withClient((c) => tx(c, async () => {
    const citizen = await createUser(c);
    await actAs(c, citizen);
    // No UPDATE policy on profiles: the write affects zero rows.
    const r = await c.query("update profiles set role = 'admin' where id = $1", [citizen]);
    expect(r.rowCount).toBe(0);
    await actAsOwner(c);
    expect(await scalar(c, "select role from profiles where id = $1", [citizen])).toBe("citizen");
    // Defence in depth: even if a permissive policy were added by mistake, the guard trigger refuses.
    await c.query("create policy tmp_open on profiles for update using (true)");
    await actAs(c, citizen);
    await expect(c.query("update profiles set role = 'admin' where id = $1", [citizen])).rejects.toMatchObject({ code: "42501" });
  })));

  it("only staff accounts can hold an active office membership", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const citizen = await createUser(c);
    await expect(addMember(c, citizen, A, "case_officer")).rejects.toMatchObject({ code: "23514" });
  })));

  it("users read their own memberships; managers also read their office roster",() => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c);
    const a = await createUser(c, "staff"), b = await createUser(c, "staff");
    await addMember(c, a, A, "office_manager"); await addMember(c, b, A, "case_officer");
    await actAs(c, b); // a case officer sees only their own membership
    expect((await c.query("select user_id from office_members")).rows.map((r) => r.user_id)).toEqual([b]);
    await actAs(c, a); // an office manager also sees the roster of their own office (needed to assign cases)
    expect((await c.query("select user_id from office_members")).rows.map((r) => r.user_id).sort()).toEqual([a, b].sort());
    await actAs(c, null);
    const anon = await attempt(c, "select 1 from office_members"); // anon holds no grant at all after 0007
    expect(anon.ok ? anon.rowCount : 0).toBe(0);
  })));
});
