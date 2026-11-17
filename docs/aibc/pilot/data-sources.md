# Real data ingestion, lineage and helplines (B6.2)

Code: `src/lib/ingest/` (robots, polite fetcher, parsers, runner), migration `0060_ingestion_helplines.sql`, routes under `/api/v1/admin/ingestion/*`, `/api/v1/admin/helplines*`, public `/api/v1/helplines` and `/api/v1/data-sources`, scheduled through `/api/internal/maintenance` (daily) or `/api/internal/ingest`.

## Rules the code enforces (not just policy)

| Rule | Where |
|---|---|
| A source is **disabled** until a person records they read the licence (`licence_ok`, `license_checked_at`); changing the URL or licence text voids that | CHECK constraint `ingestion_enable_needs_licence`; `register_ingestion_source` |
| **robots.txt is always obeyed** and cannot be turned off; a missing robots.txt (404) allows, anything else (403, 5xx, redirect, timeout) means do not fetch | `respect_robots` CHECK; `politeFetch` |
| **Rate limit**: at least `min_interval_ms` (default 5 s, minimum 1 s) between requests to a host, or the site's Crawl-delay if longer; sources are fetched one at a time | `politeFetch` |
| https only, no redirects followed, size cap per source, 15 s timeout, no cookies, honest User-Agent (`INGEST_USER_AGENT`) | `politeFetch` |
| **No personal data**: sources cannot be flagged as holding it; staged records containing an email address or a mobile number are stored rejected with the payload dropped | `personal_data` CHECK; `ingest_stage_records` |
| **Lineage**: each good fetch with a new checksum writes a `knowledge_sources` row (name, URL, licence, fetch time, sha-256, demo flag) and retires the previous one; `ingestion_runs` records every attempt (status, HTTP code, bytes, robots result) | `ingest_finish_run` |
| **Demo and real never mix**: `is_demo` follows the source into runs, records and knowledge; `knowledge_index_summary` counts them separately; public sources list shows only enabled, licence-checked sources | views |
| Nothing is published automatically: fetched data is **staged** for a person to review; boundaries go through the existing admin import (`POST /admin/constituencies/import`, source, licence and date required) | design |

## Candidate sources (licence status: NOT CHECKED, a person must do it)

Domains below are where to look, not claims about what is licensed. Record the real licence text and the date you read it in the source row.

| Key | Kind | Where to look | Licence note |
|---|---|---|---|
| `bd-admin-boundaries` | boundaries | Humanitarian Data Exchange (data.humdata.org), administrative boundaries for Bangladesh | Dataset page states the licence; read it, some are CC BY-IGO |
| `osm-bd` | osm | OpenStreetMap | ODbL 1.0: attribution "© OpenStreetMap contributors" is required and shown from `public_data_sources.attribution`; share-alike applies to derived databases |
| `bd-constituencies-mps` | representatives | Election Commission and Parliament websites | Government websites often have no open licence; get written permission or link out instead of copying |
| `bd-service-directory` | service_directory | National Portal (bangladesh.gov.bd) and agency sites | Same; use the links, keep facts minimal and cited |
| `bd-grs-link` | grs_link | The government grievance system's own site | Store the link and its check date only |
| `helpline-999`, `helpline-333` | helpline | Official pages of the services themselves | Evidence only: the page is checked for the number, nothing is copied |

Demo sources (flag `is_demo`) exist so the pipeline can be exercised without touching a real site; they are never shown as real.

## Run it

1. `POST /admin/ingestion/sources` registers a source (disabled).
2. Read the licence. `POST /admin/ingestion/sources/{key}/licence` `{license_ok: true, enable: true}`.
3. Dry-run once: `POST /admin/ingestion/sources/{key}/run` (admin, 3 per minute). Read `GET /admin/ingestion/runs?source=key` and `.../records`.
4. The daily maintenance job refreshes every source whose `refresh_hours` has passed. A source that returns an error does not delete earlier data; it shows in the runs list. Alerts: a failing source appears in the run list and the maintenance output (`ingestion`).

Never run the pipeline against a site just to test: use the unit tests (they inject a fake fetch) and at most one polite request to a source whose licence is checked.

## Helplines: verification before display

`public_helplines` (and `GET /api/v1/helplines`) shows a helpline only when all are true: status `verified`, a source link, a recorded verification method, and `review_due_at` in the future. So:

1. **Propose** (`POST /admin/helplines` or the ingestion evidence): number (3 to 6 digits), Bangla and English names, official source link. Status `pending`; invisible.
2. **Evidence**: a helpline ingestion source records whether the official page mentions the number as a whole token (`found`), a short snippet with personal data removed, and the page checksum. Evidence helps the reviewer; it never verifies by itself.
3. **Verify** (`POST /admin/helplines/{key}/verify`): a **different administrator** than the proposer states how it was verified (for example "read the official page and called the number on [date]", at least 10 characters), optionally the evidence checksum, and a validity of 7 to 365 days (default 90). A second-person rule is enforced by the database.
4. **Expiry**: after `review_due_at` the line disappears from the public view by itself; the maintenance job marks it `stale` so it appears in the review queue.
5. **Change**: any change to the number, name or source sends it back to `pending`.

Seeds: 999 (national emergency) and 333 (government information and services helpline) are the two the product must show; **neither is verified in this repository.** The pilot's first data task is two people verifying them and writing the method down.

## Open (needs people)

Licence reading for every source above; permission where a government site has no open licence; the actual two-person helpline verification; a decision on which real sources are worth the effort for the pilot (boundaries and the two helplines are the minimum); frontend to render `public_data_sources` attribution (ODbL) on the map screen and `public_helplines` in the emergency block.
