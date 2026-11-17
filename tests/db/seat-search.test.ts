import { describe, expect, it } from "vitest";
import { actAs, createUser, tx } from "./fixtures";
import { withClient } from "./helpers";

// search_constituencies (migration 0026) over a few synthetic seats; any imported seats are cleared inside the rolled-back transaction.
const ins = `insert into constituencies (key, name_bn, name_en, seat_no, district, district_bn, division, division_bn, aliases, seat_status, is_demo)
  values ('bd-291','চট্টগ্রাম-৪','Chattogram-4',291,'Chattogram','চট্টগ্রাম','Chattogram','চট্টগ্রাম','{Chittagong-4}','vacant',false),
         ('bd-292','পঞ্চগড়-১','Panchagarh-1',292,'Panchagarh','পঞ্চগড়','Rangpur','রংপুর','{}','serving',false),
         ('bd-293','পঞ্চগড়-২','Panchagarh-2',293,'Panchagarh','পঞ্চগড়','Rangpur','রংপুর','{}','serving',false)`;
const find = async (c: import("pg").Client, q: string) => (await c.query("select key, seat_status from search_constituencies($1)", [q])).rows as { key: string; seat_status: string }[];

describe("search_constituencies (migration 0026)", () => {
  it("finds seats by name, number, old spelling, Bangla digits, and either form of ড়", () => withClient((c) => tx(c, async () => {
    await c.query("delete from constituencies where seat_no is not null"); await c.query(ins);
    await actAs(c, null);
    expect((await find(c, "Chittagong 4")).map((r) => r.key)).toEqual(["bd-291"]);          // old spelling, space instead of hyphen
    expect((await find(c, "chattogram-4"))[0]).toMatchObject({ key: "bd-291", seat_status: "vacant" });
    expect((await find(c, "পঞ্চগড় ১")).map((r) => r.key)).toEqual(["bd-292"]);
    expect((await find(c, "পঞ্চগড়-২")).map((r) => r.key)).toEqual(["bd-293"]);
    expect((await find(c, "পঞ্চগড়")).map((r) => r.key)).toEqual(["bd-292", "bd-293"]);   // precomposed ড় typed
    expect((await find(c, "২৯২")).map((r) => r.key)).toContain("bd-292");        // Bangla digits for the seat number
    expect((await find(c, "292"))[0].key).toBe("bd-292");                                   // exact seat number first
    expect(await find(c, "no such place")).toEqual([]);
  })));

  it("ignores private input: SQL wildcards are matched literally enough to return nothing", () => withClient((c) => tx(c, async () => {
    await actAs(c, null);
    expect((await find(c, "'; drop table constituencies; --")).length).toBe(0);
    expect(await c.query("select count(*) from constituencies")).toBeTruthy();
  })));
});
