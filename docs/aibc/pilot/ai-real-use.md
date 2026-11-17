# AI evaluation on real use (B6.5)

Code: migration `0062_eval_kpi_baselines.sql`, `src/lib/eval-real/`, routes `/me/eval-examples`, `/admin/ai/*`. Offline results stay in `../eval-baseline.md` and `../eval-results.md`; a real-use run is dated and written next to them.

## 1. Consented real examples in the eval set

1. The citizen grants the separate consent `ai_eval_example` (`POST /me/consents`), which can be withdrawn at any time. Not bundled with the privacy notice.
2. They offer one of **their own** reports: `POST /me/eval-examples {issue_ref, language?}`. The text is the report title and description, redacted again; demo issues are refused; one offer per report.
3. An administrator reviews the queue (`GET /admin/ai/eval-examples`) and approves with a category, an optional expected agency, and an explicit confirmation that no personal data remains (names and addresses are not auto-detected, so a person must look). The reviewer may replace the text with a cleaner version. Rejection deletes the text.
4. Withdrawing the consent, withdrawing the example (`DELETE /me/eval-examples/{id}`) or deleting the account blanks the text and removes it from the export.
5. `GET /admin/ai/eval-set` downloads the approved examples (audited, `no-store`). Save the file as `tests/ai/real/<date>.eval-real.json` (git-ignored: never commit it) and run `EVAL_REAL_EXPORT=tests/ai/real/<date>.eval-real.json npm run eval`; the real cases are added to the synthetic ones and reported together. Report real and synthetic results separately in the write-up.

Open: how many examples are enough to say anything (below ~30 per language nothing is stable); native-Bangla reviewers for the labels.

## 2. Routing accuracy against office decisions

`GET /admin/ai/routing-accuracy?days=90`: for issues with both an AI routing suggestion and an office referral, the share where the suggested agency equals the first agency the office forwarded to; overall and by confidence band; bands under 5 are hidden; demo issues excluded unless asked. A mismatch is data about the suggestion, not a mistake by the office. Needs real referrals, so it is meaningful only after the pilot has run.

## 3. Thresholds from measured baselines

`set_ai_threshold` (`POST /admin/ai/thresholds`) refuses a value without evidence: `n >= 30`, `metric`, `method`, `measured_on`. Keys: `duplicate_min_score`, `routing_min_confidence`, `stt_min_confidence`. `src/lib/eval-real/baseline.ts` computes candidates: `chooseDuplicateThreshold` (best recall that keeps precision at least 0.9) and `chooseRoutingConfidence` (lowest cut-off where accuracy above it meets 0.85, supported by enough cases) and returns the evidence object ready to post. Before and after values are in the audit log. **Status: the table and tooling exist; the running code still reads `DUPLICATE_MIN_SCORE` (default 0.80) from the environment and does not yet read the table.** Wire it when the first measured threshold exists; until then the default stands and says so.

## 4. Bangla speech test protocol (needs people and devices)

Goal: word error rate by district, age band and environment. Plan: [10+] volunteers per cell, consent in writing for the test (audio is not stored by the system; only aggregate results are), a fixed script of [20] civic sentences (including place names, numbers and a few Banglish words), recorded on mid-range Android phones in: quiet room, street, market, vehicle. Run each through the configured STT provider; score WER against the script by two native reviewers. Enter results with `POST /admin/ai/speech-tests` (consent flag required; aggregates only); `GET /admin/ai/speech-tests` gives sample-weighted WER by environment, age band and district. Decide the `stt_min_confidence` and the "type instead" prompt from the worst cell, not the average. Typing must stay available whatever the numbers say.
