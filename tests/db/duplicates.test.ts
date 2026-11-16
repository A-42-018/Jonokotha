import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

/** A unit-ish 1024-d vector pointing mostly along axis `k`, with a little along `j` to control the angle. */
const vec = (k: number, j = 0, mix = 0) => { const v = new Array(1024).fill(0); v[k] += 1 - mix; v[j] += mix; return `[${v.join(",")}]`; };

async function world(c: Client) {
  const A = await createConstituency(c), B = await createConstituency(c);
  const owner = await createUser(c), manager = await createUser(c, "staff"), managerB = await createUser(c, "staff");
  await addMember(c, manager, A, "office_manager"); await addMember(c, managerB, B, "office_manager");
  const mk = async (cons: string, cat: string, v: string, area = "Ward 3") => {
    const { id } = await createIssue(c, cons, owner);
    await c.query("update issues set area=$2, category=$3, category_id=(select id from issue_categories where slug=$3) where id=$1", [id, area, cat]);
    await c.query("insert into issue_embeddings (issue_id, model, embedding) values ($1,'BAAI/bge-m3',$2)", [id, v]);
    return id;
  };
  const me = await mk(A, "roads", vec(0));
  const near = await mk(A, "roads", vec(0, 1, 0.1));       // cosine ~0.994
  const far = await mk(A, "roads", vec(2));                  // orthogonal
  const otherCat = await mk(A, "water", vec(0));
  const otherOffice = await mk(B, "roads", vec(0));
  return { A, B, owner, manager, managerB, me, near, far, otherCat, otherOffice };
}
const similar = (c: Client, id: string) => c.query("select * from find_similar_issues($1, 5, 0.8)", [id]).then((r) => r.rows);

describe("Duplicate Agent storage (migration 0013)", () => {
  it("finds only same-office, same-category issues above the threshold, with score and reasons", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    const rows = await similar(c, w.me);
    expect(rows.map((r) => r.issue_id)).toEqual([w.near]);
    expect(Number(rows[0].score)).toBeGreaterThan(0.99);
    expect(rows[0].reasons).toMatchObject({ same_category: true, same_constituency: true, same_area_text: true, master_candidate: true });
    expect(Object.keys(rows[0]).sort()).toEqual(["issue_id", "reasons", "ref", "score"]); // no text, no reporter data
  })));

  it("is closed to citizens, other offices and anonymous visitors", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    for (const u of [w.owner, w.managerB]) { await actAs(c, u); expect(await similar(c, w.me), u).toEqual([]); }
    await actAs(c, null);
    expect((await attempt(c, "select * from find_similar_issues($1)", [w.me])).ok).toBe(false);
  })));

  it("a zero-length vector never matches (NaN would otherwise compare as larger than every score)", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await c.query("update issue_embeddings set embedding=$2 where issue_id=$1", [w.far, `[${new Array(1024).fill(0).join(",")}]`]);
    await actAs(c, w.manager);
    expect((await similar(c, w.me)).map((r) => r.issue_id)).toEqual([w.near]);
  })));

  it("clients cannot read or write embeddings; duplicates and resolved issues are not suggested as masters", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    expect(await scalar(c, "select count(*)::int from issue_embeddings")).toBe(0); // RLS on, no policy
    expect((await attempt(c, "insert into issue_embeddings (issue_id, model, embedding) values ($1,'m',$2)", [w.me, vec(5)])).ok).toBe(false);
    await actAsOwner(c);
    await c.query("select set_config('app.in_transition','on',true)");
    await c.query("update issues set status='duplicate' where id=$1", [w.near]);
    await c.query("select set_config('app.in_transition','',true)");
    await actAs(c, w.manager);
    expect(await similar(c, w.me)).toEqual([]);
  })));

  it("keeps category, area and agency edges in sync when an issue changes", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    const edges = () => c.query("select relation, to_type, to_id from graph_edges where from_type='issue' and from_id=$1 order by relation", [w.me]).then((r) => r.rows);
    expect((await edges()).map((e) => e.relation)).toEqual(["in_area", "in_category"]);
    await c.query("update issues set category_id=(select id from issue_categories where slug='water') where id=$1", [w.me]);
    const after = await edges();
    expect(after.filter((e) => e.relation === "in_category")).toHaveLength(1);
    expect(after.find((e) => e.relation === "in_category")!.to_id).toBe(await scalar(c, "select id::text from issue_categories where slug='water'"));
  })));

  it("accepting a duplicate suggestion records duplicate_of; the master must be another issue of the same office", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    const sug = async (master: string) => scalar<string>(c, "insert into ai_suggestions (target_type,target_id,suggestion_type,payload) values ('issue',$1,'duplicate',$2::jsonb) returning id",
      [w.me, JSON.stringify({ master_id: master, master_ref: "x", score: 0.97 })]);
    const good = await sug(w.near), self = await sug(w.me), foreign = await sug(w.otherOffice);
    await actAs(c, w.manager);
    for (const id of [self, foreign]) expect(await attempt(c, "select decide_ai_suggestion($1,'accepted')", [id]), id).toMatchObject({ ok: false, code: "JK002" });
    expect((await attempt(c, "select decide_ai_suggestion($1,'accepted')", [good])).ok).toBe(true);
    await actAsOwner(c);
    expect((await c.query("select to_id, weight::float w, source from graph_edges where from_id=$1 and relation='duplicate_of'", [w.me])).rows)
      .toEqual([{ to_id: w.near, w: 0.97, source: "ai_suggestion_accepted" }]);
  })));

  it("dismissing records no edge", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    const id = await scalar<string>(c, "insert into ai_suggestions (target_type,target_id,suggestion_type,payload) values ('issue',$1,'duplicate',$2::jsonb) returning id", [w.me, JSON.stringify({ master_id: w.near })]);
    await actAs(c, w.manager);
    await c.query("select decide_ai_suggestion($1,'dismissed')", [id]);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from graph_edges where relation='duplicate_of' and from_id=$1", [w.me])).toBe(0);
  })));
});
