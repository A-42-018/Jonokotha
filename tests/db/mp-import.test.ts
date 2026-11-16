import { describe, expect, it } from "vitest";
import { actAs, actAsOwner, attempt, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

const SRC = { name: "Parliament list (test)", url: "https://www.parliament.gov.bd/members/list-of-members", license: "public record", fetched_at: "2026-11-16" };
const seat = (no: number, over: Record<string, unknown> = {}, mp: Record<string, unknown> | null = {}) => ({
  seat_no: no, key: `bd-${String(no).padStart(3, "0")}`, name_en: `Testdistrict-${no}`, name_bn: `পরীক্ষা-${no}`, aliases_en: [`Old-${no}`], division_en: "Dhaka", division_bn: "ঢাকা",
  district_en: "Testdistrict", district_bn: "পরীক্ষা", status: "serving", note: null, review: [],
  mp: mp && { name_en: "Person One", name_bn: "ব্যক্তি এক", party_en: "Independent", party_bn: "স্বতন্ত্র", elected_how: "general", elected_on: "2026-02-12", role_note: null, profile_url: "https://www.parliament.gov.bd/x", ...mp }, ...over });
const imp = (c: import("pg").Client, items: unknown[]) => c.query("select import_representatives($1, $2) as r", [SRC, JSON.stringify(items)]);
const seatCount = (c: import("pg").Client) => scalar<number>(c, "select count(*)::int from constituencies where seat_no between 1 and 3");

describe("import_representatives (migration 0024)", () => {
  it("is admin-only", () => withClient((c) => tx(c, async () => {
    await actAs(c, await createUser(c, "citizen"));
    expect(await attempt(c, "select import_representatives($1, $2)", [SRC, JSON.stringify([seat(1)])])).toMatchObject({ ok: false, code: "42501" });
    await actAs(c, await createUser(c, "admin"), "aal1");
    expect((await attempt(c, "select import_representatives($1, $2)", [SRC, JSON.stringify([seat(1)])])).ok).toBe(false);   // admin without MFA
  })));

  it("imports pending records, twice without duplicates, and audits it", () => withClient((c) => tx(c, async () => {
    await c.query("delete from constituencies where seat_no between 1 and 3");
    await actAs(c, await createUser(c, "admin"), "aal2");
    const first = (await imp(c, [seat(1), seat(2)])).rows[0].r;
    expect(first).toMatchObject({ seats: 2, new: 2, changed: 0 });
    const again = (await imp(c, [seat(1), seat(2)])).rows[0].r;
    expect(again).toMatchObject({ seats: 2, new: 0, changed: 0, unchanged: 2, terms_closed: 0 });
    await actAsOwner(c);
    expect(await seatCount(c)).toBe(2);
    expect(await scalar<number>(c, "select count(*)::int from representatives r join representative_constituencies rc on rc.representative_id=r.id join constituencies k on k.id=rc.constituency_id where k.seat_no in (1,2) and r.verification_status='pending'")).toBe(2);
    expect(await scalar<string[]>(c, "select aliases from constituencies where seat_no=1")).toEqual(["Old-1"]);
    expect(await scalar<number>(c, "select count(*)::int from audit_logs where action='representative.import'")).toBeGreaterThanOrEqual(2);
  })));

  it("closes the old term when a different person takes the seat, and when the seat becomes vacant", () => withClient((c) => tx(c, async () => {
    await c.query("delete from constituencies where seat_no between 1 and 3");
    await actAs(c, await createUser(c, "admin"), "aal2");
    await imp(c, [seat(1), seat(2)]);
    const r = (await imp(c, [seat(1, {}, { name_en: "Person Two", name_bn: "ব্যক্তি দুই", elected_how: "by_election", elected_on: "2026-10-29" }), seat(2, { status: "vacant" }, null)])).rows[0].r;
    expect(r).toMatchObject({ new: 1, terms_closed: 2 });
    await actAsOwner(c);
    expect(await scalar<number>(c, "select count(*)::int from representative_constituencies rc join constituencies k on k.id=rc.constituency_id where k.seat_no=1 and rc.valid_to is null")).toBe(1);
    expect(await scalar<string>(c, "select r.full_name from representatives r join representative_constituencies rc on rc.representative_id=r.id join constituencies k on k.id=rc.constituency_id where k.seat_no=1 and rc.valid_to is null")).toBe("Person Two");
    expect(await scalar<number>(c, "select count(*)::int from representative_constituencies rc join constituencies k on k.id=rc.constituency_id where k.seat_no=2 and rc.valid_to is null")).toBe(0);
    expect(await scalar<string>(c, "select seat_status from constituencies where seat_no=2")).toBe("vacant");
  })));

  it("sends a verified record back to pending when a fact changes, and keeps it when nothing changed", () => withClient((c) => tx(c, async () => {
    await c.query("delete from constituencies where seat_no between 1 and 3");
    await actAs(c, await createUser(c, "admin"), "aal2");
    await imp(c, [seat(3)]);
    await actAsOwner(c);
    await c.query("update representatives set verification_status='verified' where id in (select representative_id from representative_constituencies rc join constituencies k on k.id=rc.constituency_id where k.seat_no=3)");
    await actAs(c, await createUser(c, "admin"), "aal2");
    await imp(c, [seat(3)]);
    await actAsOwner(c);
    const st = () => scalar<string>(c, "select r.verification_status from representatives r join representative_constituencies rc on rc.representative_id=r.id join constituencies k on k.id=rc.constituency_id where k.seat_no=3");
    expect(await st()).toBe("verified");
    await actAs(c, await createUser(c, "admin"), "aal2");
    await imp(c, [seat(3, {}, { party_en: "Bangladesh Nationalist Party", party_bn: "বিএনপি" })]);
    await actAsOwner(c);
    expect(await st()).toBe("pending");
  })));

  it("refuses malformed items", () => withClient((c) => tx(c, async () => {
    await actAs(c, await createUser(c, "admin"), "aal2");
    expect(await attempt(c, "select import_representatives($1, $2)", [SRC, JSON.stringify([seat(1, { key: "x-1" })])])).toMatchObject({ ok: false, code: "JK002" });
    expect(await attempt(c, "select import_representatives($1, $2)", [SRC, JSON.stringify([seat(1, {}, null)])])).toMatchObject({ ok: false, code: "JK002" });
  })));
});
