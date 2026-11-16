import { describe, expect, it } from "vitest";
import { actAs, actAsOwner, attempt, createUser, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";

describe("RLS: deletion_requests", () => {
  it("a person reads only their own request and cannot write the table directly", () => withClient((c) => tx(c, async () => {
    const a = await createUser(c), b = await createUser(c), admin = await createUser(c, "admin");
    await actAs(c, a); await c.query("select request_account_deletion()");
    await actAs(c, b); await c.query("select request_account_deletion()");
    await actAs(c, a);
    expect((await c.query("select user_id from deletion_requests")).rows.map((r) => r.user_id)).toEqual([a]);
    expect((await attempt(c, "insert into deletion_requests (user_id) values ($1)", [b])).ok).toBe(false);
    expect((await attempt(c, "update deletion_requests set status='cancelled'")).ok).toBe(false);
    expect((await attempt(c, "delete from deletion_requests")).ok).toBe(false);
    await actAs(c, admin);
    expect((await c.query("select count(*)::int n from deletion_requests")).rows[0].n).toBe(0);
    await actAsOwner(c);
  })));

  it("anonymous visitors see nothing", () => withClient((c) => tx(c, async () => {
    await c.query("set local role anon");
    expect((await attempt(c, "select * from deletion_requests")).ok).toBe(false);
  })));
});
