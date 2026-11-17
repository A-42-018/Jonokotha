# Graph queries: PostgreSQL recursive queries or Apache AGE (B7.14)

Status: evaluation done on 2026-11-17 with the script `scripts/graph-bench.mjs`; raw output in `graph-bench-2026-11-17.json`. **Decision: stay on PostgreSQL recursive queries (`with recursive`) for now; revisit when one of the triggers below is met.**

## What the platform uses graph queries for
`graph_edges` (migration 0004) holds relationships such as `issue -duplicate_of-> issue` and `issue -routed_to-> agency`. The only traversal in production code today is the duplicate-cluster count in `analytics_overview()` (migration 0035): follow `duplicate_of` edges to a master, depth capped at 8, per area. Everything else (routing, referrals, projects) uses ordinary joins.

## What was measured
Synthetic data in a temporary table with the same shape and indexes as `graph_edges`: chains of 8 duplicate issues (depth 7 under each master, no cycles) plus unrelated `routed_to` edges. Local Supabase Postgres 17.11 in Docker on an Apple M2 laptop, macOS 26.2. Each point is the median of 5 timed runs after one warm-up run. This is a laptop, not production, and the data is synthetic: the numbers show how the query scales, not what a deployment will see.

| edges in table | one chain from one master (depth 8) | 5,000 masters at once, default plan | same, nested-loop/index plan forced |
|---|---|---|---|
| 13,750 | 0.43 ms | 23.02 ms | 24.12 ms |
| 137,500 | 0.45 ms | 143.97 ms | 86.61 ms |
| 1,375,000 | 0.52 ms | 3,481.12 ms | 142.46 ms |

What this says:
- Following one chain does not slow down as the table grows (indexed lookups per hop; about half a millisecond up to 1.4 million edges).
- The "all masters at once" query is where size hurts, and at 1.4 million edges almost all of that is the planner choosing a hash join that scans the whole edge table at every depth step. With the index plan forced it took 142 ms. So the first fix, when needed, is plan control (a materialised cluster table refreshed by a job, or per-master calls), not a new engine.
- The real `analytics_overview()` query seeds from the issues of one area, not 5,000 masters; it was not benchmarked at scale here.

## Apache AGE
- Not available in the local Supabase image: `select count(*) from pg_available_extensions where name = 'age'` returned 0 on 2026-11-17 (recorded in the JSON as `age_available_in_this_image: false`). Whether the hosted Supabase project offers it was **not checked** (it needs a look at the project's extension list or a question to the provider). No AGE numbers exist, so none are claimed.
- Adopting AGE would mean a self-managed Postgres or a provider that ships it, a second query language (openCypher) beside SQL, and RLS that does not apply to its graph tables the way it does to ours. For privacy-sensitive data under row-level security that is a real cost.

## Decision and triggers to revisit
Keep `with recursive` over `graph_edges`. Revisit when any one of these is true:
1. `graph_edges` passes about 5 million rows in production (at that point re-run `scripts/graph-bench.mjs --sizes 1000000,5000000` on production-like hardware).
2. A needed query has variable-length paths with more than 8 hops, or pattern matching over more than two relationship types, that is awkward in SQL.
3. The office dashboard's cluster query exceeds 500 ms at the 95th percentile (measure it first; the benchmark above is not that query).
4. The hosting provider offers AGE with row-level security preserved on graph tables.

Cheap steps to try before any engine change, in order: materialise duplicate clusters (refresh in the hourly job), add a partial index on `relation = 'duplicate_of'`, cap per-area traversal. Re-run: `node scripts/graph-bench.mjs --sizes 10000,100000,1000000` (local database only; it writes nothing permanent).
