// B7.14: measures PostgreSQL recursive graph queries on synthetic data in a TEMPORARY table (nothing persists). Local database only.
//   node scripts/graph-bench.mjs [--sizes 10000,100000,1000000]
// Output is JSON on stdout. Numbers in docs/aibc/graph-evaluation.md come from running this; do not quote numbers that were not measured.
import pg from "pg";
const URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(URL)) throw new Error("graph-bench only runs against a local database");
const i = process.argv.indexOf("--sizes");
const sizes = (i > 0 ? process.argv[i + 1] : "10000,100000,1000000").split(",").map(Number);
const RUNS = 5;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const c = new pg.Client({ connectionString: URL });
await c.connect();
const out = { measured_at: new Date().toISOString(), runs_per_point: RUNS, server: (await c.query("select version() v")).rows[0].v, age_available_in_this_image: (await c.query("select count(*)::int n from pg_available_extensions where name = 'age'")).rows[0].n > 0, results: [] };
const time = async (sql, params = []) => { const t = process.hrtime.bigint(); const r = await c.query(sql, params); return { ms: Number(process.hrtime.bigint() - t) / 1e6, rows: r.rows }; };

for (const n of sizes) {
  await c.query("drop table if exists pg_temp.bench_edges");
  // Same shape as graph_edges: many small duplicate chains (depth up to 8) plus unrelated edges. n = number of edges.
  await c.query("create temp table bench_edges (from_type text, from_id text, relation text, to_type text, to_id text)");
  // Chains of 8 issues: i(8k) is the master (head); i(8k+1) -> i(8k), i(8k+2) -> i(8k+1) ... up to i(8k+7). No cycles.
  await c.query(`insert into bench_edges
    select 'issue', 'i' || g, 'duplicate_of', 'issue', 'i' || (g - 1) from generate_series(1, $1::int) g where g % 8 <> 0`, [n]);
  await c.query("insert into bench_edges select 'issue', 'x' || g, 'routed_to', 'agency', 'a' || (g % 50) from generate_series(1, $1::int / 2) g", [n]);
  await c.query("create index bench_edges_to_idx on bench_edges (to_type, to_id, relation)");
  await c.query("create index bench_edges_from_idx on bench_edges (from_type, from_id, relation)");
  await c.query("analyze bench_edges");
  const total = (await c.query("select count(*)::int n from bench_edges")).rows[0].n;
  // 1) all members of one chain starting from a master (the query shape of analytics_overview's duplicate clusters, depth capped at 8)
  const chain = `with recursive chain (member_id, depth) as (select 'i8'::text, 0 union all select e.from_id, ch.depth + 1 from chain ch join bench_edges e on e.to_type = 'issue' and e.to_id = ch.member_id and e.relation = 'duplicate_of' and e.from_type = 'issue' where ch.depth < 8) select count(*)::int n from chain`;
  // 2) the whole-area cluster count: every root, all chains (what the office dashboard computes), depth capped at 8
  const all = `with recursive chain (root_id, member_id, depth) as (select x, x, 0 from (select 'i' || (8 * k) x from generate_series(1, 5000) k) h union all select ch.root_id, e.from_id, ch.depth + 1 from chain ch join bench_edges e on e.to_type = 'issue' and e.to_id = ch.member_id and e.relation = 'duplicate_of' and e.from_type = 'issue' where ch.depth < 8) select count(distinct root_id)::int roots, count(*)::int paths from chain`;
  const run = async (sql) => { const ts = []; let last; for (let k = 0; k < RUNS + 1; k++) { const r = await time(sql); if (k > 0) ts.push(r.ms); last = r.rows[0]; } return { median_ms: Math.round(median(ts) * 100) / 100, min_ms: Math.round(Math.min(...ts) * 100) / 100, max_ms: Math.round(Math.max(...ts) * 100) / 100, result: last }; };
  const base = { edges_total: total, one_chain_depth_8: await run(chain), five_thousand_roots_depth_8: await run(all) };
  // Same query with hash and merge joins disabled for this session, to see whether the slow case is the planner's join choice rather than the traversal itself.
  await c.query("set enable_hashjoin = off; set enable_mergejoin = off");
  base.five_thousand_roots_depth_8_nested_loop_index_plan = await run(all);
  await c.query("reset enable_hashjoin; reset enable_mergejoin");
  out.results.push(base);
}
await c.end();
console.log(JSON.stringify(out, null, 2));
