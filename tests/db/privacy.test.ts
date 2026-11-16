import { describe, expect, it } from "vitest";
import { actAs, actAsOwner, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

describe("privacy and retention (migration 0021)", () => {
  it("export contains exactly one issue for a person with one issue", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), me = await createUser(c), other = await createUser(c);
    await createIssue(c, A, me); await createIssue(c, A, other);
    await actAs(c, me);
    const d = (await c.query("select export_my_data() as d")).rows[0].d;
    expect(d.issues).toHaveLength(1);
    expect(d.profile.id).toBe(me);
    expect(d.profile.role).toBeUndefined();
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from audit_logs where action='privacy.export' and resource_id=$1", [me])).toBe(1);
  })));

  it("anonymous callers cannot use the privacy functions", () => withClient((c) => tx(c, async () => {
    await c.query("set local role anon");
    for (const q of ["select export_my_data()", "select request_account_deletion()", "select update_my_profile('x')", "select record_consent('privacy','v1',true)"])
      expect((await attempt(c, q)).ok, q).toBe(false);
  })));

  it("only the service role can erase or run retention", () => withClient((c) => tx(c, async () => {
    const me = await createUser(c);
    for (const role of ["anon", "authenticated"]) {
      await c.query(`set local role ${role}`);
      expect((await attempt(c, "select erase_user_data($1)", [me])).ok, role).toBe(false);
      expect((await attempt(c, "select run_retention()")).ok, role).toBe(false);
      expect((await attempt(c, "select ops_health()")).ok, role).toBe(false);
      await c.query("reset role");
    }
  })));

  it("correction validates and is audited; consent grant and withdrawal are recorded", () => withClient((c) => tx(c, async () => {
    const me = await createUser(c);
    await actAs(c, me);
    expect((await attempt(c, "select update_my_profile('  ', 'fr')")).ok).toBe(false);
    expect((await attempt(c, "select update_my_profile('Rahim', 'bn')")).ok).toBe(true);
    await c.query("select record_consent('privacy_notice','v1',true)");
    await c.query("select record_consent('privacy_notice','v1',true)");
    await actAsOwner(c);
    expect(await scalar(c, "select display_name from profiles where id=$1", [me])).toBe("Rahim");
    expect(await scalar(c, "select count(*)::int from consents where user_id=$1 and consent_type='privacy_notice'", [me])).toBe(1);
    await actAs(c, me);
    await c.query("select record_consent('privacy_notice','v1',false)");
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from consents where user_id=$1 and withdrawn_at is not null", [me])).toBe(1);
    expect(await scalar(c, "select count(*)::int from audit_logs where resource_id=$1 and action like 'privacy.%'", [me])).toBe(4);
  })));

  it("erasure removes personal data, keeps the issue and the audit trail", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), me = await createUser(c);
    const issue = (await createIssue(c, A, me)).id;
    await c.query("insert into follows (user_id, target_type, category) values ($1,'category','road')", [me]).catch(() => null);
    await c.query("update issues set lat=23.7, lng=90.4 where id=$1", [issue]);
    await actAs(c, me);
    await c.query("select request_account_deletion()");
    expect((await c.query("select request_account_deletion() as r")).rows[0].r.status).toBe("requested"); // idempotent
    await actAsOwner(c);
    await c.query("set local role service_role");
    expect((await c.query("select erase_user_data($1) as r", [me])).rows[0].r.erased).toBe(true);
    await c.query("reset role");
    expect(await scalar(c, "select account_status from profiles where id=$1", [me])).toBe("deleted");
    expect(await scalar(c, "select display_name from profiles where id=$1", [me])).toBe("Deleted user");
    expect(await scalar(c, "select count(*)::int from issues where id=$1 and lat is null", [issue])).toBe(1);
    expect(await scalar(c, "select count(*)::int from follows where user_id=$1", [me])).toBe(0);
    expect(await scalar(c, "select count(*)::int from audit_logs where action in ('privacy.deletion_requested','privacy.erased') and resource_id=$1", [me])).toBe(2);
    expect(await scalar(c, "select status from deletion_requests where user_id=$1", [me])).toBe("completed");
  })));

  it("retention erases accounts after the 14-day grace and not before", () => withClient((c) => tx(c, async () => {
    const fresh = await createUser(c), old = await createUser(c);
    await c.query("insert into deletion_requests (user_id, requested_at) values ($1, now()), ($2, now() - interval '15 days')", [fresh, old]);
    await c.query("set local role service_role");
    const r = (await c.query("select run_retention() as r")).rows[0].r;
    await c.query("reset role");
    expect(r.accounts_erased).toBe(1);
    expect(await scalar(c, "select account_status from profiles where id=$1", [old])).toBe("deleted");
    expect(await scalar(c, "select account_status from profiles where id=$1", [fresh])).toBe("active");
  })));

  it("ops_health reports queue and AI error counts", () => withClient((c) => tx(c, async () => {
    await c.query("insert into ai_runs (agent, status) values ('intake','ok'), ('intake','timeout')");
    await c.query("set local role service_role");
    const h = (await c.query("select ops_health() as h")).rows[0].h;
    await c.query("reset role");
    expect(h.ai_errors_24h).toBeGreaterThanOrEqual(1);
    expect(h.ai_runs_24h).toBeGreaterThanOrEqual(2);
  })));
});
