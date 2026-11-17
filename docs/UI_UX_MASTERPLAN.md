# Jonokotha UI/UX implementation masterplan

**Status:** Proposed product and delivery plan  
**Product:** Jonokotha (জনকথা) / Your MP  
**Primary audience:** Residents in Bangladesh using a phone, with Bangla as the default language  
**Related plans:** `docs/frontend.md`, `docs/backend.md`, `docs/WORK_SPLIT.md`

## 1. Purpose

This plan turns the global civic-platform review into an implementable experience for Jonokotha. It gives residents a clear way to report and follow local problems, contact or learn about representatives, and participate in local decisions. It also gives office staff a manageable queue and a safe way to publish updates.

The first release should make one journey dependable end to end: **choose an area → report a problem → receive a reference → understand progress**. Representative accountability and public deliberation should be distinct journeys that can be added after the reporting loop works.

This document complements the detailed frontend and backend plans. It defines product behavior, screen responsibilities, sequencing and acceptance gates. API schemas, migrations and component-level task lists remain owned by those plans and by the shared contract in `docs/WORK_SPLIT.md`.

## 2. Product outcomes and guardrails

### Outcomes

1. A resident can describe a local problem in everyday Bangla without knowing the responsible department.
2. A resident understands what information is required, who receives a report, what is visible publicly and how to follow progress.
3. Staff can triage, route and update reports without losing the distinction between private staff notes and public replies.
4. Residents can find their representative and, later, participate in a clearly explained idea or consultation process.

### Guardrails

- **Bangla first, English complete.** No feature should work only in English. The language choice persists across routes and messages.
- **Mobile first and low bandwidth aware.** Keep the first screen light. Text entry works without a map, photo, microphone, notification permission or app installation.
- **AI assists; people decide.** AI drafts and suggestions are visibly labelled, editable and dismissible. AI never submits, routes externally, publishes a reply or changes status on its own.
- **Be exact about status.** Show only actions and dates recorded by an authorized person or system event. Do not imply an agency accepted or resolved a report if that has not been recorded.
- **Make privacy visible before submission.** Explain which fields are private, which may be public and how location is represented. Public pages never expose reporter identifiers or precise private location.
- **Do not imply official authority.** Clearly identify the office or agency responsible for each action. If Jonokotha is not the official intake channel, say so beside submission and in help content.
- **No dead ends.** Every form, permission request, API error and unavailable feature has a recovery path or manual alternative.
- **Demo data stays unmistakable.** Sample areas, accounts and reports have persistent sample labels and cannot be confused with real submissions.

## 3. Research synthesis

The source workbook is `docs/research/Your_MP_Global_Civic_Tech_Platforms.xlsx`. It reviews 32 platforms. For planning, their main user jobs can be grouped as follows; several platforms span more than one group.

| User job | Platforms reviewed | Product lesson |
|---|---|---|
| Report and track local problems | FixMyStreet, SeeClickFix, Traffy Fondue, OneService, CPGRAMS, I Change My City, Ushahidi, Marea Digital | Route by area and issue type so residents do not need to pick an office. Return a reference and a readable progress history. |
| Contact or monitor representatives | WriteToThem, Abgeordnetenwatch, TheyWorkForYou, OpenParliament.ca, Mzalendo | Make the representative discoverable by location and show responses and sourced public information. |
| Propose ideas, petitions, votes or budgets | Decidim, CONSUL Democracy, Your Priorities, Better Reykjavik, ManaBalss, Purpoz, vTaiwan, Join, Ethelo, LiquidFeedback | Give proposals a visible process: submission, review, discussion or support, decision and follow-up. |
| Participate in consultations or deliberation | Go Vocal, Polco, Zencity, EngagementHQ, Polis, MyGov India, Have Your Say, Remesh | State what question is open, how feedback will be used, when it closes and what happened afterward. |
| Request public records | WhatDoTheyKnow | Guide people through a formal request and make response status understandable. |

The workbook marks 31 entries as accessible and flags Marea Digital as inaccessible. The workbook does not define its accessibility test; treat this as an access/reachability note, not evidence of WCAG conformance. Platform features and availability change, so verify a reference again before adopting it as a dependency.

Useful interaction references include [FixMyStreet's citizen reporting guide](https://fixmystreet.org/training/citizens/), [OneService's case tracking FAQ](https://www.oneservice.gov.sg/osapp-faq/), the [CPGRAMS grievance guide](https://pgportal.gov.in/Home/Preview/Q29tcHJlaGVuc2l2ZUd1aWRlbGluZXNGb3JIYW5kbGluZ1RoZVB1YmxpY0dyaWV2YW5jZXMucGRm), [Decidim's overview](https://docs.decidim.org/en/develop/whitepaper/decidim-a-brief-overview.html), and [Polis documentation](https://pol-is.github.io/polis-documentation/welcome/Overview.html). Borrow the clear workflows, not every platform's identity, data requirements or governance model.

## 4. Current product baseline

The current app has a Bangla/English shell, a home screen, email sign-in, a report form with voice input and AI draft editing, a public issue page with a timeline, and an office queue and case detail. These are a useful core for the first release.

Current paths are `/`, `/login`, `/report`, `/issue/[ref]`, `/office` and `/office/[ref]`. The home page currently exposes the report and office links. An unauthenticated visit to `/report` redirects to sign-in. The report form does not yet provide robust user-visible request errors, the initial text area and login email need explicit labels, and the public issue page is a minimal status timeline. The office list has no visible search or filters.

Relevant starting files include `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/report/page.tsx`, `src/app/issue/[ref]/page.tsx`, `src/app/office/page.tsx`, `src/components/ReportForm.tsx`, `src/components/LoginForm.tsx` and `src/lib/i18n.ts`.

## 5. Information architecture

### Resident navigation

**Phone bottom navigation:** `হোম` · `অভিযোগ` · `মতামত` · `প্রতিনিধি` · `আমার`  
**Desktop navigation:** same destinations in a top navigation bar. Keep the language switch and selected area visible. Keep staff tools behind staff sign-in.

| Destination | Purpose | Initial release behavior |
|---|---|---|
| Home | Choose a task and see area updates | Main report action, status lookup, area selector and recent public updates |
| অভিযোগ | Create and follow service reports | Report wizard and My Reports list |
| মতামত | Ideas and consultations | Hide until at least one complete, staffed process is available; do not show dead links |
| প্রতিনিধি | Find a representative and see office information | Begin with verified area lookup and a sourced representative card; expand to public Q&A later |
| আমার | Account, language and notification preferences | Sign-in state, saved items and privacy/help links |

### Staff navigation

- **Inbox:** searchable and filterable cases for the staff member's assigned area and role.
- **Case workspace:** resident report, location, timeline, assignment, AI suggestions, public reply composer and a clearly separated internal note area.
- **Office settings:** only for authorized managers; office coverage, categories and response targets.

### Later public routes

Add routes only when the matching workflows and backend permissions exist: issue discovery/map, representative profile and questions, idea details, consultation details/results, public project updates, help/safety, privacy and accessibility information.

## 6. Resident journeys

### 6.1 First visit and area selection

1. The header shows `আপনার এলাকা` and a clear `এলাকা নির্বাচন করুন` action when unset.
2. Let residents search by familiar place name or choose a verified administrative path (district/upazila/ward/constituency, based on available data). Location permission is optional.
3. Explain in one sentence why the area matters: it helps route the report and show local updates.
4. Persist the selection and keep it visible and editable. If the area cannot be matched to a staffed office, explain the fallback before the report is sent.
5. Use sample area labels in demo mode; never make a sample look like a real constituency.

### 6.2 Report a problem

Use a short, resumable wizard. A stepper shows progress and lets the user move back without losing entered details.

| Step | Resident-facing prompt | Requirements and behavior |
|---|---|---|
| 1. Issue type | `কী সমস্যা?` | Familiar categories with text and icon: রাস্তা/ফুটপাত, পানি/ড্রেন, বিদ্যুৎ/বাতি, ময়লা, স্বাস্থ্য, শিক্ষা, নিরাপত্তা, অন্যান্য. Keep the detailed category list behind a simple first choice where needed. |
| 2. Description | `কী হয়েছে? লিখুন বা বলুন` | Typed text always works. Voice is optional with permission-denied and unsupported-browser states. Give a short example. Do not erase text when switching input modes. |
| 3. Location | `কোথায় হয়েছে?` | Search area/address or choose a map pin. GPS is opt-in. A map is not required to continue. Distinguish a private exact pin used for routing from any approximate public location. |
| 4. Evidence | `ছবি যোগ করুন (ঐচ্ছিক)` | Allow skip. Explain accepted formats and size before upload. Show selected image, removal, upload progress and failure recovery. |
| 5. Review | `জমা দেওয়ার আগে দেখে নিন` | Show title, category, description, area, destination and visibility. Mark AI suggestions, allow edits, and explain any uncertain route. Show duplicate suggestions without blocking a genuinely new report. |
| 6. Identity and consent | `আপনার সঙ্গে যোগাযোগের তথ্য` | State why an email/phone is needed, who can see it, and whether a report is public. Do not require an account before the user understands these terms. Choose guest, email or phone verification only after product/privacy owners confirm the supported policy. |
| 7. Confirmation | `আপনার অভিযোগ পেয়েছি` | Show a copyable reference, submission time, office/destination, next expected update if configured, and a route to My Reports. Never promise a resolution date unless that office has configured one. |

On session expiry, preserve a local draft and return the user to the same step after sign-in. Offline behavior should save a clearly labelled on-device draft; do not silently queue and send a report in the background. Provide a delete-draft action and explain that the draft is on this device.

### 6.3 Track a report

The issue page should answer four questions immediately: **What did I report? Who has it? What happened? What can I do next?**

- Header: title, reference, area and latest status, with a copy/share action.
- Timeline: plain Bangla labels, dates and the responsible actor/office where public. A current state is visually distinct and also written in text.
- Latest update: public response first, with date and author role. Keep internal staff notes private by construction.
- Next action: ask for more information, add information, follow, request an update or report that the issue remains unresolved, only where the policy and API support it.
- Similar report: offer `আমারও একই সমস্যা` only when the resident can safely add a signal without exposing identity or creating duplicate case records.
- Privacy: display only the approved public location and fields. Use a safe public view, not a staff or owner record with hidden UI fields.

### 6.4 Find and contact a representative

Start with area search and a verified profile card: name, office/role, area covered, source and last-verified date, official contact method and office hours if known. Separate three things visually: **ask a question**, **read public replies**, and **view sourced activity**. Do not calculate or display an MP “score” or ranking. Any response statistics must state their date range, numerator/denominator and method.

When public/private question modes are available, explain the visibility before typing. A public question should show its moderation state, response state and dated reply. A private message stays private to the authorized office and the resident.

### 6.5 Ideas and consultations

Keep this separate from service complaints. An idea is a proposal for a change; a report is a request to address a specific issue. Each consultation needs a plain-language question, decision owner, background, open/close dates, participation rules and an explanation of how responses will be used. After closure, publish a summary and the decision or next step. Show consensus or group patterns as summaries, not as a substitute for minority views or a binding vote unless the process explicitly says it is binding.

## 7. Home screen and sample Bangla copy

### Home screen priority

1. Area selector and persistent language control.
2. One primary action: **`সমস্যা জানান`**.
3. Two or three secondary tasks: **`অভিযোগের অবস্থা`**, **`জনপ্রতিনিধিকে প্রশ্ন`**, **`এলাকার মতামত`**.
4. Recent area updates with status and date.
5. Help/safety and privacy links in the footer.

Suggested heading: **`আপনার এলাকার জন্য কী করতে চান?`**. Keep promotional copy and long explanations below the actions. If an activity is not implemented or staffed, do not show it as an active card.

### Language rules

- Use everyday চলিত Bangla and one action per button: `জমা দিন`, `ছবি যোগ করুন`, `অবস্থা দেখুন`, `এলাকা বদলান`.
- Prefer `অভিযোগ নম্বর` or `রেফারেন্স নম্বর` over `টিকিট`; explain `দপ্তর` the first time if a more specific official name follows.
- Keep AI language plain: `এআই একটি খসড়া করেছে—দেখে ঠিক করুন`. Avoid implying AI verified the facts.
- Keep reference codes easy to copy. Localize dates and surrounding labels consistently; do not transliterate an ID in a way that breaks search.
- Maintain equivalent Bangla and English feature coverage. Store all UI strings in `src/lib/i18n.ts` or the approved translation structure, not in component markup.

## 8. Staff experience

### Inbox

- Default to actionable work, sorted by age/priority rules agreed with the office.
- Show reference, short title, category, area, received date, status, assignee and last update.
- Search by reference/title/area. Filter by status, category, date, assignee and overdue state. On phones, use cards and a filter drawer; on desktop, use a table with persistent filter state.
- Empty, loading, error and no-results views need distinct guidance. Never show a blank list without explaining whether the queue is empty or failed to load.

### Case workspace

- Resident statement and evidence are primary. Show precise location only to staff with permission.
- AI panel is explicitly staff-only and separates summary, similar cases, route suggestion, source and confidence. Each suggestion offers accept, edit or dismiss and records the staff decision.
- Public reply and private note have different headings, fields and visual treatments. Require a deliberate action before publishing.
- Every state change has a reason/note where required, confirmation for consequential actions, visible success feedback and an audit event.

## 9. Design system and accessibility

Build on existing colors and fonts, but verify contrast before using tokens for text. The current leaf green and teal are too light for small white/teal text pairings; darken text/button variants or use a light surface with dark text. Do not encode status by color alone.

Create shared primitives before rebuilding screens: Button, LinkButton, Input, Textarea, Select, Checkbox, Radio, Dialog, Toast/Alert, StatusChip, Card, Skeleton, EmptyState, Stepper, FormField and responsive Table/List. Each primitive needs focus, disabled, invalid and loading states, and must preserve Bengali wrapping and mixed Bangla/Latin content. Keep identifiers, dates and punctuation readable when Bangla and English text appear together.

Minimum experience requirements:

- Visible form labels, instructions and field-specific errors; keyboard access and visible focus.
- Touch controls at least 44×44 CSS pixels. Readable Bangla body text, preferably 16px or larger.
- Status and AI changes announced to screen readers without stealing focus. Decorative illustrations have empty alt; informative images have useful Bangla alt text.
- Test zoom, long Bangla words/IDs, small phones, and reduced-motion preferences. No horizontal scrolling for the report flow.
- The microphone, geolocation, camera and notification permissions are requested only after the resident chooses the related feature and sees why.

## 10. Implementation sequence and ownership

Each milestone is a release gate, not a calendar commitment. Frontend and backend branches follow the ownership table in `docs/WORK_SPLIT.md`. Agree on API and data changes before either side builds against them. The frontend consumes stable API contracts; the backend owns route handlers, storage, types, RLS and migrations.

| Milestone | Frontend scope | Backend/product dependency | Exit gate |
|---|---|---|---|
| 0. Decisions and evidence | Confirm screen map, Bangla glossary, user-visible privacy copy, prototype key screens; baseline current funnel and errors | Decide area/ward source, report visibility, identity requirement, office destinations, demo-vs-live behavior and who approves service targets | Decisions documented; no UI implies an unsupported service, policy or recipient |
| 1. Shell and design foundation | Responsive header, area selector, resident navigation, account/language menu, design primitives, form labels, loading/error/empty/offline states | Constituency lookup contract; session/role contract; supported error shape; verified source/date fields for areas and offices | Home and auth flow usable at 375px and 1280px in Bangla and English; all visible actions work |
| 2. Report and track | Wizard, local draft recovery, optional evidence and location, review/consent, submit receipt, My Reports, issue detail/timeline/share | Idempotent case create; safe public case view; attachment policy; area routing; public/private fields; event/state model; structured errors | One citizen can report, receive one stable reference, revisit the case and see only permitted public fields |
| 3. Staff closure loop | Searchable inbox, filters, responsive case workspace, public response/internal note split, action confirmation and success feedback | Scoped staff roles/RLS, assignment, acknowledge/request-info/refer/update/resolve APIs, immutable event/audit trail, SLA configuration | Staff can handle a case end to end; citizen can see only approved public updates; unauthorized roles are denied |
| 4. Discovery and representative access | Public issue list/map optional, “same problem”/follow, area feed, find representative, profile and question UI | Approximate public locations, duplicate search, verified representative directory and sources, follow/notification APIs, private/public question permissions | Every published item has a source, owner, visibility rule and clear update state; maps have manual fallback |
| 5. Participation | Idea submission/support, consultations, voting/results and participation summaries, moderation UI | Moderation states, one-person participation rules, deadlines, aggregate privacy thresholds, decision-owner and result records | A complete consultation can be opened, closed and reported with a visible outcome; hidden/unfinished flows remain out of navigation |
| 6. Production readiness | Native-speaker QA, screen-reader and keyboard pass, responsive polish, low-bandwidth improvements, telemetry on funnel events | Security/RLS review, retention/deletion rules, backup/restore, monitoring, rate limits, incident and moderation process | Release gates below pass on staging with representative and staff test accounts |

### Contract dependencies to settle before Milestone 2

- Stable area/constituency ID and display name, and behavior for an unmatched area.
- Case fields and allowed state transitions, including who may publish each event.
- Required versus optional contact fields, their audience and retention.
- Public-safe issue/detail representation, approximate-location policy and media derivative policy.
- Upload limits, idempotency, pagination and consistent field errors.
- Report statuses, response targets and what citizens can do when the target is missed.

Before Milestone 4, settle representative provenance and question visibility. Before Milestone 5, settle the legal/organizational meaning of support counts, consultation votes and published summaries. Do not ship a visual control before its backend state and governance are defined.

## 11. Quality gates and success measures

### UX measures

- Report start-to-success completion rate and abandonment by step.
- Median time to submit a complete report, split by typed versus voice-assisted entry.
- Percentage of residents who can find the report status and explain the latest update in a short usability task.
- Misrouted and reassigned report rate, plus the reason for correction.
- Percentage of cases with a dated public update and percentage past any configured response target.
- Consultation completion and result-view rates; do not optimize for votes alone.

Instrument events without sending report text, contact data or exact coordinates to analytics. Use consented usability sessions with Bangla speakers, including low-end Android devices and people who use assistive technologies. Establish baselines before setting numeric targets.

### Per-screen acceptance

- Works at 375px and 1280px; Bangla and English content fits without clipping.
- Every visible control has a useful label, clear focus state and working outcome.
- Validation, loading, success, empty, API failure, offline, permission denied, session expired, no access and not-found states are designed and recoverable where applicable.
- No public page includes private reporter data or an exact location unless policy explicitly authorizes it.
- AI output is labelled, editable, validated and never becomes a public action without the required human confirmation.
- Keyboard, screen-reader, 200% zoom and contrast checks pass for the report, issue detail, login and staff workspace.
- Performance is measured on a throttled mobile connection. Lazy-load maps and large media; text reporting stays usable without them.

## 12. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Wrong or missing area-to-office mapping | Show the proposed destination before submission, expose its source/date, allow correction and provide a human fallback. |
| Residents assume the platform is an official emergency channel | State scope and emergency limits before submission and in help; link only to locally verified emergency information. |
| Personal details or precise location appear publicly | Default to safe public views, separate public and private fields at the API/RLS layer, and review media metadata before public display. |
| Office cannot meet a promised response time | Display targets only when agreed and configured; label them as targets, show missed dates honestly and avoid automatic “resolved” states. |
| AI draft changes the resident's meaning | Show original text beside editable suggestions, preserve the original, and allow manual submission if AI is unavailable. |
| Public support counts or consultations are manipulated or misleading | Define eligibility, duplicate controls, moderation and privacy thresholds before counts are shown; distinguish consultation from binding vote. |
| Mobile permissions or weak connectivity block reporting | Make text, manual location and draft save available without permissions; retry uploads and explain what remains on-device. |
| Too many features dilute the main task | Ship only the report-and-track path first; add participation and accountability when each has an owner and complete loop. |

## 13. Delivery checklist

Before each milestone begins:

1. Confirm scope, user-facing copy, screen states, data classification and API contract.
2. Review the relevant `docs/frontend.md`, `docs/backend.md` and `docs/WORK_SPLIT.md` task rows; update them if this plan changes ownership or sequencing.
3. Prototype the changed flow in Bangla before polishing the English version.
4. Identify what can be tested with demo data and how demo state is visibly labelled.

Before a release:

1. Complete the citizen golden path and staff handling path on staging.
2. Review privacy boundaries and access controls with real role-separated accounts.
3. Complete native-speaker, accessibility, mobile and low-bandwidth review.
4. Review error and performance telemetry without collecting sensitive report content.
5. Publish only routes and features with a complete workflow, a responsible owner and user-visible support content.

## 14. Decisions required before implementation

The product owner and relevant operations/privacy owners must answer these before the corresponding milestone:

1. What exact geography does the pilot serve, and which authoritative source supplies its boundaries and representative mapping?
2. Is a submitted report public by default, public only after review, or private? Which fields are public?
3. Is identity required to submit? If so, should the first option be phone verification, email, or both, and what fallback exists?
4. Which office receives each category, who verifies the directory, and what happens when no valid destination is known?
5. Which statuses and response targets can staff truthfully promise? Who can mark work complete?
6. Are citizen questions, idea support and consultations public, and what moderation/appeal process supports each?
7. Which contact channels are actually staffed? Do not advertise WhatsApp, SMS, phone or email intake until ownership, privacy and case synchronization are working.

