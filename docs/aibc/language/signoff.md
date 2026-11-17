# Native-speaker sign-off (F6.4)

Part of the Definition of Done from Phase 6 on (masterplan §19.1, §19.9): no user-facing string ships without a native Bangla speaker's plain-language check.

## What is checked

The automated tests (`tests/unit/language.test.ts`, `language-complete.test.tsx`) catch mixed scripts, ASCII digits, formal verb forms, the avoid-list, sentences over 20 words and missing keys. They cannot tell whether a sentence is natural or clear. The reviewer does that.

## Process

1. Regenerate the sheet: `EXPORT_STRINGS=docs/aibc/language/strings-review.csv npx vitest run tests/unit/export-strings.test.ts`. It lists every key with the Bangla and English text.
2. The reviewer (a native Bangla speaker who is not the author, preferably with basic education rather than a language specialist) fills `reviewer_ok (y/n)` and, for every `n`, `better_wording`. Emergency guidance (`emergency.ts`) gets a second reviewer.
3. A developer applies the wording, re-runs the tests, and regenerates the sheet. Rows already marked `y` with unchanged text stay `y`; changed text goes back to blank.
4. Record the round below.

## New in Phase 6

Staff tour and office help (`ot*`, `oh*`) and contact and feedback (`sp*`) are in `src/lib/strings/pilot.ts`. The sheet was regenerated with them; no row is marked reviewed yet.

## Sign-off log

| Date | Reviewer (initials, district) | Rows reviewed | Rows changed | Notes |
|---|---|---|---|---|
| | | | | None yet. Sign-off is still open. |
