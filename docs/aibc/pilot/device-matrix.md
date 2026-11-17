# Real-device pass (F6.5, masterplan §21.4)

Run the whole product on real hardware with production-sized data (hundreds of cases in the office queue, a full constituency list, 300 seats in the MP picker). Use the pilot build on a staging stack seeded with `npm run seed:demo` plus an import of volume data. Tick each cell with the date and tester; write any failure in the issues table with the screen, steps and a screenshot.

## Devices

| ID | Device | Browser | Mode |
|---|---|---|---|
| D1 | Low-end Android (2 GB RAM or less, Android 9 to 11) | Chrome | Browser |
| D2 | Current Android | Chrome | Browser and installed PWA |
| D3 | iPhone, current iOS | Safari | Browser and installed PWA |
| D4 | Desktop | Chrome, Firefox, Safari, Edge | Browser |

## Conditions (each on D1, D2 and D3)

| # | Condition | What to do | Expect |
|---|---|---|---|
| C1 | Slow 3G or unstable network | Open home, report, an issue page; toggle airplane mode mid-upload | Pages usable in a few seconds; skeletons not blank screens; upload retries with a visible state |
| C2 | Location permission denied | Start a report, deny location | Manual area choice works; no dead end |
| C3 | Camera permission denied | Report with a photo, deny camera | Gallery or text-only route works; message explains |
| C4 | Large or invalid upload | Pick a very large photo, a PDF, a corrupt image | Resized or rejected with a plain message; draft kept |
| C5 | Offline draft | Write a report offline, reconnect | Draft kept; sends once with no duplicate |
| C6 | Bangla input and font | Type conjuncts (ক্ষ, ঙ্গ, র‍্যা, ত্র), long Bangla text, voice | No broken glyphs, caret and wrapping correct |
| C7 | Large text and zoom | System font at 200%; browser zoom 200% | No clipped or overlapping text |
| C8 | Screen reader | TalkBack (Android), VoiceOver (iPhone) on report, status page, MP finder, help | Every control named; order sensible; errors announced (`docs/aibc/screen-reader-checklist.md`) |

## Flows (each in Bangla and English)

Citizen: sign in with code, report with photo and voice, follow the status, support an idea, find your MP, ask a question, open Help and send contact feedback, delete a draft, install the PWA, offline page.
Staff (desktop Chrome, plus one phone): sign in with the authenticator, first-run tour, queue with large volume, case workspace, AI suggestions accept/edit/dismiss, public reply with confirmation, announcements, office help page.

## Volume checks

- Office queue with 500 or more cases: scroll, filter and open a case without freezing on D1 (note the time to first usable view).
- Area picker over 300 seats: search by Bangla and English.
- Explore map with 1,000 or more markers: clusters render; pan stays smooth on D2.
- Run `npm run check:bundle` and the Lighthouse notes in `docs/aibc/lighthouse/` on the staging build.

## Results

| Device | Condition or flow | Result | Date | Tester | Issue |
|---|---|---|---|---|---|
| | | | | | Not run yet. |

## Issues

| # | Screen and steps | Device | Severity | Status |
|---|---|---|---|---|
