# Pilot plan (B6.1)

Status: **plan and tooling built; no pilot office is signed up.** Nothing below claims a partner, an office, a date or a number that does not exist. Fill the blanks in `[brackets]` when a real office agrees. Cost model: `cost-model.md`. Support: `support-escalation.md`. Training: `onboarding-training.md`.

## Goal

One verified MP office and one citizen tester group use the live product for [8] weeks, so that the team can measure (not assume) time to acknowledgement, routing accuracy, copilot handling time, accessibility task completion and the north-star metric (`kpi-baselines.md`).

## Scope

| Item | Decision |
|---|---|
| Constituency | One. Chosen by the office agreeing, not by the team. Recorded with `POST /api/v1/admin/pilot/sites` (admin) |
| Office | Verified before go-live: the representative is `verified` (`/admin/representatives/{id}/verify`, source link kept) and the office manager joined by invitation (`/office/invitations`). The site cannot be set to `live` without `office_verified_at`, a support contact, an escalation contact and at least one category (database rule) |
| Categories | Limited to [3 to 5], chosen with the office from those it can actually act on (for example roads, drainage, street lights, waste). The pilot site stores them; the report form offers them first and routes everything else to "other" with an honest note |
| Citizens | A tester group of [30 to 100], recruited by the office or a local organisation, each told in plain Bangla what the pilot is, that AI helps draft and that humans decide. Accounts use real email; no demo login |
| Data | Real reports are real: public pages show them. Testers are told before they post. The demo seed is not loaded into the pilot environment (demo and real stay separate, `data-sources.md`) |
| Languages | Bangla first, English available |
| Duration | [8] weeks plus a week of onboarding before and a week of review after |

## Entry checklist (all must be true before `live`)

- [ ] Production environment passes `npm run check:environment -- production` (`runbooks/environments.md`)
- [ ] `npm run check:release` passes; manual items in `docs/aibc/` signed off or listed as accepted risk
- [ ] Privacy notice and terms published; counsel status written down (`governance.md`)
- [ ] MFA enforced (`enforce_mfa = true`) and the office accounts have enrolled TOTP
- [ ] Demo login off, demo users deleted
- [ ] Office manager trained (`onboarding-training.md`) and has done the practice scenarios
- [ ] Support contact and escalation named and tested (a test message answered within the target)
- [ ] Incident lead and backup named (`runbooks/incident-response.md`)
- [ ] Helplines 999 and 333 verified by two people and visible (`data-sources.md`)
- [ ] Cost budget lines set (`cost-model.md`)
- [ ] Baseline snapshot taken for the week before go-live

## Run

| When | What | Owner |
|---|---|---|
| Week -1 | Onboarding, practice scenarios, test reports on staging | Support lead + office manager |
| Week 1 | Daily check of queue, errors and support messages; fix-forward only for blockers | Engineering on call |
| Weekly | 20-minute call with the office: what confused staff or citizens, what was wrong in AI drafts | Support lead |
| Week 4 | Mid-pilot KPI snapshot (draft, not published) | Engineering |
| Week [8] | Final snapshot, manual KPIs (accessibility task test, time study), publish with method | Admin |
| Week +1 | Review: keep, change or stop (criteria below) | Team + office |

## Stop and pause criteria

Pause (set the site `paused`, post a service notice) if any of: private data shown to the wrong person; a case lost or visibly wrong status; the office cannot staff the queue for more than [3] working days; repeated abuse the moderators cannot keep up with; legal advice to stop. Resume only after a written note of what changed.

## What success looks like (stated up front so it cannot be bent later)

Not a target for the product's worth; a set of questions the pilot answers: Did the office acknowledge faster than before (their own earlier figure, if they have one)? Did routing suggestions match their decisions often enough to keep showing them (`/admin/ai/routing-accuracy`)? Could testers finish the report task unaided, including by voice? Did the office keep using it in week 6 as much as in week 2? Results are published with their limits whatever they say.

## Open (needs people)

A real office and representative; the tester group; named support, escalation and incident owners; the budget lines; counsel's review; a decision on which categories. See `open-items.md`.
