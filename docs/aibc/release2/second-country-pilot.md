# Second-country pilot: checklist before any activation (B8.10)

Status: **not started on purpose.** No country has been chosen. This page is the list of what must exist before `POST /country` can activate a country other than Bangladesh. The database enforces it: `set_country_adapter(..., activate => true)` refuses (409 `country_not_ready`) until `country_readiness(code)` shows all five gates `cleared`.

## Gates (each needs a document reference and the named external reviewer, recorded by an administrator with `PUT /admin/countries/{code}/gates/{gate}`)
| Gate | What the review must cover | Evidence to record |
|---|---|---|
| `legal_review` | Is a civic reporting and consultation platform lawful there? Liability for user content, defamation and election-period rules, rules on contacting officials | Opinion reference and the firm or counsel's name |
| `electoral_review` | Rules on political neutrality, campaigning, official-neutral language, treatment of candidates and parties, election-period silence | Opinion reference and reviewer |
| `data_protection_review` | Local data-protection law: lawful basis and consent, retention, cross-border transfer, children, data-subject rights, breach reporting | Opinion reference, DPIA reference |
| `language_review` | Native review of prompts, glossary, categories, notices and emergency guidance in each locale; evaluation set for that language | Reviewer and evaluation report reference |
| `hosting_residency` | Where data must be hosted, who may operate it, backup location | Memo reference and the hosting decision |

## What a new country needs in the code (data, not logic)
1. A `country_adapters` row (`POST /country` with `activate: false`): locale, currency, date format, timezone, administrative levels, identity checks, notification channels, emergency numbers.
2. A code-side adapter in `src/lib/country/<code>.ts` (phone rules, numerals) registered in `src/lib/country/index.ts`, modelled on `bd.ts`.
3. Admin units from a **sourced** file (`POST /admin/admin-units/import`), constituency data, the agency directory and categories, helplines (`/admin/helplines`), per-locale prompts, glossary and evaluation set.
4. Sourced emergency numbers and legal notices, reviewed locally.

Not built and not claimed: any second-country data, a pilot partner, hosting in another region, local-language AI evaluation numbers.
