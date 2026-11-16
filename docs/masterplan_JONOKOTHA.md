# MASTERPLAN — JONOKOTHA (জনকথা)

## Complete Product, UX, Architecture & Engineering Blueprint

- **Product:** Jonokotha (জনকথা) — Citizen-to-Representative Communication & Local Development Platform
- **Previous working name:** Your MP
- **Target market:** Bangladesh (designed for multi-country expansion)
- **Primary language:** Bangla (বাংলা) — plain, everyday চলিত Bangla on every screen; English is optional
- **Platform:** Web app only — a mobile-first, installable web app (PWA) for citizens, plus web dashboards for MP offices and admins. No native Android/iOS apps.
- **Document type:** Master Product & Technical Implementation Plan
- **Competition:** International AI Builders Congress (AIBC) 2026 — Competition 1, Team-Built Product
- **Domain:** 7. CivicSphere AI — Government, Public Services & Digital Nations
- **Challenge areas:** Citizen First (primary); GovCopilot and Transparent Government (supporting)
- **Version:** 1.7 (aligned to the AIBC 2026 Participants Guide; Bangla-first; global benchmark features integrated; web app only)
- **Status:** Build-ready blueprint

------------------------------------------------------------------------

# 1. Executive Summary

**Jonokotha (জনকথা)** is a civic engagement and local development platform
connecting citizens with their elected local representatives and the
relevant public-service authorities.

Citizens can:

- Report local problems such as damaged roads, waterlogging, flooding, drainage, waste, electricity, water supply, public facilities and safety concerns.
- Attach photos/videos, pinpoint the location on a map and track progress.
- Send questions or messages to their representative.
- Propose development ideas and allow the community to support and discuss them.
- Follow public projects, commitments, progress updates and available budget information.
- Participate in polls, surveys and community consultations.

Representatives and their offices can:

- Receive, classify, verify, prioritize and respond to reports.
- Assign cases to office staff or route them to the responsible authority.
- Publish progress updates and evidence.
- Collect and evaluate citizen proposals.
- Publish public announcements, consultations and project updates.
- Review analytics showing issue hotspots, response times and citizen satisfaction.

**Product principle:** Jonokotha is a communication, transparency and
case-coordination platform. It does not replace official government
complaint channels, emergency services, legal processes or the statutory
responsibilities of public agencies. The app must clearly identify
whether a submission is simply received by an MP office, forwarded to an
agency, or officially registered in an external government system.

**AI-native core:** Jonokotha is built around a human-reviewed intelligence
layer, not a chatbot added on top. It turns unstructured Bangla or English
citizen voice and text into structured, de-duplicated, correctly routed and
explainable cases; grounds every routing suggestion in a cited public-service
knowledge base; and gives MP offices a copilot that summarizes cases and drafts
replies. Every AI output is a suggestion that a citizen or authorized office
user reviews before it takes effect (see Section 17).

## Name and brand

- **Name:** Jonokotha — Bangla **জনকথা**, meaning "the people's words" or "the people's voice".
- **Spelling:** `Jonokotha` in English/Latin script; `জনকথা` in Bangla. Use `jonokotha` as the code, repository and package slug.
- **Role vs. brand:** "MP", "MP office" and the "Ask Your MP" feature describe the representative's role; the product itself is always called Jonokotha.
- The name and visual identity must stay politically neutral and must not be associated with any party, candidate or campaign.

## Product promise

**Jonokotha — Your Voice. Your Representative. Your Development.**

Three core pillars:

1. **VOICE** — report problems and ask questions.
2. **IDEAS** — propose and prioritize local development.
3. **ACCOUNTABILITY** — follow responses, commitments and verifiable progress.

All three pillars run on the same AI core: it makes reporting easier (VOICE),
connects similar ideas and needs (IDEAS) and makes case handling faster and
more traceable (ACCOUNTABILITY).

------------------------------------------------------------------------

# 2. AIBC 2026 Competition Strategy

Jonokotha is entered in **Competition 1 — Team-Built Product** of the
International AI Builders Congress 2026, in the **CivicSphere AI** domain. This
section turns the AIBC 2026 Participants Guide into product and delivery
requirements. The guide and official organizer communications are the
authority; re-check dates and rules against them before each deadline.

Treat the judging components as product-wide requirements, not presentation
talking points. Every major feature should earn points in at least one
component without weakening trust, usability, security or feasibility.

## 2.1 Domain and challenge fit

| Challenge area | What the guide asks for | How Jonokotha answers it |
|---|---|---|
| **Citizen First** (primary) | Unified, multilingual citizen-service assistant; RAG over policy, secure identity and agents; winning signal: service access and satisfaction | Bangla/English voice-and-text intake agent, RAG over the public-service and agency directory, verified accounts, measured by time to acknowledgement and citizen satisfaction |
| **GovCopilot** (supporting) | Decision support and workflow automation for public servants; document RAG and agentic workflows; winning signal: faster, auditable service delivery | MP-office copilot: case summaries, missing-information checks, routing suggestions and reply drafts, each approved by a person and written to the audit log |
| **Transparent Government** (supporting) | Open, accountable public-spending and service insight; knowledge graphs and public dashboards | Public status timelines, an issue–area–agency–project graph, privacy-safe hotspot dashboards and sourced project data |

CivicSphere is one of the guide's **heightened-caution** domains: privacy,
accuracy and public-safety implications need extra rigor. Sections 14, 17 and
18 are written to meet that bar.

## 2.2 Key dates (Bangladesh Standard Time)

| Date | Official milestone | Jonokotha action |
|---|---|---|
| 20 Nov 2026 | Team preliminary submission last date | Submit the 180-second video and preliminary package (Sections 2.4–2.5) |
| 25 Nov 2026 | Team preliminary selection announced | Keep building regardless; adjust scope after feedback |
| 26 Nov – 25 Dec 2026 | Selection & hardening, then finalize & rehearse | Production-grade build, deployment, safeguards, rehearsal (Section 24) |
| 26 Dec 2026, from 7:00 AM | Congress Day at Daffodil International University, Ashulia | Team judging in Group Session 1 (11:00 AM–1:00 PM) or 2 (2:00–3:00 PM); Opportunity Connect meetings |

The guide's earlier phases (July–October: onboarding, design, prototype,
validation) have passed. The plan in Section 24 compresses the remaining work
into the time left.

## 2.3 Official judging rubric (100 points)

Each component is worth 20 points and is scored independently against the
rubric, not against other teams. Presentation is assessed throughout.

| Component (20 pts) | What judges evaluate | Jonokotha evidence | Plan sections |
|---|---|---|---|
| Innovation & AI-Native Design | Originality and non-obvious, transformative use of AI | Bangla voice-to-case intake, duplicate clustering, cited agency routing, issue–agency graph, idea-to-project traceability | 2.8.1, 17 |
| Technical Excellence & Architecture | Architecture quality, AI integration depth, robustness, explainability of the intelligence core | Layered AI-native architecture, RAG with citations, structured outputs, RLS, audit trail, AI evaluation suite, automated tests | 2.8.2, 10, 14, 17, 21 |
| Business Value & Commercial Viability | Measurable economic value, clear value proposition, realistic path to a sustainable business | Institutional buyer model, pilot plan, cost model, staff-time saved per case | 2.8.3 |
| Global Scalability & Real-World Impact | Capacity to scale to millions and to other countries; jobs, productivity or societal benefit | Country adapters, multilingual design, cloud-native deployment, impact KPIs | 2.8.4, 3 |
| Responsible AI, Data Sovereignty & Presentation | Fairness, explainability, bias mitigation, privacy, governance and data ownership, communicated clearly | Human approval points, redaction, AI inventory, evaluation results, data-sovereignty plan, a crisp demo | 2.8.5, 17, 18.4 |

NRB or global collaboration is recognized qualitatively within Technical
Excellence and Global Scalability. The guide also encourages at least one
female participant per team (bonus points) and cross-institution teams.

**Score bands (per component, out of 20):**

| Band | Interpretation |
|---|---|
| 0–5 | Incremental, common or weak; limited AI implementation or unclear value |
| 6–10 | Moderately differentiated; functional with limited depth or validation |
| 11–15 | Strong; well-structured AI-native design with clear relevance and outcomes |
| 16–20 | Breakthrough; globally competitive, production-grade, with documented safeguards |

Target the 16–20 band in every component. That band requires documented
safeguards and production-grade evidence, not just features.

## 2.4 Submission package

The guide requires every team to explain both the problem and the system.
Keep each item in the repository under `docs/aibc/` so it stays in sync with
the build.

| Required component | Jonokotha deliverable | Built from |
|---|---|---|
| Problem Definition | `docs/aibc/problem.md` — users, pain, urgency, local and global context | Sections 1, 3 |
| AI Architecture | `docs/aibc/ai-architecture.md` with an input → AI → output diagram | Sections 10, 17 |
| Data & Sovereignty Strategy | `docs/aibc/data-sovereignty.md` — sources, preparation, privacy, governance, ownership | Sections 17.6, 18.4 |
| Demo (live or recorded) | Live staging URL plus a recorded backup of the golden path | Sections 2.5, 2.6, 27 |
| Scalability Roadmap | `docs/aibc/scalability.md` — infrastructure, deployment, roadmap | Sections 2.8.4, 4, 24 |
| Ethical Safeguards | `docs/aibc/ethics.md` — bias mitigation, privacy, responsible-AI design | Sections 2.8.5, 17 |
| Team roles (mandatory) | `docs/aibc/team.md` — each member's declared role | Section 23.1 |
| Collaborator record | `docs/aibc/collaborators.md` — every NRB/expert contribution, documented transparently | Section 23.1 |
| AI usage record | `docs/aibc/ai-usage.md` — AI tools used to build Jonokotha and what they produced | Code of Conduct §4 |

## 2.5 Preliminary video — "Vibe to Production in 180 Seconds" (due 20 Nov)

| Time | Must show | Jonokotha content |
|---|---|---|
| 0:00–0:30 | Problem: users, urgency, local and global context | How citizens raise local problems today and why they lose track of them; why MP offices struggle to triage. Use only sourced figures or your own interview findings; otherwise describe the problem qualitatively. |
| 0:30–1:00 | Solution and differentiation | Jonokotha: speak or type a problem in Bangla, get a traceable case, follow it to a verified outcome |
| 1:00–2:00 | Demo or system walkthrough | The golden path: Bangla voice report → AI drafts a structured case → citizen confirms → office queue shows the copilot summary, similar cases and a cited routing suggestion → staff approves → citizen sees the timeline update |
| 2:00–2:30 | AI approach | Intake agent, RAG over the agency directory, pgvector duplicate detection, issue–agency graph, personalization, redaction and human approval |
| 2:30–3:00 | Impact and next step | KPIs (time to acknowledgement, routing accuracy, duplicates merged, staff time saved), pilot constituency plan, roadmap to 26 Dec |

Mandatory preliminary requirements from the guide:

- [ ] A 3-minute structured video pitch.
- [ ] Clear problem and user definition.
- [ ] An AI-native approach (LLM / RAG / graph / ML).
- [ ] Basic system flow (input → AI → output).
- [ ] An initial demo, prototype or workflow (early stage is acceptable).
- [ ] Consideration for Bangla and localization.
- [ ] Defined potential impact (KPIs or expected outcomes).

Early stage is acceptable, but anything shown must be honest: if a step is a
mock or a design, label it on screen as such. The guide's Code of Conduct
prohibits fabricated demos and fake results.

## 2.6 Congress-Day demo

- **Format:** 5 minutes per team — 1 minute transition, 3 minutes pitch, 1 minute scoring — followed by judge questions. One judging session per team.
- **Flow:** problem → solution → demo → AI → impact.
- **Preparation:**
  - Pre-signed-in demo citizen and demo office accounts on staging, using a clearly labelled demo constituency.
  - A recorded backup of the golden path in case the venue network fails.
  - A one-page summary and the architecture diagram, printed and as a link.
  - A Q&A sheet covering likely judge questions: why AI is essential here, hallucination and wrong routing, privacy and data residency, Bangla quality, how MP offices adopt it, who pays, and what is real versus planned.
- Rehearse to time with every team member's role clear.

## 2.7 Common mistakes to avoid

| Mistake the guide warns about | Jonokotha guard |
|---|---|
| AI as a gimmick (a chatbot with no real intelligence) | The AI core does structural work — intake, routing, de-duplication, case copilot — and is measured |
| No clear problem definition | Users, pain and KPIs defined in Sections 1 and 3 |
| Weak architecture thinking | Input → AI → output flow and layer map in Section 10.5 |
| Fake or hardcoded data | Real, legally sourced public data (Section 17.6); demo data labelled |
| No personalization | Area/category-aware feed and accessibility modes (Section 17.4) |
| No Bangla or localization | Bangla-first UI, Bangla voice input, low-bandwidth design |
| Overbuilding, nothing complete | One golden path finished first (Section 4.1) |
| No scalability thinking | Adapters, documented APIs, cloud-native deployment |
| Poor demo and storytelling | Sections 2.5 and 2.6 |
| Not using team diversity | Declared roles and business/domain ownership (Section 23.1) |

## 2.8 Component playbooks

### 2.8.1 Innovation & AI-Native Design

- Go beyond a conventional complaint form by connecting issue reporting,
  representative communication, community-supported ideas and public project
  progress in one traceable journey.
- Make the AI core do work that was previously manual: understanding a spoken
  Bangla complaint, spotting that it repeats ten earlier reports, and finding
  the responsible authority with a cited source.
- Give each report a clear timeline, accountable owner, next action and
  evidence-backed outcome.
- Use privacy-safe map-based issue discovery, the issue–agency graph and
  aggregated hotspots to help offices recognize recurring local problems.
- Demonstrate novelty through a concrete user journey and measured benefit;
  do not label ordinary CRUD functionality as AI.

### 2.8.2 Technical Excellence & Architecture

- Deliver genuinely working end-to-end citizen, AI and MP-office workflows,
  not only static prototype screens.
- Make the intelligence core explainable: every suggestion shows its inputs,
  cited sources, confidence and the model/prompt version that produced it.
- Enforce server-side authorization, constituency-scoped access, database
  constraints, RLS, audit trails and secure media handling.
- Use typed API contracts, structured AI outputs validated against schemas,
  migrations, automated tests, an AI evaluation suite, CI checks, monitoring
  and documented deployment, backup and restore procedures.
- Optimize for low-bandwidth networks, affordable Android devices, responsive
  web layouts and graceful retry/offline behavior.
- Prepare demonstrable evidence: live workflows, architecture and data-flow
  diagrams, security tests, AI evaluation results, performance checks and
  deployment status.

### 2.8.3 Business Value & Commercial Viability

- Distinguish end users from institutional buyers. Citizens are the end users;
  potential customers or sponsors may include representative offices, local
  administrations, civic organizations or development partners, subject to
  formal authorization and procurement rules.
- State the value proposition in measurable terms: staff time saved per case,
  faster acknowledgement, fewer duplicate cases, better routing.
- Define a realistic pilot: one constituency, a verified participating
  office, limited issue categories, onboarding, training and support.
- Consider institution-funded subscriptions, implementation/support contracts
  or grant/CSR-supported pilots. Keep essential citizen reporting free; never
  sell personal data or introduce political advertising.
- Model hosting, AI inference, support, onboarding, moderation and
  integration costs per constituency.
- Validate adoption through interviews or pilot commitments. Never claim
  partnerships, revenue or signed customers that do not exist.

### 2.8.4 Global Scalability & Real-World Impact

- Keep Bangladesh as the first deployment context, but make country,
  administrative hierarchy, constituency boundaries, language, currency,
  date/time formats, issue categories, agency directories and notification
  channels configurable.
- Put country-specific identity checks, representative roles, agency referral
  rules, privacy obligations and official integrations behind adapters.
- Keep the AI layer language-agnostic: prompts, knowledge bases and evaluation
  sets are per-locale, so adding a language means adding data, not code.
- Prefer portable PostgreSQL data models, documented APIs, modular
  integrations, standards-based geospatial data and stateless, horizontally
  scalable services.
- Express impact in societal terms: faster service, fewer lost complaints,
  better-targeted public spending and productivity gains for public servants.
- Require local legal, electoral, institutional and data-protection review
  before entering another country. Do not assume Bangladesh's governance
  model applies globally.

### 2.8.5 Responsible AI, Data Sovereignty & Presentation

- Label AI output as AI-assisted and treat it as a draft or recommendation,
  never as an official decision or verified fact.
- Require human approval for consequential actions, public replies, status
  changes, referrals and AI-generated content before publication.
- Never use AI to automatically reject reports, rank citizens, infer political
  opinions, judge complainant credibility, identify people from images or make
  eligibility/benefit decisions.
- Minimize and redact data sent to AI providers. Do not send identity
  documents, private contact details, exact home coordinates or sensitive case
  details unless strictly necessary, lawful, disclosed and protected.
- Know and document where every piece of data is stored and processed, who
  owns it and how long it is kept (Section 18.4).
- Provide notice, consent where required, retention controls, access controls,
  auditability, correction/appeal paths and a non-AI alternative.
- Test Bangla and English outputs for hallucinations, bias, harmful wording,
  mistranslation and unequal performance between the two languages. Show
  uncertainty where applicable.
- Do not train models on citizen submissions by default. Any future training
  use requires a separate lawful basis, clear notice and appropriate consent.
- Present all of this plainly and confidently: judges score communication as
  part of this component.

## 2.9 Evidence and honesty

| Component | Evidence to prepare |
|---|---|
| Innovation & AI-Native Design | Golden-path demo, AI agent inventory, before/after comparison of the manual process |
| Technical Excellence & Architecture | Live demo, architecture and data-flow diagrams, RLS and workflow tests, AI evaluation report, deployment status |
| Business Value & Commercial Viability | Buyer model, pilot plan, cost model, interview or letter-of-interest evidence if it exists |
| Global Scalability & Real-World Impact | Configurable data model, localization and adapter strategy, impact KPIs with baselines |
| Responsible AI, Data Sovereignty & Presentation | AI-use inventory, human approval points, redaction tests, data-sovereignty document, limitations, fallback path |

Clearly distinguish implemented features, working prototypes, planned
features and assumptions. Do not fabricate evaluation evidence. Document all
AI usage and every collaborator's contribution. Prefer a reliable,
well-demonstrated MVP over a broad list of incomplete features.

## 2.10 Global benchmark — what Jonokotha adopts

The team reviewed 32 civic-tech platforms from around the world (research
sheet: *Global Civic-Tech Platforms*). No single platform combines what
Jonokotha does: map-based problem reporting, direct communication with the
constituency's MP office, community ideas, a human-reviewed AI core, and a
Bangla-first, low-bandwidth design. The ideas below are adapted, not copied;
Jonokotha builds its own product and brand.

| Group | Reference platforms | Idea Jonokotha adopts | Where in this plan |
|---|---|---|---|
| Map-based problem reporting | FixMyStreet (UK), SeeClickFix (US), Traffy Fondue (Thailand), OneService (Singapore), Ushahidi (Kenya) | Pin, photo and track; "I have this problem too" instead of duplicate reports; routing to the responsible agency so citizens don't have to know which office handles what; alerts for a followed area | 7.4, 7.5, 7.15, 17.2 |
| Grievance tracking | CPGRAMS (India) | Unique tracking number, satisfaction rating after resolution, formal appeal, voice/chat intake in local languages | 7.5, 8.3, 19 |
| Citizen-to-representative | WriteToThem (UK), I Change My City "Constituency Connect" (India) | Find your MP from your area without an account; ward-level problems linked to the elected representative | 7.13 |
| Public Q&A and accountability | Abgeordnetenwatch (Germany) | Public questions with visible answer counts and reminders to the office — shown with context, never as a ranking | 7.8, 7.9 |
| Parliamentary transparency | TheyWorkForYou (UK), OpenParliament.ca (Canada), Mzalendo (Kenya) | MP activity from official records, with AI summaries in plain Bangla; email/SMS alerts | 4.4 |
| Information requests | WhatDoTheyKnow (UK) | Help citizens write a Right to Information request and send it through the official channel | 4.4 |
| Ideas and petitions | Your Priorities and Better Reykjavik (Iceland), ManaBalss (Latvia), Join (Taiwan) | Short "for / against" points instead of open comment threads; a support threshold that triggers a committed public response from the office | 7.7, 7.16 |
| Participatory budgeting | Decidim and CONSUL Democracy (Spain/global), Ethelo (Canada), Polco (US) | Community priority ranking now; real participatory budgeting only where an office controls a real budget | 4.3, 4.4 |
| Consensus and deliberation | Polis (US/global), vTaiwan (Taiwan), Remesh (US) | Consultations where people agree/disagree with short statements and AI shows where groups agree — no reply threads to fight in | 7.14 |
| Consultation and AI sensemaking | Go Vocal (Belgium), Zencity (UK), EngagementHQ (Australia), Have Your Say (EU), MyGov (India) | WhatsApp/SMS intake; AI themes from citizen input; heatmaps; a published "you said, we did" report after each consultation | 4.3, 7.14, 17.2 |
| Project monitoring | Join "monitor" module (Taiwan), I Change My City (India) | Citizens follow a project and add dated photo check-ins, labelled as citizen-submitted | 7.16 |
| Open standards | FixMyStreet, SeeClickFix (Open311) | Open311 GeoReport v2–compatible API so other systems can exchange reports | 4.4, 13.10 |

**Jonokotha's difference** (for the Innovation and Business components):
it joins reporting, MP-office case work and community ideas in one traceable
journey, adds an AI core that does real triage and routing work under human
review, and is built Bangla-first for low-cost phones and slow networks.

Use the research sheet as background only. Re-verify any figure about these
platforms (users, cities, laws changed) from the platform's own source before
quoting it in a pitch.

------------------------------------------------------------------------

# 3. Product Goals and Success Metrics

## 3.1 Primary goals

1.  Make reporting a local issue easy enough to complete in under two
    minutes.
2.  Make every submission traceable with a unique reference number.
3.  Make status, ownership and next steps understandable to citizens.
4.  Give MP offices a practical case-management workflow.
5.  Make citizen proposals discoverable and measurable.
6.  Improve public transparency without exposing sensitive personal
    information.
7.  Work reliably on low-cost Android devices and slower mobile
    networks.

## 3.2 North-star metric

**Verified issues reaching a documented outcome per active constituency
per month.**

## 3.3 Supporting KPIs

-   Report completion rate.
-   Median time to first acknowledgement.
-   Median time in each workflow status.
-   Percentage of reports with a meaningful public update.
-   Percentage of cases forwarded to a responsible authority.
-   Percentage of resolved cases with evidence.
-   Reopen rate after resolution.
-   Citizen satisfaction after case closure.
-   Number of unique citizens participating in ideas and polls.
-   Proposal conversion rate: ideas reviewed → adopted/planned →
    implemented.
-   MP office weekly active staff.
-   Spam, duplicate and abuse rates.
-   Share of duplicate reports avoided through "I have this problem too".
-   Follows per active citizen and share of followers who return after an update.
-   Satisfaction rating after resolution, and appeal rate.
-   Questions answered by offices and median time to first answer.
-   Release 1.1: consultation participation, share of consultations with a
    published "you said, we did" report, and ideas reaching the support
    threshold that received a public response on time.
-   Accessibility task-completion rate.
-   AI suggestion acceptance rate (accepted unchanged / edited / rejected), per agent.
-   Routing suggestion accuracy (top-1 and top-3), checked against the office's final decision.
-   Duplicate cases correctly linked.
-   Median office handling time per case, with and without the copilot.
-   Bangla vs. English parity on AI quality metrics.

Do not rank representatives using raw complaint counts alone: larger
constituencies and better digital adoption naturally produce more
reports. Always display population/usage context, date range and
methodology where comparative analytics are shown.

------------------------------------------------------------------------

# 4. Scope and Release Strategy

## 4.1 Preliminary slice — by 20 Nov 2026

One working golden path, deployed to a public staging URL and recorded for the
preliminary video:

-   Citizen sign-in (email or phone OTP) and constituency selection.
-   Report a problem by typing or speaking Bangla/English; the Intake Agent
    drafts title, category, description and area; the citizen edits and
    submits.
-   Unique reference ID and a public issue page with a status timeline.
-   Office queue showing the new case with an AI summary, similar cases and a
    cited routing suggestion.
-   Staff approves an acknowledgement or referral; the citizen sees the update.
-   Bangla and English interface for these screens.
-   Seeded, clearly labelled demo constituency and agency directory built from
    real public sources.

## 4.2 MVP — by Congress Day, 26 Dec 2026

-   Citizen registration, login and profile.
-   Constituency selection and representative directory.
-   Submit issue with category, description, location and optional
    media, with AI-assisted intake (text and Bangla voice) and a manual path.
-   Issue list, map and issue detail.
-   Status timeline and notifications.
-   Personalized home feed by followed areas and categories.
-   Find your MP from your area, without an account.
-   "আমারও একই সমস্যা" (I have this problem too) on public issues.
-   Follow an issue or an area and get updates.
-   Satisfaction rating after resolution, with reopen and appeal.
-   Share an issue or idea to WhatsApp and Facebook by link.
-   Office response counts on the MP profile, with context and method.
-   Citizen idea submission, support/voting and comments, with similar-idea
    suggestions.
-   MP office dashboard with the AI copilot panel (summary, missing-information
    check, routing suggestion, reply draft).
-   Duplicate detection and linking.
-   Staff roles and assignment.
-   Acknowledge, request information, update, forward and resolve
    workflows.
-   Public announcements.
-   Admin verification, moderation and AI run log.
-   Basic analytics, hotspot view and audit log.
-   Bangla and English interface.
-   Responsive, mobile-first web app, installable as a PWA.
-   AI evaluation suite with published results.

## 4.3 Release 1.1 — post-Congress pilot

-   Public polls and surveys.
-   Project and commitment tracker.
-   Citizen satisfaction surveys.
-   Better map clustering and heatmaps.
-   Email/SMS notification integration where available.
-   Exportable office reports.
-   Weekly AI insight briefs for offices.
-   WhatsApp and SMS intake through approved providers (Section 7.15).
-   Consultations with consensus mapping (Section 7.14).
-   "For / against" points on ideas and the idea support threshold (Section 7.7).
-   "You said, we did" reports after consultations.
-   Community priority ranking of local needs (non-binding, clearly labelled).
-   Citizen photo check-ins on public projects (Section 7.16).

## 4.4 Release 2

-   Public budget and expenditure transparency with verified source
    documents.
-   Agency integrations, only where official APIs or authorized
    workflows exist.
-   Assisted reporting through community volunteers and kiosks.
-   Open-data portal with privacy-safe aggregated datasets.
-   Multi-constituency and regional administration support.
-   Participatory budgeting, only where an office controls a real budget and
    agrees to follow the result.
-   Right to Information request helper that drafts a request and points to
    the official channel (it never files on the citizen's behalf).
-   MP activity from official parliamentary records, with plain-Bangla AI
    summaries — sourced, neutral and never turned into a score.
-   Open311 GeoReport v2–compatible public API.

## 4.5 Explicitly out of scope for MVP

-   Native Android or iOS apps. Jonokotha is a web app only; the PWA covers
    phone use. Reconsider native apps only if pilot data shows a clear need
    the web app cannot meet.

-   Claiming that an MP can directly order every government agency to
    act.
-   Claiming a submission is an official government complaint without an
    authorized integration.
-   Publicly exposing complainant phone numbers, exact home addresses or
    identity documents.
-   Unmoderated public chat or anonymous mass-posting.
-   Automated AI decisions that reject complaints or accuse individuals.
-   Public leaderboards that encourage harassment or political
    manipulation.
-   Unverified budget figures or project completion claims.

------------------------------------------------------------------------

# 5. Users, Roles and Permissions

Use role-based access control (RBAC), scoped by constituency and
organization.

## 5.1 Citizen

Can:

- Create and manage own profile.
- Select or request verification of a constituency.
- Submit issues and ideas.
- View public issues and public updates.
- Comment, support ideas and participate in polls under moderation rules.
- Find their MP without an account.
- Mark "I have this problem too" on a public issue, and follow issues, ideas, areas and projects.
- Rate satisfaction after a case is resolved.
- Release 1.1: add for/against points on ideas, vote and add statements in consultations, add project check-ins, and report through WhatsApp/SMS.
- View own private submissions and their full status history.
- Respond to requests for additional information.
- Reopen a case within the configured review period or submit an appeal.
- Report abuse or incorrect information.
- Request account/data deletion subject to legal retention obligations.

Cannot:

- View another citizen's private contact information or private submissions.
- Change official case status.
- Claim to be an MP or office employee.

## 5.2 MP / Representative

Can:

- View constituency-wide case and idea summaries.
- Publish verified announcements and public responses.
- Review office performance and unresolved priority issues.
- Delegate tasks to authorized office staff.
- Approve official office statements and commitments.
- View constituency-level analytics.

Cannot:

- Alter audit history.
- Delete legitimate reports to hide them.
- Mark work completed without a reason and required evidence policy.
- Access personal information unrelated to an authorized case.

## 5.3 MP Office Manager

Can:

- Manage incoming cases.
- Assign cases to staff.
- Request more information.
- Change workflow status according to policy.
- Forward cases to agencies and record the forwarding reference.
- Publish updates if granted permission.
- Manage office working queues.
- Release 1.1: open and close consultations, publish "you said, we did"
  reports, set idea support thresholds and response times, and respond to
  project check-ins — each published only with MP or delegated approval.

## 5.4 Case Officer / Staff

Can:

- View cases assigned to them.
- Add internal notes.
- Request information.
- Add progress updates and evidence.
- Recommend forwarding or resolution.
- Perform only the actions granted by the office manager.

## 5.5 Agency Liaison (optional)

Can:

- Receive assigned cases.
- Acknowledge receipt.
- Add authorized progress updates.
- Provide a reference number or official channel link.
- Close an agency task with evidence.

This role must not imply that an agency has officially integrated unless
that relationship is confirmed.

## 5.6 Platform Administrator

Can:

- Verify representative and office accounts.
- Manage constituency boundaries and public directory records.
- Configure categories, permissions and moderation policy.
- Review platform abuse and security alerts.
- Manage feature flags and system configuration.
- Access sensitive records only when necessary and with audit logging.

## 5.7 Moderator

Can:

- Review reported content.
- Hide content temporarily under policy.
- Escalate threats, doxxing, spam or illegal content for review.
- Record moderation decisions and reasons.

Moderators must not silently rewrite a citizen's report.

------------------------------------------------------------------------

# 6. Information Architecture and Navigation

Jonokotha is one web app with one design system. It adapts to screen size:
on phones it uses a bottom navigation bar for the main citizen tasks; on
larger screens it uses top navigation.

## 6.1 Citizen navigation on phones (bottom bar)

Bottom tabs:

1. **হোম** (Home)
2. **এলাকা** (Explore)
3. **সমস্যা জানান** (Report) — prominent central action
4. **আইডিয়া** (Ideas)
5. **আমি** (Profile)

Labels are shown in Bangla by default; the English names are for the team.

Additional pages:

- Notifications
- My Reports
- Report Details
- Ask Your MP
- Representative Profile
- Project Tracker
- Polls & Surveys
- Help & Safety
- Settings
- Privacy & Terms

## 6.2 Citizen navigation on larger screens

Top navigation:

- Jonokotha logo
- Home
- Issues
- Ideas
- Projects
- Ask Your MP
- Find your MP (আপনার এমপি কে?)
- Consultations (Release 1.1)
- About / Help
- Language switcher
- Notifications
- Profile / Sign in

Persistent primary CTA: **Report a Problem**.

## 6.3 MP office web dashboard navigation

Left sidebar:

- Overview
- Incoming Reports
- My Assigned Cases
- All Constituency Issues
- Ideas & Proposals
- Questions & Messages
- Projects & Commitments
- Announcements
- Polls & Surveys
- Consultations (Release 1.1)
- Analytics & Reports
- Staff & Roles
- Audit Log
- Office Settings

## 6.4 Admin console navigation

-   Platform Overview
-   Constituencies & Boundaries
-   Representatives
-   Office Verification
-   Users
-   Categories & SLA Configuration
-   Content Moderation
-   Abuse Reports
-   System Health
-   Audit & Security
-   Integrations
-   Feature Flags

------------------------------------------------------------------------

# 7. User-Friendly UI/UX Specification

## 7.1 Design principles

-   Mobile-first, responsive and lightweight.
-   Bangla is the primary language on every screen, written in plain
    everyday Bangla (Section 19); English is an optional switch.
-   Plain language; avoid bureaucratic wording.
-   One primary action per screen.
-   Progressive disclosure: ask only for information needed at that
    step.
-   Show clear status, owner and next action.
-   Use icons with text labels; never rely on color alone.
-   Accessible contrast, keyboard navigation and screen-reader labels.
-   Large touch targets (preferably 44 × 44 CSS px or larger).
-   Avoid heavy animations and large images on low-end devices.
-   Save drafts locally and recover interrupted submissions.
-   Confirm before destructive actions.
-   Use skeleton loading, empty states, retry states and offline
    indicators.

## 7.2 Visual direction

Suggested visual identity:

- Primary: deep navy / civic blue.
- Secondary: teal / green for constructive progress.
- Accent: warm amber for attention and pending actions.
- Background: light neutral surface.
- Dark mode as a later enhancement.
- Typography: Bangla-first font such as Noto Sans Bengali or Hind Siliguri, at least 16 px for body text; pair with a clean Latin font (Section 19.7).
- Use a consistent spacing scale, rounded cards and restrained shadows.

Do not use party colors, party symbols or campaign-like visual language.
The platform should remain politically neutral.

## 7.3 Home screen

Content order:

1. Header: logo, selected area/constituency, notifications.
2. Welcome message: "Your voice matters in your community."
3. Main CTA card: Report a Problem.
4. Secondary CTA: Suggest an Idea.
5. Constituency snapshot: reported, in progress, resolved (with date range).
6. Recent local issues.
7. Popular community ideas.
8. Representative card: verified name, role, office contact channel and profile.
9. Active public consultations / polls.
10. Footer with help, privacy, accessibility and official-channel disclaimer.

Avoid displaying invented demo statistics as real data. Clearly label
sample data in prototypes.

## 7.4 Report a Problem flow

Use a short, step-by-step wizard with progress indicator.

**Quick start — speak or type (AI-assisted)**

- One large button: "বলুন বা লিখুন" (speak or type).
- The citizen describes the problem in their own words — in Bangla, in Banglish (Bangla typed in English letters) or in English.
- The Intake Agent fills in the wizard below as a draft: title, category, cleaned-up description, area hint and urgency guidance.
- Every drafted field is marked "AI suggestion" and stays editable; nothing is submitted until the citizen reviews it in Step 5.
- If the AI is unavailable or the citizen prefers, they fill the wizard manually.
- The agent warns when the text contains phone numbers, ID numbers or other personal details and offers to remove them.

**Step 1 — Select category** (Bangla labels in Section 19.5)

- Roads & transport
- Flooding & waterlogging
- Drainage
- Water supply
- Electricity
- Waste management
- Public health
- Education
- Public safety
- Public infrastructure
- Environment
- Other

**Step 2 — Describe the issue**

- Short title (required).
- Description (required, sensible character limits).
- How long has this been happening? (optional).
- Who/what is affected? (optional).
- Urgency selector with guidance; do not imply emergency dispatch.

**Step 3 — Location**

- Use current device location only after explicit permission.
- Select point on map.
- Search by area/road/landmark.
- Allow manual pin adjustment.
- Show selected address/area for confirmation.
- If location permission is denied, allow manual selection.
- Do not publish exact home coordinates by default.

**Step 4 — Add evidence**

- Camera, gallery or file upload.
- Optional caption.
- Compress images on device.
- Strip EXIF location metadata from public media derivatives.
- Warn users not to upload faces, identity documents, phone numbers or private information unless strictly necessary.

**Step 5 — Review and submit**

- Show category, title, description, approximate public location and media preview.
- Explain what is public and what is private.
- Consent checkbox for platform terms and privacy notice.
- Submit button.
- Generate unique report reference ID.

After submission:

- Success screen with reference ID.
- "View report" and "Share public link" actions.
- Explain that submission is received by the platform / MP office, not automatically an official government case.

## 7.5 Issue detail page

Sections:

- Title, category and status.
- Map with privacy-safe approximate location.
- Submitted date and reference ID.
- Description and media.
- Affected area (if provided).
- Timeline of public status changes.
- Official office response.
- Forwarding destination and reference, if publishable.
- Progress evidence.
- Similar reports (possible duplicates).
- "This is still happening" / "I have more information" action.
- "আমারও একই সমস্যা" (I have this problem too) button with a count. It adds
  the citizen to the existing case instead of creating a duplicate; the
  office sees how many people are affected.
- "খবর রাখুন" (follow) button for updates on this issue.
- After resolution: a 1–5 satisfaction rating ("সমাধানে আপনি কতটা খুশি?"),
  and "আবার খুলুন" or "আপিল করুন" if the problem is not fixed.
- Report content / moderation action.
- Share link.

Private fields such as reporter phone, email and identity verification
status must never appear in the public issue page.

## 7.6 Explore issues

-   Map/list toggle.
-   Search by area, category or keyword.
-   Filters: category, status, date, priority and distance.
-   Cluster map markers at low zoom.
-   List cards show title, area, category, status and date.
-   Sort by latest, recently updated and nearby.
-   Never sort only by outrage/engagement.
-   Add "data last updated" label.

## 7.7 Ideas page

-   Search and category filters.
-   Popular, newest and under-review tabs.
-   Idea card: title, short description, category, area, support count,
    review status.
-   Support button (one verified account, one support per idea).
-   Share and report actions.
-   Similar-idea suggestions before publishing.

**Submit an idea form**

- Title.
- Problem/opportunity addressed.
- Proposed solution.
- Expected benefit.
- Suggested location/area.
- Estimated cost range (optional; label as citizen estimate, not official).
- Evidence/attachments (optional).
- Category.
- Public visibility and conduct acknowledgement.

**Idea workflow** Draft → Submitted → Moderation Review → Office Review
→ Needs More Information / Under Consideration → Feasibility Assessment
→ Planned / Not Planned / Referred → In Progress → Implemented / Closed.

A rejected or deferred idea must have a public reason where appropriate.
Do not equate upvotes with technical feasibility or official approval.

**For / against points (Release 1.1).** Instead of open comment threads,
citizens add short points under "পক্ষে" (for) and "বিপক্ষে" (against), and
others mark points as helpful. This keeps discussion useful and harder to
derail.

**Support threshold (Release 1.1).** An office can set a support threshold
per area (for example, a number of verified local supporters). When an idea
reaches it, the office commits to publish a reasoned public response within
an office-set time. This is the office's own commitment, shown as such — not
a legal obligation.

## 7.8 Ask Your MP

-   Clear distinction between a private message and a public question.
-   Topic, subject and message.
-   Option to make a question public after moderation.
-   Expected response guidance, not a guaranteed response deadline
    unless the office formally commits.
-   Private inbox for replies.
-   Public FAQ from verified office answers.
-   Rate limits and anti-spam protection.

## 7.9 Representative profile

-   Verified status and verification date.
-   Name, official role, constituency and term dates.
-   Official office contact information.
-   Office hours if confirmed.
-   Public announcements.
-   Public responses and commitments.
-   Projects and progress.
-   Link to official sources.
-   Clearly distinguish verified records from user-generated content.
-   Office responsiveness, shown with context: questions and reports received,
    answered and pending, and median time to first response, for a stated
    date range, with a link to how it is calculated. Never rank MPs against
    each other.

## 7.10 MP office dashboard

**Overview widgets**

- New reports.
- Unassigned reports.
- High-priority queue.
- Waiting for office.
- Forwarded to authority.
- In progress.
- Resolved this month.
- Overdue against office-defined target.
- Citizen satisfaction trend.

**Case table**

- Reference ID
- Title
- Category
- Area
- Priority
- Submitted date
- Current status
- Assigned staff
- Last update
- Actions

Provide saved filters, bulk assignment only with confirmation, CSV
export with permission checks and accessible table controls.

**Case workspace**

- Citizen-visible details.
- Private contact details (only when necessary and authorized).
- Internal notes, visually separated from public replies.
- Timeline and audit trail.
- Assignment and escalation.
- Forwarding details.
- Request-more-information action.
- Public update composer.
- Resolution form and evidence.
- Reopen / appeal history.
- **AI copilot panel** (clearly labelled, staff-only): case summary, missing-information checklist, similar cases, routing suggestion with cited source and confidence, and a reply draft in plain Bangla (English on request). Each item has Accept, Edit and Dismiss; the decision is logged.

## 7.11 Admin and moderation UX

-   Review queue with reason and risk signals.
-   Keep content visible to authorized reviewers.
-   Actions: approve, request edit, hide pending review, reject under
    policy, escalate.
-   Every action requires a reason and creates an audit event.
-   Appeal path for affected users.
-   Never let AI automatically make final moderation decisions for
    serious cases.

## 7.12 Essential states for every screen

Design:

- Loading
- Empty
- Error / retry
- Offline / reconnecting
- Permission denied
- Success
- Validation error
- Unauthorized
- Not found
- Maintenance
- Partial data
- Session expired

## 7.13 Find your MP

- Public page "আপনার এমপি কে?" — no account needed.
- Find the constituency by choosing district → upazila/city → ward/union, or
  by allowing location once.
- Show the verified MP card with source and verification date, office
  contact, and the buttons "সমস্যা জানান" and "এমপিকে প্রশ্ন করুন".
- If the boundary is uncertain, show the possible constituencies and let the
  citizen confirm.

## 7.14 Consultations with consensus mapping (Release 1.1)

- An office opens a consultation on a local question (for example, "এই
  ওয়ার্ডে আগে কোন কাজ দরকার?") with a closing date.
- Citizens see short statements one at a time and tap "একমত", "একমত নই" or
  "জানি না". They can add a new short statement, which is moderated.
- There are no reply threads.
- The AI groups similar voting patterns and shows, in plain Bangla, which
  statements most groups agree on and where views differ. Only aggregates
  are shown, groups below a minimum size are hidden, and no individual's
  opinions are profiled.
- After closing, the office publishes a "আপনারা বললেন, যা করা হলো" (you said,
  we did) report.
- Consultations are about local needs and services, never party politics.

## 7.15 More ways to report (Release 1.1)

- WhatsApp and SMS intake through approved providers: the citizen sends a
  message, photo or location, and the Intake Agent replies with a draft to
  confirm.
- The same reference number, timeline and privacy rules as the app.
- Check provider costs, consent and messaging-platform rules before launch.
- Area alerts: citizens who follow an area get a short update when a new
  public issue or announcement appears there, within their notification
  preferences.

## 7.16 Citizen project check-ins (Release 1.1)

- On a public project page, citizens tap "খবর রাখুন" to follow it.
- Citizens can add a dated photo check-in ("আজ গিয়ে দেখলাম…"), labelled
  as citizen-submitted and moderated.
- Check-ins never change the project's official status; the office can respond.

------------------------------------------------------------------------

# 8. Core End-to-End Workflows

## 8.1 Citizen onboarding

1.  Open app or web.
2.  The app opens in Bangla. English is available from the language
    switch on every screen; the citizen never has to choose before starting.
3.  Browse public issues without signing in (optional product policy).
4.  Sign up using phone/email and secure verification.
5.  Enter display name and preferred language.
6.  Select constituency using district → upazila/city area → ward/union
    or map selection, according to verified administrative data.
7.  Ask for location permission only when needed.
8.  Explain profile visibility and privacy.
9.  Complete onboarding.
10. Show a simple first-action guide.

Do not infer constituency solely from GPS when boundaries are uncertain.
Let the citizen confirm or request correction.

## 8.2 Issue submission

Citizen creates draft → validates required fields → uploads media →
submits → server validates and stores → unique reference generated →
duplicate candidates suggested → moderation/risk screening → office
queue → acknowledgement → assigned officer → investigation/forwarding →
progress updates → resolution evidence → citizen feedback → close or
reopen.

## 8.3 Office case handling

1.  New case enters unassigned queue.
2.  Office manager checks completeness and jurisdiction.
3.  If incomplete, request more information.
4.  If duplicate, link it to a master issue while preserving the
    citizen's report and attribution.
5.  If outside jurisdiction, explain and record referral/official
    contact route.
6.  Assign responsible staff member.
7.  Staff investigates and records internal notes.
8.  Office publishes a public acknowledgement/update.
9.  If another agency is responsible, record agency, date, channel and
    reference number.
10. Add progress updates.
11. Resolve only with explanation and evidence according to policy.
12. Notify reporter.
13. Reporter gives feedback or requests review.
14. Preserve full history.

## 8.4 Idea lifecycle

Citizen submits → moderation → similarity check → community support →
office review → feasibility assessment → decision with reason → possible
project creation → progress updates → completion evidence → citizen
feedback.

## 8.5 Public project lifecycle

Proposal/need identified → feasibility review → approved/planned (only
with evidence) → budget source published → procurement/work details
published where lawful → progress milestones → delay explanation →
completion evidence → post-completion feedback.

Store source documents and dates. A citizen-submitted estimate must
never be displayed as an official allocation.

## 8.6 Question and response lifecycle

Citizen submits → spam/moderation checks → routed to office inbox →
assigned → response drafted → authorized office approval if required →
delivered privately or published after moderation/consent → archived in
FAQ if appropriate.

## 8.7 Abuse and safety workflow

User reports content → moderation queue → triage severity → restrict
content or account where justified → review evidence → decision and
reason → notify affected user where safe → appeal → audit. Threats of
imminent harm should display local emergency guidance and must not be
treated as a normal service ticket.

## 8.8 "I have this problem too" and follow

Citizen opens a public issue (or the Duplicate Agent shows it while they are
reporting) → taps "আমারও একই সমস্যা" → is added to the affected count and
follows the issue automatically → receives the same public updates as the
original reporter → can add their own photo or information, which goes to the
office as additional information on the same case.

## 8.9 Resolution feedback and appeal

Office marks a case resolved with evidence → reporter and affected citizens
are notified → reporter rates satisfaction (1–5) → if not fixed, the reporter
reopens within the review period or files an appeal with a reason → the
office must respond before the case can close → history is preserved.

## 8.10 Consultation lifecycle (Release 1.1)

Office drafts the question and seed statements → MP or delegate approves →
consultation opens with a closing date → citizens vote and add statements
(moderated) → AI groups voting patterns and summarizes agreement and
differences (aggregates only) → office reviews the AI summary → consultation
closes → office publishes the "you said, we did" report → participants are
notified.

## 8.11 Idea support threshold (Release 1.1)

Office sets a threshold and response time for an area → an idea reaches the
threshold of verified local supporters → the office is alerted and the idea
shows "উত্তরের অপেক্ষায়" (awaiting response) with the due date → the office
publishes a reasoned response → supporters are notified. A missed due date
is shown publicly as overdue.

## 8.12 WhatsApp/SMS reporting (Release 1.1)

Citizen messages the official Jonokotha number → consent and privacy notice
are sent first → Intake Agent replies with a draft for confirmation → on
"হ্যাঁ" the case is created with a reference number → updates are sent back on
the same channel within notification preferences.

------------------------------------------------------------------------

# 9. Issue Status Model and SLA Rules

Use a controlled state machine. Do not allow arbitrary status edits.

Recommended statuses (citizen-facing Bangla labels are in Section 19.4):

1. `SUBMITTED`
2. `UNDER_REVIEW`
3. `NEEDS_INFORMATION`
4. `ACKNOWLEDGED`
5. `ASSIGNED`
6. `REFERRED_TO_AUTHORITY`
7. `IN_PROGRESS`
8. `RESOLVED`
9. `CLOSED`
10. `REJECTED`
11. `DUPLICATE`
12. `OUT_OF_JURISDICTION`
13. `REOPENED`

Rules:

- `SUBMITTED` is system-generated.
- `ACKNOWLEDGED` means the office has acknowledged receipt, not that work is approved.
- `REFERRED_TO_AUTHORITY` requires destination and forwarding details.
- `IN_PROGRESS` requires an accountable owner or recorded responsible body.
- `RESOLVED` requires resolution notes and evidence policy.
- `CLOSED` follows the configured citizen review period or office policy.
- `REOPENED` records the reason and previous closure.
- `REJECTED` requires a reason and appeal route.
- `DUPLICATE` must link to a master case and retain the original record.

## 9.1 SLA configuration

Do not hard-code promises such as "solved in 48 hours." Configure
acknowledgement and update targets per office/category. Display them as
**office response targets**, not statutory guarantees. Pause or adjust
timers transparently when waiting for citizen information or an external
agency, and show the reason.

------------------------------------------------------------------------

# 10. System Architecture

## 10.1 Recommended architecture for MVP

Start with a **modular monolith** rather than microservices. It is
faster to build, easier to test and less expensive to operate. Keep
module boundaries clear so services can be extracted later if necessary.

**Clients**

- Citizen web app: Next.js, mobile-first and installable as a PWA (web app
  manifest, service worker for offline drafts and caching, web push).
- Office/admin web: Next.js.
- Shared UI tokens and API types in a monorepo.

**Backend**

- Supabase managed PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- PostgreSQL Row Level Security (RLS).
- Edge Functions or a typed backend API for privileged workflows.
- Realtime only for useful status/inbox updates.
- Background jobs for notifications, media processing and AI tasks.

**External services**

- Map provider: Mapbox or OpenStreetMap-based provider.
- Push: standard Web Push from the PWA (for example via Firebase Cloud Messaging).
- Email: Resend, Postmark or equivalent.
- SMS/OTP: approved local SMS provider, subject to cost and regulatory checks.
- Error monitoring: Sentry.
- Product analytics: privacy-conscious analytics.
- AI provider: required for the AI core, server-side only; every AI feature has a manual fallback.
- Speech-to-text: Bangla-capable provider, server-side only.

## 10.2 Suggested monorepo

``` text
jonokotha/
├── apps/
│   ├── web/                    # citizen website
│   ├── office/                 # MP office dashboard
│   └── admin/                  # platform administration
├── packages/
│   ├── ui/                     # shared design system
│   ├── types/                  # shared TypeScript types
│   ├── validation/             # Zod schemas
│   ├── api-client/             # typed API client
│   ├── config/                 # shared lint/ts config
│   ├── i18n/                   # Bangla and English strings
│   └── ai/                     # prompts, agent definitions, schemas, evals
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── seed.sql
│   └── tests/
├── docs/
│   ├── architecture.md
│   ├── workflows.md
│   ├── api-contracts.md
│   ├── security.md
│   ├── aibc/                   # competition submission package
│   └── runbooks/
├── .github/
│   └── workflows/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 10.3 Architecture flow

``` text
Citizen web app (PWA) / MP Office / Admin
                    |
              HTTPS API
                    |
       Authentication + Authorization
                    |
          Application Domain Modules
       /          |          |          \
   Issues       Ideas     Messages    Projects
       \          |          |          /
        AI core (agents, RAG, graph, evals)
                    |
     PostgreSQL + pgvector + graph edges
                    |
        Storage / Background Jobs
                    |
      Push / Email / SMS / Maps / AI
```

## 10.4 Domain modules

-   Identity and access
-   Constituencies and representative directory
-   Issue reporting and case management
-   Media and evidence
-   Ideas and voting
-   Questions and messages
-   Projects and commitments
-   Polls and surveys
-   Notifications
-   Moderation and abuse reports
-   Analytics and exports
-   Audit and compliance
-   Integrations
-   AI intelligence (agents, prompts, structured outputs, evaluations)
-   Knowledge and data ingestion (sources, scrapers, embeddings, graph)
-   Personalization

## 10.5 AI-native reference architecture

Mapped to the AIBC reference architecture layers:

| Layer | Purpose | Jonokotha implementation |
|---|---|---|
| User interaction | Web, mobile, chat, dashboard and voice | Citizen web/PWA with voice intake, office dashboard, admin console |
| Application logic | Workflows, business logic, orchestration | Supabase Edge Functions / typed API, case state machine |
| AI intelligence | Reasoning, generation, prediction | LLM via server-side SDK with structured outputs (Section 17.5) |
| Knowledge retrieval | Context via RAG and semantic search | pgvector over the agency directory, service rules and past cases |
| Agent orchestration | Multi-step reasoning and delegation | Deterministic workflows calling typed tools; an MCP server exposes Jonokotha's read-only tools |
| Data infrastructure | Storage, indexing, embeddings, logging | PostgreSQL, PostGIS, pgvector, graph edge tables, AI run log |
| Automation & integration | External services and data sources | Scheduled ingestion of public sources, notifications, maps, STT |
| Deployment & infrastructure | Reliable operation at scale | Serverless functions, managed Postgres, CDN-hosted web, monitoring |

**Input → AI → output (golden path):**

``` text
Citizen voice/text (bn/en)
   → speech-to-text → PII redaction
   → Intake Agent (structured draft) → citizen review → submitted case
   → embedding → Duplicate Agent (similar cases)
   → Routing Agent (RAG over agency directory, cited) ─┐
   → Office Copilot (summary, missing info, reply draft)┤
                                                         ↓
                       Office staff accept / edit / dismiss (audited)
                                                         ↓
                Status update → citizen notification → public timeline
                                                         ↓
                Graph + aggregates → hotspot and insight views
```

------------------------------------------------------------------------

# 11. Technology Choices

Recommended default stack:

| Layer | Recommended | Notes |
|---|---|---|
| Language | TypeScript | Shared types across all web apps and the API |
| Web | Next.js | Server rendering helps public SEO and fast first load on slow networks |
| Phone experience | Installable PWA (manifest, service worker, Web Push) | No app store needed; shared by WhatsApp link |
| UI | Tailwind CSS + shadcn/ui | Shared design tokens |
| Backend | Supabase | Auth, Postgres, Storage, RLS |
| Validation | Zod | Validate client and server inputs |
| Forms | React Hook Form | Accessible form validation |
| Server state | TanStack Query | Cache, retries and invalidation |
| Maps | Mapbox or OSM provider | Check Bangladesh coverage, pricing and terms |
| Push | Web Push (e.g. via FCM) | Opt-in browser notifications |
| Email | Resend / Postmark | Transactional messages |
| Monitoring | Sentry | Errors and performance |
| Tests | Vitest, Playwright (desktop and mobile viewports) | Unit and end-to-end |
| CI/CD | GitHub Actions | Test, lint, build and deploy |
| Hosting | Vercel/Cloudflare Pages + Supabase | Review data residency and costs |
| LLM | Claude via the official Anthropic SDK, server-side; default model `claude-opus-5-5` | Structured outputs; consider cheaper tiers per route only after evaluation shows equal quality |
| Embeddings | Multilingual embedding model with strong Bangla support (e.g. BGE-M3, self-hostable) | Evaluate on Bangla retrieval before choosing; self-hosting keeps vectors in our infrastructure |
| Vector search | Supabase Postgres + pgvector | One database for relational, geospatial and vector data |
| Graph reasoning | PostgreSQL edge tables with recursive queries | Apache AGE or a graph DB only if queries outgrow this |
| Agent tools | Typed tool definitions + an MCP server | Same tools serve in-app agents and approved assistants |
| Speech-to-text | Bangla-capable STT (evaluate Whisper-family models and cloud bn-BD services) | Typed input always available as fallback |
| AI evaluation | Versioned eval sets + scripted runner in CI | Results published in `docs/aibc/` |
| Build tooling | AI-native development (Claude Code, Cursor or similar) | Document AI usage per the Code of Conduct |

Do not expose service-role keys, AI API keys, SMS keys or email
credentials in browser/mobile bundles.

------------------------------------------------------------------------

# 12. Database Design

Use PostgreSQL with UUID primary keys, UTC timestamps, indexes, foreign
keys and explicit deletion/retention policies. Keep personal data
separate from public content where possible.

## 12.1 Core tables

### `profiles`

-   `id` UUID PK, references auth user
-   `display_name`
-   `phone` (private)
-   `email` (private)
-   `avatar_path`
-   `preferred_language`
-   `account_status`
-   `created_at`
-   `updated_at`

### `constituencies`

-   `id`
-   `country_code`
-   `division`
-   `district`
-   `upazila_or_city`
-   `ward_or_union`
-   `name_bn`
-   `name_en`
-   `boundary_geojson` or external boundary reference
-   `boundary_source`
-   `boundary_verified_at`
-   `is_active`

### `representatives`

-   `id`
-   `profile_id` nullable
-   `full_name`
-   `office_title`
-   `party_name` optional, only if relevant and verified
-   `official_contact`
-   `verification_status`
-   `term_start`
-   `term_end`
-   `source_url`
-   `verified_at`

### `representative_constituencies`

-   `representative_id`
-   `constituency_id`
-   `valid_from`
-   `valid_to`

### `office_members`

-   `id`
-   `user_id`
-   `representative_id`
-   `constituency_id`
-   `role`
-   `status`
-   `invited_by`
-   `created_at`

### `issues`

-   `id`
-   `reference_code` unique
-   `reporter_id`
-   `constituency_id`
-   `category_id`
-   `title`
-   `description`
-   `status`
-   `priority`
-   `public_visibility`
-   `public_location` geography point, privacy-adjusted
-   `private_location` restricted, nullable
-   `area_label`
-   `assigned_to`
-   `master_issue_id` nullable
-   `submitted_at`
-   `updated_at`
-   `resolved_at`
-   `closed_at`

### `issue_categories`

-   `id`
-   `slug`
-   `name_bn`
-   `name_en`
-   `parent_id`
-   `default_priority`
-   `is_active`

### `issue_media`

-   `id`
-   `issue_id`
-   `uploader_id`
-   `storage_path`
-   `media_type`
-   `caption`
-   `visibility`
-   `moderation_status`
-   `created_at`

### `issue_events`

-   `id`
-   `issue_id`
-   `actor_id`
-   `event_type`
-   `from_status`
-   `to_status`
-   `public_message`
-   `internal_note`
-   `metadata` JSONB
-   `created_at`

### `issue_assignments`

-   `id`
-   `issue_id`
-   `assigned_to`
-   `assigned_by`
-   `reason`
-   `assigned_at`
-   `unassigned_at`

### `issue_agency_referrals`

-   `id`
-   `issue_id`
-   `agency_name`
-   `agency_contact_or_channel`
-   `external_reference`
-   `forwarded_at`
-   `acknowledged_at`
-   `notes`
-   `visibility`

### `ideas`

-   `id`
-   `reference_code`
-   `author_id`
-   `constituency_id`
-   `category_id`
-   `title`
-   `problem_statement`
-   `proposed_solution`
-   `expected_benefit`
-   `area_label`
-   `location`
-   `estimated_cost_min`
-   `estimated_cost_max`
-   `status`
-   `created_at`
-   `updated_at`

### `idea_supports`

-   `id`
-   `idea_id`
-   `user_id`
-   `created_at`
-   Unique (`idea_id`, `user_id`)

### `idea_comments`

-   `id`
-   `idea_id`
-   `author_id`
-   `body`
-   `moderation_status`
-   `created_at`
-   `updated_at`

### `questions`

-   `id`
-   `reference_code`
-   `citizen_id`
-   `representative_id`
-   `subject`
-   `body`
-   `visibility`
-   `status`
-   `assigned_to`
-   `created_at`
-   `updated_at`

### `question_messages`

-   `id`
-   `question_id`
-   `sender_id`
-   `body`
-   `is_public`
-   `created_at`

### `projects`

-   `id`
-   `constituency_id`
-   `title`
-   `description`
-   `project_status`
-   `responsible_agency`
-   `official_budget_amount`
-   `currency`
-   `budget_source_url`
-   `budget_verified_at`
-   `planned_start`
-   `planned_end`
-   `actual_end`
-   `created_at`
-   `updated_at`

### `project_milestones`

-   `id`
-   `project_id`
-   `title`
-   `description`
-   `status`
-   `target_date`
-   `completed_at`
-   `evidence_url`
-   `source_reference`

### `announcements`

-   `id`
-   `author_id`
-   `representative_id`
-   `constituency_id`
-   `title`
-   `body`
-   `published_at`
-   `status`

### `polls`

-   `id`
-   `constituency_id`
-   `created_by`
-   `title`
-   `description`
-   `starts_at`
-   `ends_at`
-   `status`

### `poll_options`

-   `id`
-   `poll_id`
-   `label`
-   `sort_order`

### `poll_votes`

-   `id`
-   `poll_id`
-   `option_id`
-   `user_id`
-   `created_at`
-   Unique (`poll_id`, `user_id`)

### `notifications`

-   `id`
-   `user_id`
-   `type`
-   `title`
-   `body`
-   `data` JSONB
-   `read_at`
-   `created_at`

### `moderation_reports`

-   `id`
-   `reporter_id`
-   `target_type`
-   `target_id`
-   `reason`
-   `details`
-   `status`
-   `reviewer_id`
-   `decision_reason`
-   `created_at`
-   `reviewed_at`

### `audit_logs`

-   `id`
-   `actor_id`
-   `action`
-   `resource_type`
-   `resource_id`
-   `before_data` JSONB, redacted
-   `after_data` JSONB, redacted
-   `ip_hash` or security-approved metadata
-   `created_at`

### `consents`

-   `id`
-   `user_id`
-   `consent_type`
-   `policy_version`
-   `granted_at`
-   `withdrawn_at`

### `agencies`

-   `id`
-   `country_code`
-   `name_bn`
-   `name_en`
-   `jurisdiction_level` (national / division / district / upazila / city / union)
-   `area_ref`
-   `service_categories` (array)
-   `official_contact_or_channel`
-   `source_id` → `knowledge_sources`
-   `verified_at`

### `knowledge_sources`

-   `id`
-   `name`
-   `url`
-   `license_or_terms`
-   `collection_method` (api / scrape / manual / file)
-   `fetched_at`
-   `checksum`
-   `status`

### `knowledge_chunks`

-   `id`
-   `source_id`
-   `locale`
-   `content`
-   `metadata` JSONB
-   `embedding` vector
-   `created_at`

### `issue_embeddings`

-   `issue_id`
-   `model`
-   `embedding` vector (built from redacted public text only)
-   `created_at`

### `graph_edges`

-   `id`
-   `from_type`, `from_id`
-   `relation` (located_in, similar_to, referred_to, handled_by, became_project, …)
-   `to_type`, `to_id`
-   `weight`
-   `source` (system / office / ai_suggestion_accepted)
-   `created_at`

### `ai_runs`

-   `id`
-   `agent` (intake, duplicate, routing, copilot, translation, insight, idea)
-   `model`
-   `prompt_version`
-   `input_hash`
-   `redaction_applied`
-   `output` JSONB
-   `latency_ms`
-   `token_usage` JSONB
-   `status`
-   `created_at`

### `ai_suggestions`

-   `id`
-   `ai_run_id`
-   `target_type`, `target_id`
-   `suggestion_type`
-   `payload` JSONB
-   `citations` JSONB
-   `confidence`
-   `decision` (pending / accepted / edited / dismissed)
-   `decided_by`
-   `decided_at`
-   `final_value` JSONB

### `user_preferences`

-   `user_id`
-   `followed_areas` (array)
-   `followed_categories` (array)
-   `simple_language_mode`
-   `voice_first`
-   `personalization_enabled`
-   `updated_at`

### `issue_affected` ("I have this problem too")

-   `id`
-   `issue_id`
-   `user_id`
-   `created_at`
-   Unique (`issue_id`, `user_id`)

### `follows`

-   `id`
-   `user_id`
-   `target_type` (issue / idea / area / project / representative)
-   `target_id`
-   `created_at`
-   Unique (`user_id`, `target_type`, `target_id`)

### `issue_feedback`

-   `id`
-   `issue_id`
-   `user_id`
-   `rating` (1–5)
-   `comment`
-   `created_at`

### Release 1.1 tables (outline)

-   `idea_arguments` (`idea_id`, `author_id`, `side` for/against, `body`, `moderation_status`) and `idea_argument_votes`.
-   `consultations` (`constituency_id`, `question`, `opens_at`, `closes_at`, `status`), `consultation_statements`, `statement_votes` (unique per user and statement) and `consultation_reports`.
-   `project_checkins` (`project_id`, `author_id`, `photo_path`, `note`, `visited_at`, `moderation_status`).
-   `channel_messages` for WhatsApp/SMS intake (`channel`, `external_ref`, `user_id`, `issue_id`, `status`).

## 12.2 Database rules

-   Add indexes for `constituency_id`, `status`, `category_id`,
    `created_at`, `assigned_to` and geospatial columns.
-   Use PostGIS for location search if enabled.
-   Use unique constraints for one support per user/idea and one vote
    per user/poll.
-   Use database transactions for status changes and audit event
    creation.
-   Avoid storing unnecessary national ID data.
-   Do not store raw OTPs or passwords.
-   Use soft deletion only where required; define retention for personal
    data.
-   Store media in private buckets; issue short-lived signed URLs after
    authorization.
-   Keep public media derivatives separate from private originals.
-   Add migration tests and seed data clearly marked as demo.
-   Enable pgvector; add HNSW indexes on embedding columns.
-   Apply RLS to AI tables: citizens never read `ai_runs`; office staff see AI records only for cases in their scope.
-   Store only redacted text in embeddings and AI logs.
-   Keep source and fetch date on every row derived from external data.

------------------------------------------------------------------------

# 13. API Design

Use REST endpoints under `/api/v1`, JSON responses, pagination, request
validation and consistent error formats. Supabase RPC/Edge Functions may
implement privileged transactions, but keep a documented contract.

## 13.1 Authentication

-   `POST /auth/register`
-   `POST /auth/login`
-   `POST /auth/verify`
-   `POST /auth/logout`
-   `POST /auth/refresh`
-   `GET /me`
-   `PATCH /me`

Use Supabase Auth or a secure equivalent. Rate-limit login, OTP and
password reset.

## 13.2 Constituencies and representatives

-   `GET /constituencies`
-   `GET /constituencies/{id}`
-   `GET /constituencies/{id}/representative`
-   `GET /representatives/{id}`
-   `POST /admin/representatives/{id}/verify`

## 13.3 Issues

-   `POST /issues`
-   `GET /issues`
-   `GET /issues/{id}`
-   `PATCH /issues/{id}` (owner-editable fields only, subject to policy)
-   `POST /issues/{id}/media`
-   `POST /issues/{id}/additional-information`
-   `POST /issues/{id}/reopen`
-   `POST /issues/{id}/feedback`
-   `POST /office/issues/{id}/acknowledge`
-   `POST /office/issues/{id}/assign`
-   `POST /office/issues/{id}/request-information`
-   `POST /office/issues/{id}/forward`
-   `POST /office/issues/{id}/update`
-   `POST /office/issues/{id}/resolve`
-   `POST /office/issues/{id}/close`

## 13.4 Ideas

-   `POST /ideas`
-   `GET /ideas`
-   `GET /ideas/{id}`
-   `POST /ideas/{id}/support`
-   `DELETE /ideas/{id}/support`
-   `POST /ideas/{id}/comments`
-   `POST /office/ideas/{id}/decision`

## 13.5 Questions

-   `POST /questions`
-   `GET /questions`
-   `GET /questions/{id}`
-   `POST /questions/{id}/messages`
-   `POST /office/questions/{id}/assign`

## 13.6 Projects and announcements

-   `GET /projects`
-   `GET /projects/{id}`
-   `POST /office/projects`
-   `PATCH /office/projects/{id}`
-   `POST /office/projects/{id}/milestones`
-   `GET /announcements`
-   `POST /office/announcements`

## 13.7 Admin and moderation

-   `GET /admin/moderation`
-   `POST /admin/moderation/{id}/decision`
-   `GET /admin/audit-logs`
-   `GET /admin/analytics`
-   `POST /admin/constituencies/import`

## 13.8 AI endpoints

-   `POST /ai/transcribe` (audio → text, Bangla/English)
-   `POST /ai/intake` (text → structured issue draft; never submits)
-   `GET /issues/{id}/similar`
-   `GET /ideas/{id}/similar`
-   `POST /office/issues/{id}/ai/summary`
-   `POST /office/issues/{id}/ai/route-suggestion`
-   `POST /office/issues/{id}/ai/reply-draft`
-   `POST /ai/suggestions/{id}/decision` (accept / edit / dismiss)
-   `GET /me/feed` (personalized; supports `personalized=false`)
-   `GET /admin/ai/runs`
-   `GET /admin/ai/evals`

All AI endpoints are rate-limited, require authentication and return the
`ai_suggestion` record with citations and confidence, so the client always
shows provenance.

## 13.9 Citizen engagement endpoints

-   `GET /representatives/lookup?area=` or `?lat=&lng=` (public)
-   `GET /representatives/{id}/responsiveness`
-   `POST /issues/{id}/affected` and `DELETE /issues/{id}/affected`
-   `POST /follows` and `DELETE /follows/{id}`
-   Release 1.1: `POST /ideas/{id}/arguments`, `GET /consultations/{id}`,
    `POST /consultations/{id}/statements/{statementId}/vote`,
    `POST /projects/{id}/checkins`, inbound WhatsApp/SMS webhooks.

## 13.10 API conventions

-   Use cursor pagination for feeds; limit page size.
-   Use `Idempotency-Key` for retryable create/submit operations.
-   Use stable reference codes for citizens; never expose sequential
    database IDs.
-   Return structured errors: `code`, `message`, `field_errors`,
    `request_id`.
-   Validate every field server-side.
-   Authorize every resource access, not only the route.
-   Add rate limits and request-size limits.
-   Version breaking changes.
-   Never trust client-supplied role, constituency, status or owner IDs.

------------------------------------------------------------------------

# 14. Authorization and Row-Level Security

RLS is mandatory if using Supabase. Deny by default.

Policy principles:

- Public users may read only published, moderated, public records.
- Citizens may read and update only their own private profile and private case details.
- Citizens may create reports and ideas as themselves; reporter identity must come from the authenticated session, not the request body.
- Office staff may access cases only for constituencies and organizations they are assigned to.
- Office staff may perform only allowed state transitions.
- MP accounts may access only verified constituency scopes.
- Moderators may access moderation queues but not unrelated private data.
- Admin actions require elevated authorization, MFA and audit events.
- Service-role keys remain server-side only.
- Public views must be built from explicitly safe columns; do not expose private base tables.
- Test RLS with citizen A, citizen B, office A, office B, moderator and admin test accounts.

Create a permission matrix and automated RLS tests before production.

------------------------------------------------------------------------

# 15. Notifications

Channels:

- In-app notifications: mandatory.
- Web push notifications: opt-in from the installed web app or browser.
- Email: optional/transactional.
- SMS: optional for critical account verification or where the user consents and budget permits.

Events:

- Report submitted.
- Report acknowledged.
- More information requested.
- Case assigned (staff).
- Case forwarded.
- Status updated.
- Resolution proposed.
- Case reopened.
- Idea reviewed or decision published.
- Question answered.
- Poll closing reminder.
- Announcement published (opt-in).
- Update on a followed issue, idea, area or project.
- Someone else reported the same problem on your issue (count only, no identity).
- Satisfaction rating request after resolution.
- Appeal answered.
- Release 1.1: consultation opened in your area, consultation report
  published, followed idea reached its support threshold, office response
  due or published, reply on a WhatsApp/SMS report.

Notification rules:

- Respect user preferences and quiet hours.
- Do not include sensitive report details in lock-screen previews.
- Deduplicate repeated notifications.
- Retry delivery with backoff.
- Track provider delivery status without assuming delivery means the user read it.
- Provide unsubscribe controls for non-essential messages.

------------------------------------------------------------------------

# 16. Maps and Location Privacy

-   Use a trusted map provider with a documented license and cost model.
-   Verify Bangladesh administrative boundary data before using it to
    determine constituency.
-   Allow manual area selection.
-   Ask permission at the moment location is useful, not during first
    launch.
-   Store precise location only if genuinely needed and explain why.
-   Publish approximate location by default; define a configurable
    privacy offset or area-level display.
-   Never expose a citizen's home location or private coordinates
    publicly.
-   Strip EXIF GPS metadata from public media.
-   Cluster issue markers and avoid exposing private reports.
-   Validate coordinates and prevent map spoofing from changing
    jurisdiction without review.
-   Provide an accessible list alternative to the map.

------------------------------------------------------------------------

# 17. AI Core — Agents, Knowledge and Human Review

AI does the heavy lifting; people make the decisions.

## 17.1 Principles

- The AI core is essential to the product, not decoration: it removes manual
  work from reporting, triage, routing and communication.
- Every AI output is a suggestion with provenance (sources, confidence,
  model, prompt version) and an Accept / Edit / Dismiss decision by a person.
- Every essential workflow works without AI.
- Workflows are deterministic pipelines that call typed tools; no agent can
  change case status, publish content or contact anyone on its own.

## 17.2 Agents

| Agent | Input | Output | Human checkpoint | Fallback |
|---|---|---|---|---|
| Intake Agent | Citizen text or transcribed voice (bn/en), after redaction | Draft title, category, description, area hint, urgency guidance, PII warnings | Citizen reviews and edits before submitting | Manual wizard |
| Duplicate Agent | Embedding of the new case's public text | Top similar cases with reasons and similarity scores | Office links or rejects duplicates; citizen sees "similar reports" | Keyword search |
| Routing Agent (RAG) | Case + agency directory + service rules | Suggested responsible authority with cited source and confidence | Office manager confirms before any referral | Manual directory lookup |
| Office Copilot | Case thread and timeline | Summary, missing-information checklist, reply draft in plain Bangla (English on request) | Staff edits and approves; public replies are labelled office responses | Manual composition |
| Translation | Any public text | Bangla ↔ English translation, labelled | Shown on demand; original always available | Original text |
| Insight Agent | Aggregated, privacy-filtered case data and graph | Hotspot and trend brief linking to underlying cases | Office reviews before sharing | Standard analytics |
| Idea Assistant | Draft idea | Similar ideas and clarity suggestions | Citizen decides | Submit as written |

Expose Jonokotha's read-only tools (search cases, get agency directory, get
case timeline, get area statistics) through an MCP server so the in-app
agents and approved external assistants use the same, audited tool surface.
Tools that write data always require a confirmed human action.

## 17.3 Knowledge layer — RAG and graph reasoning

- **RAG corpus:** agency directory, public-service rules and helpline
  information, office FAQs from verified answers, and resolved public cases.
  Chunk by meaning, store with locale and source, embed into pgvector.
- **Citations required:** the Routing Agent and Copilot must cite the chunks
  they used; an answer without a valid citation is shown as "no confident
  suggestion".
- **Graph:** `graph_edges` links issues, areas, categories, agencies, projects
  and ideas. Use it to answer questions such as "which authority handled
  similar drainage cases in this ward" and to find recurring hotspots.
- Refresh sources on a schedule; record fetch dates; never mix demo and real
  sources in the same index.

## 17.4 Personalization

- Home feed ordered by the citizen's followed areas and categories, then
  recency; never by outrage or engagement alone.
- Language, simple-language mode and voice-first mode adapt the interface for
  different literacy levels.
- Notification timing respects quiet hours and preferences.
- Personalization never uses or infers political opinions, religion,
  ethnicity or other sensitive traits.
- Citizens can view, reset or switch off personalization.

## 17.5 Model selection and context engineering

- Call the LLM server-side only, through the official Anthropic SDK; the
  default model is `claude-opus-5-5`. Moving a route to a cheaper model is a
  team decision made only after the evaluation suite shows equal quality.
- Use structured outputs with JSON schemas for every agent, and validate them
  server-side before storing.
- Keep system prompts, schemas and few-shot examples versioned in
  `packages/ai/`; record the prompt version on every run.
- Put stable content (instructions, agency directory extracts) first so it can
  be prompt-cached; put the case-specific content last.
- Redact phone numbers, emails, ID numbers and exact coordinates before any
  model call.
- Include the Bangla style guide and glossary (Section 19) in every agent's
  system prompt. Agents understand Bangla, Banglish, English and regional
  speech as input, and always write back in plain standard চলিত Bangla
  unless the user chose English.
- Handle refusals, timeouts and malformed outputs by falling back to the
  manual path and logging the event.

## 17.6 Real data sources

Use legally sourced, documented public data; record every source in
`knowledge_sources`.

| Data | Source to use (verify current availability and terms) |
|---|---|
| Parliamentary constituencies and current MPs | Bangladesh Election Commission and Bangladesh Parliament official websites; record URL and verification date |
| Administrative boundaries (division, district, upazila, union) | Humanitarian Data Exchange (HDX) Bangladesh administrative boundaries; check the licence |
| Base map and places | OpenStreetMap (with ODbL attribution) |
| Public-service directory and agency contacts | Bangladesh National Portal (bangladesh.gov.bd) and official agency websites |
| Official complaint channel to refer citizens to | The government Grievance Redress System (GRS); verify the current URL |
| Emergency and information helplines | National emergency service 999 and information service 333; verify before display |
| Citizen needs and validation | Team interviews and pilot feedback, with consent |
| Demo cases | Synthetic, clearly labelled demo records only |

Scraping rules: respect each site's terms and robots.txt, rate-limit requests,
collect no personal data, and keep source, fetch date and checksum for
lineage.

## 17.7 AI evaluation

- Build versioned evaluation sets in Bangla and English: synthetic cases plus
  consented real examples, with expected category, route and duplicates.
- Measure: category accuracy, routing top-1/top-3 accuracy and citation
  validity, duplicate precision/recall, PII-redaction recall, hallucination
  rate in summaries, Bangla vs. English parity, Bangla readability (rated
  by native reviewers) and glossary adherence, latency and cost per case.
- Run the suite in CI on every prompt or model change; block regressions.
- Publish the latest results in `docs/aibc/` with the date, dataset size and
  known limitations. Set targets after measuring a baseline; never report
  numbers that were not measured.

## 17.8 Safety requirements

- AI output is labelled as a suggestion.
- Users can edit AI-generated content before submission.
- Office staff can override every AI classification and routing suggestion.
- Never auto-reject, auto-close or auto-publish based on AI.
- Never infer criminality, political affiliation, identity or credibility from writing style or images.
- Do not send private data to external AI providers unless disclosed and authorized; redact first.
- Log model, prompt version and decision provenance for every run.
- Provide a non-AI fallback for every essential workflow.
- Treat threats of imminent harm as emergencies: show emergency guidance, not an AI reply.

------------------------------------------------------------------------

# 18. Security, Privacy and Trust

## 18.1 Security baseline

-   HTTPS everywhere.
-   Strong authentication and secure session handling.
-   MFA required for MP office, moderator and admin accounts.
-   RBAC + RLS + server-side authorization.
-   Secrets stored in managed environment variables.
-   Input validation and output encoding.
-   CSRF protection where cookie-based sessions are used.
-   Content Security Policy and secure headers.
-   Rate limiting and bot protection.
-   Upload MIME/type/size validation and malware scanning.
-   Signed URLs for private media.
-   Dependency scanning and secret scanning.
-   Regular backups and tested restore procedure.
-   Audit logging for privileged and sensitive actions.
-   Security incident response runbook.
-   Penetration testing before large-scale public launch.

## 18.2 Privacy by design

-   Collect the minimum personal data needed.
-   Explain what is public before submission.
-   Separate public identity/display name from private account contact
    information.
-   Offer anonymous-to-public reporting where operationally possible,
    while preserving abuse controls and explaining limitations.
-   Do not promise absolute anonymity.
-   Define data retention, deletion and legal hold policies.
-   Allow users to access and correct their profile data.
-   Publish the privacy notice in Bangla first, with a short easy-Bangla
    summary on top ("আপনার তথ্য কীভাবে রাখি"), and an English version.
-   Complete a privacy impact assessment before launch.
-   Review Bangladesh's applicable data protection, cyber security,
    public records and platform obligations with qualified local
    counsel.

## 18.3 Trust and verification

-   Verify MP identity using official public sources and documented
    human review.
-   Display source and verification date.
-   Verify office staff through invitation and organization approval.
-   Label citizen-submitted claims as citizen-submitted.
-   Label office statements as official office responses only after
    account verification.
-   Preserve immutable event history.
-   Publish corrections and status changes transparently.
-   Provide a process to challenge inaccurate profile or case
    information.

## 18.4 Data sovereignty and governance

- **Ownership:** citizens own their submissions; the operating organization
  is the data controller and acts only for the stated purposes. Offices see
  only what their role and constituency allow.
- **Residency map:** document where each data class is stored (database,
  media, backups, logs) and where it is processed (hosting region, AI
  inference, speech-to-text, email/SMS). Prefer providers and regions that
  meet Bangladesh requirements; review this with counsel before a pilot.
- **Minimize cross-border processing:** send only redacted text to external
  AI services; keep embeddings in our own database; prefer self-hostable
  components where quality is comparable.
- **No training by default:** citizen data is not used to train models.
- **Retention and deletion:** define retention per data class, support
  export and deletion requests, and honour legal holds.
- **Lineage:** every external dataset carries source, licence and fetch date.
- **Governance:** name a data-protection owner, review AI and data changes
  before release, and record decisions in the audit log.

------------------------------------------------------------------------

# 19. Language, Accessibility and Localization

## 19.1 Bangla-first language policy

- **Bangla (`bn-BD`) is the primary language of Jonokotha.** It is the default
  for every new user and every surface: citizen app, MP-office dashboard,
  admin console, notifications, SMS, email, AI outputs, help pages, error
  messages and the privacy notice.
- **English (`en`) is a secondary option** that anyone can switch to at any
  time. No feature may require English.
- **Write Bangla first.** Every string is written in Bangla and then
  translated into English, not the other way round. `bn` is the source locale
  in `packages/i18n`; a missing key falls back to Bangla, never to a raw key.
- **Native review.** A native Bangla speaker reviews every user-facing string
  for plain language before release. Machine translation is only a draft.
- **Numbers and dates.** Bangla numerals (০–৯) by default in the Bangla
  interface, with a setting for 0–9. Dates like "১৫ নভেম্বর ২০২৬" and relative
  times like "২ দিন আগে". Money as "৳ ১,২০,০০০" with lakh/crore grouping.
  Phone-number and OTP fields accept both Bangla and English digits.
- **Reference codes** stay in Latin letters and digits (for example
  `JK-7Q4M2`) so they are easy to type, share and read out over the phone.
- **Search** accepts Bangla, English and Banglish (for example "rasta bhanga"
  finds "রাস্তা ভাঙা") and returns the same results.

## 19.2 Writing style — plain, everyday Bangla

Write the way people in Bangladesh talk in everyday life, so that someone
with basic reading skills understands each screen at first glance.

- Use standard **চলিত** Bangla. Never use সাধু forms ("করিয়াছে", "হইবে").
- Prefer everyday words over office or heavily Sanskritized words (Section 19.3).
- One idea per sentence; keep sentences short (about 12 words or fewer).
  Buttons are 1–3 words.
- Address the user politely and directly with "আপনি", using action verbs:
  "পাঠান", "দেখুন", "লিখুন বা বলুন".
- Use an English word only when people already say it in everyday Bangla and
  the Bangla word is harder: অ্যাপ, মোবাইল, ম্যাপ, ছবি/ভিডিও, ইন্টারনেট, এমপি,
  অফিস, লগ ইন, আইডিয়া. Write it in Bangla script.
- Error messages say what happened and what to do next, without blame:
  "ইন্টারনেট নেই। সংযোগ ফিরলে নিজে থেকেই পাঠানো হবে।"
- Keep legal or official wording out of citizen screens. Where legal text is
  required (terms, privacy), put a short easy-Bangla summary on top.
- One term for one thing everywhere: the glossary below is the source of truth.
- Keep the tone calm, respectful and neutral — no slogans, no blame, no
  political language.

| Avoid (formal / office Bangla) | Use (easy Bangla) | Meaning |
|---|---|---|
| অভিযোগ দাখিল করুন | সমস্যা জানান | Report a problem |
| বিবরণ প্রদান করুন | কী হয়েছে, লিখুন বা বলুন | Describe it |
| অবস্থান নির্ধারণ করুন | সমস্যাটা কোথায়? | Location |
| শ্রেণি নির্বাচন করুন | কী ধরনের সমস্যা? | Category |
| জমা প্রদান করুন | পাঠান | Submit |
| নিবন্ধন করুন | অ্যাকাউন্ট খুলুন | Sign up |
| প্রবেশ করুন | লগ ইন করুন | Sign in |
| সংশ্লিষ্ট দপ্তর / কর্তৃপক্ষ | দায়িত্বে থাকা অফিস | Responsible authority |
| কার্যালয় | অফিস | Office |
| অগ্রগতি পর্যবেক্ষণ করুন | কাজ কতদূর, দেখুন | Track progress |
| প্রস্তাবনা | আইডিয়া | Idea |
| সমর্থন জ্ঞাপন করুন | আমিও চাই | Support an idea |
| অতিরিক্ত তথ্য প্রেরণ করুন | আরও তথ্য দিন | Add information |
| পুনরায় উন্মুক্ত করুন | আবার খুলুন | Reopen |
| প্রমাণাদি সংযুক্ত করুন | ছবি বা প্রমাণ দিন | Add evidence |
| বিজ্ঞপ্তি | নতুন খবর | Notifications |

## 19.3 Core terms (glossary)

| Concept | Bangla in the app | English |
|---|---|---|
| Issue / report | সমস্যা | Problem |
| My reports | আমার সমস্যাগুলো | My reports |
| Reference ID | সমস্যা নম্বর | Reference number |
| Idea | আইডিয়া | Idea |
| Support an idea | আমিও চাই | Support |
| MP | এমপি | MP |
| MP office | এমপির অফিস | MP office |
| Office response | এমপির অফিসের উত্তর | Office response |
| Responsible authority | দায়িত্বে থাকা অফিস | Responsible authority |
| Status | এখন কী অবস্থা | Status |
| Timeline | কী কী হয়েছে | Timeline |
| Evidence | প্রমাণ | Evidence |
| Announcement | ঘোষণা | Announcement |
| Poll | মতামত দিন | Poll |
| Public project | এলাকার উন্নয়ন কাজ | Public project |
| Constituency | নির্বাচনী এলাকা | Constituency |
| Ward / union | ওয়ার্ড / ইউনিয়ন | Ward / union |
| AI suggestion | AI-এর পরামর্শ | AI suggestion |
| AI-drafted text label | AI-এর সাহায্যে লেখা — দেখে নিন | AI-assisted — please check |
| I have this problem too | আমারও একই সমস্যা | I have this problem too |
| Follow | খবর রাখুন | Follow |
| Find your MP | আপনার এমপি কে? | Find your MP |
| Satisfaction rating | সমাধানে আপনি কতটা খুশি? | How satisfied are you? |
| Appeal | আপিল করুন | Appeal |
| For / against | পক্ষে / বিপক্ষে | For / against |
| Agree / disagree / not sure | একমত / একমত নই / জানি না | Agree / disagree / unsure |
| You said, we did | আপনারা বললেন, যা করা হলো | You said, we did |
| Consultation | মতামত দিন | Consultation |

## 19.4 Status labels shown to citizens

| Status code | Bangla label | English label |
|---|---|---|
| `SUBMITTED` | পাঠানো হয়েছে | Submitted |
| `UNDER_REVIEW` | দেখা হচ্ছে | Under review |
| `NEEDS_INFORMATION` | আরও তথ্য দরকার | More information needed |
| `ACKNOWLEDGED` | এমপির অফিস পেয়েছে | Received by the office |
| `ASSIGNED` | একজনকে দায়িত্ব দেওয়া হয়েছে | Assigned |
| `REFERRED_TO_AUTHORITY` | দায়িত্বে থাকা অফিসে পাঠানো হয়েছে | Sent to the responsible authority |
| `IN_PROGRESS` | কাজ চলছে | In progress |
| `RESOLVED` | সমাধান হয়েছে | Resolved |
| `CLOSED` | বন্ধ করা হয়েছে | Closed |
| `REJECTED` | নেওয়া হয়নি (কারণসহ) | Not accepted (with reason) |
| `DUPLICATE` | একই সমস্যা আগেই জানানো হয়েছে | Already reported |
| `OUT_OF_JURISDICTION` | এই অফিসের কাজের বাইরে | Outside this office's responsibility |
| `REOPENED` | আবার খোলা হয়েছে | Reopened |

Every status shows one short sentence explaining what happens next, for
example "কাজ চলছে — পরের খবর এলে আপনাকে জানাব।"

## 19.5 Issue categories

| Slug | Bangla label | English label |
|---|---|---|
| `roads` | রাস্তাঘাট | Roads & transport |
| `flooding` | জলাবদ্ধতা ও বন্যা | Flooding & waterlogging |
| `drainage` | ড্রেন ও নালা | Drainage |
| `water` | পানির সমস্যা | Water supply |
| `electricity` | বিদ্যুৎ | Electricity |
| `waste` | ময়লা-আবর্জনা | Waste |
| `health` | স্বাস্থ্যসেবা | Public health |
| `education` | স্কুল ও পড়াশোনা | Education |
| `safety` | নিরাপত্তা | Public safety |
| `public_facilities` | সরকারি ভবন ও সুবিধা | Public infrastructure |
| `environment` | পরিবেশ | Environment |
| `other` | অন্য কিছু | Other |

Each category also has a simple icon so it can be recognized without reading.

## 19.6 Bangla in AI and voice

- AI agents accept Bangla, Banglish, English and regional speech, and always
  reply in plain standard চলিত Bangla using the glossary terms, unless the
  user chose English.
- Speech-to-text must be tested with real Bangladeshi voices: different
  districts and dialects, older and younger speakers, and noisy streets. Always
  show the transcript so the citizen can correct it before sending.
- Office reply drafts are in plain Bangla; staff can ask for English.
- Read-aloud (text-to-speech) for key screens and office replies is planned
  for Release 1.1 to help citizens who find reading hard.

## 19.7 Fonts, rendering and SMS

- Use Noto Sans Bengali or Hind Siliguri, at least 16 px for body text and a
  line height of about 1.6 for Bangla.
- Test conjuncts (যুক্তাক্ষর), reph and ya-phala rendering on low-end Android
  phones, in PDFs and in exports.
- Bangla SMS uses Unicode, so one SMS segment holds about 70 characters
  instead of 160. Keep SMS text short and budget for it.

## 19.8 Accessibility

- Aim for WCAG 2.2 AA.
- Full keyboard access on web.
- Screen-reader labels and semantic headings, in Bangla.
- High contrast and scalable text.
- Captions/transcripts for video.
- Do not communicate status by color alone.
- Large touch targets.
- Clear error messages and form instructions.
- Low-bandwidth and low-literacy-friendly content: icons with every label,
  voice input and short sentences.

## 19.9 Language testing

- First-glance test: show a screen to citizens with basic reading skills and
  check that they can say what to do next within a few seconds.
- Test with people from different districts, ages and education levels,
  including older users and first-time smartphone users.
- Native-speaker plain-language sign-off is part of the Definition of Done.

------------------------------------------------------------------------

# 20. Performance and Reliability

Targets for MVP:

- Core page usable on typical mobile network within a few seconds.
- Keep initial JavaScript bundle lean.
- Lazy-load maps, charts and media.
- Compress and resize images before upload.
- Use thumbnails in feeds.
- Paginate all large lists.
- Cache public read-only data safely.
- Use optimistic UI only for reversible low-risk actions.
- Avoid realtime subscriptions to entire tables.
- Use retry/backoff for network errors.
- Preserve draft reports locally with secure storage.
- Provide upload progress and resumable/retry behavior where supported.

Reliability:

- Production database backups.
- Restore drills.
- Monitoring and alerting.
- Status page or service notice.
- Queue retry and dead-letter handling for background tasks.
- Defined recovery point and recovery time objectives before public launch.

------------------------------------------------------------------------

# 21. Testing Strategy

## 21.1 Unit tests

-   Validation schemas.
-   Permission checks.
-   Status transition rules.
-   Reference ID generation.
-   Priority calculation.
-   Notification preference logic.
-   Duplicate-link logic.
-   Locale formatting.

## 21.2 Integration tests

-   Auth and profile lifecycle.
-   Report creation with media.
-   Status transition + audit event transaction.
-   Office assignment and forwarding.
-   Idea support uniqueness.
-   Poll vote uniqueness.
-   Notification delivery queue.
-   RLS policy behavior.

## 21.3 End-to-end tests

1.  Citizen registers and selects constituency.
2.  Citizen submits a report with a map pin and photo.
3.  Citizen sees reference ID and status timeline.
4.  Office manager acknowledges and assigns the report.
5.  Staff adds a public update and private note.
6.  Staff forwards it and records reference.
7.  Office resolves it with evidence.
8.  Citizen provides feedback and reopens if unresolved.
9.  Citizen submits idea and supports another idea.
10. Unauthorized user cannot view private report data.
11. Office A cannot access Office B's cases.
12. Moderator handles abuse report and appeal.
13. Visitor finds their MP from their area without signing in.
14. Citizen B taps "I have this problem too" on Citizen A's issue; the count
    rises once per account and B receives the next update.
15. Citizen rates a resolved case, then appeals; the office must respond
    before the case closes.
16. Release 1.1: a consultation shows only aggregate groups above the
    minimum size; one vote per citizen per statement.
17. Release 1.1: an idea reaching the threshold alerts the office and shows
    the due date; a missed date shows as overdue.

## 21.4 Device and network testing

-   Low-end Android.
-   Current Android versions.
-   Chrome on Android and Safari on iPhone, in the browser and installed as a PWA.
-   Desktop Chrome, Firefox, Safari and Edge.
-   Slow 3G / unstable network simulation.
-   Location permission denied.
-   Camera permission denied.
-   Large/invalid upload.
-   Offline submission draft.
-   Bangla text input and font rendering.

## 21.5 AI quality gates

- AI outputs validate against their JSON schemas.
- Redaction removes phone numbers, emails and ID numbers in Bangla and English test sets.
- No AI action changes case status or publishes content without a recorded human decision.
- Evaluation suite meets the team's agreed thresholds with no regression.
- Every AI feature degrades to its manual path when the provider is unavailable.

## 21.6 Release gates

Do not launch if:

- RLS tests fail.
- Private data appears in public endpoints.
- Office accounts can cross constituency boundaries.
- Critical status changes lack audit logs.
- Backup restore has not been tested.
- No moderation and abuse-report process exists.
- Privacy notice and terms are missing.
- Emergency disclaimer is unclear.
- AI quality gates fail.

------------------------------------------------------------------------

# 22. Analytics and Reporting

Citizen-facing public metrics:

- Number of public reports by category and area.
- Status distribution.
- Recent updates.
- Published project milestones.
- Idea support counts.
- Number of people affected per public issue.
- Office questions answered and median time to first answer, with method.
- Date range and last-updated timestamp.

Office-only metrics:

- Unassigned workload.
- Time to acknowledgement.
- Time in status.
- Forwarding rate.
- Resolution rate with evidence.
- Reopened cases.
- Staff workload.
- Category and geographic trends.
- Citizen satisfaction.

Admin metrics:

- Platform adoption.
- Abuse and spam rates.
- Authentication failures.
- API errors and latency.
- Notification delivery.
- Storage and compute cost.

Privacy:

- Aggregate small groups to avoid re-identification.
- Suppress sensitive location/category combinations.
- Do not publish personal performance data of individual staff without a legitimate policy basis.
- Explain how each metric is calculated.

------------------------------------------------------------------------

# 23. Development Workflow and Team Structure

## 23.1 Team roles (mandatory for AIBC)

Teams have 3–5 members. Every member must have a declared role in the
submission; one person may hold more than one role, but every role must be
owned by a named member.

| AIBC role | Jonokotha responsibilities | Owner |
|---|---|---|
| Team Leader / Coordinator | Vision, milestones, scope decisions, submission deadlines | [name] |
| Business Analyst / Data Scientist | Problem, users, KPIs, data sources, AI evaluation design, business model | [name] |
| UI/UX / Frontend Developer | Citizen and office interfaces, Bangla-first and low-bandwidth UX, accessibility | [name] |
| Backend / Data Engineer | Database, RLS, APIs, LLM integration, RAG, scrapers, graph, deployment | [name] |
| Presentation / Communication Lead | Video, demo script, documentation, pitch, Q&A preparation | [name] |

Composition guidance from the guide: 2–3 members who can build full-stack AI
systems, one member focused on users and adoption, at least one female
participant (bonus points), cross-institution members where possible, and
optionally an NRB or international expert in a defined role. Record every
collaborator's contribution in `docs/aibc/collaborators.md`; advisors and
mentors must not write the product's code or influence judging.

## 23.2 Git workflow

-   `main`: production-ready.
-   `develop`: integration branch.
-   `feature/<ticket>-short-name`: individual work.
-   Pull request required before merge.
-   At least one reviewer for security-sensitive changes.
-   CI must pass before merge.
-   Use small, focused commits.
-   Do not commit `.env`, secrets, user data or production dumps.
-   Use migrations for all schema changes.
-   Keep API contracts and shared types updated.

## 23.3 Definition of Done

A feature is complete only when:

- Acceptance criteria pass.
- Loading, empty, error and success states exist.
- Responsive layout is tested.
- Bangla text is written first, passes native-speaker plain-language review and uses the glossary; English labels are present.
- Accessibility basics are covered.
- Server-side validation and authorization exist.
- Audit/notification requirements are implemented.
- Automated tests pass.
- Documentation is updated.
- No secrets or sensitive data are exposed.

------------------------------------------------------------------------

# 24. Implementation Phases

## Sprint 0 — Preliminary submission (15–20 Nov 2026)

-   Freeze the golden path (Section 4.1) and declare team roles.
-   Set up the repository, Supabase project, CI and staging deployment.
-   Import real constituency, boundary and agency-directory data with sources.
-   Build the Intake Agent, issue submission, public issue page and office queue
    with copilot summary and routing suggestion.
-   Write the problem, AI architecture and data-sovereignty drafts in `docs/aibc/`.
-   Record and submit the 180-second video.

**Deliverables:** working golden path on staging, preliminary package, video.

## Sprint 1 — Foundation hardening (21 Nov – 1 Dec)

-   Complete auth, profiles, roles, RLS and audit events.
-   Finish the case state machine and office actions.
-   Add the Duplicate Agent, embeddings and graph edges.
-   Start the evaluation set and baseline measurements.

**Deliverables:** secure core with tested permissions and first AI metrics.

## Sprint 2 — MVP build (2–12 Dec)

-   Bangla voice intake, translation and the full copilot panel.
-   Ideas with similar-idea suggestions; personalized feed.
-   Find your MP, "I have this problem too", follow, satisfaction rating and
    appeal, share links, and office response counts on the MP profile.
-   Admin verification, moderation and AI run log.
-   Hotspot view and basic analytics.

**Deliverables:** MVP feature set (Section 4.2) working end-to-end.

## Sprint 3 — Production hardening (13–20 Dec)

-   Security, RLS, accessibility, performance and low-bandwidth testing.
-   AI evaluation run and published results; fix regressions.
-   Backup/restore drill, monitoring and runbooks.
-   Complete every `docs/aibc/` document.

**Deliverables:** production-grade deployment and evidence pack.

## Sprint 4 — Freeze and rehearse (21–25 Dec)

-   Feature freeze; only fixes.
-   Seed and verify the labelled demo constituency; reset script tested.
-   Rehearse the 3-minute pitch and Q&A; record the backup demo.

**Deliverables:** deployed product, polished demo, rehearsed team.

## Congress Day — 26 Dec 2026

-   Live demo and judging; Opportunity Connect meetings with prepared one-page summary.

## After the Congress

-   **Pilot:** onboard one verified MP office and a citizen tester group; validate costs; publish terms and privacy notice.
-   **Release 1.1:** polls, project tracker, insight
    briefs, WhatsApp/SMS reporting, consultations, for/against points, idea
    support threshold, priority ranking and project check-ins (Section 4.3).
-   **Release 2:** agency integrations, open data, regional support,
    participatory budgeting, Right to Information helper, MP activity from
    official records and an Open311-compatible API (Section 4.4).

------------------------------------------------------------------------

# 25. Suggested MVP Delivery Plan

A practical first release can be split into these workstreams:

| Workstream | Main output |
|---|---|
| Foundation | Repo, CI/CD, auth, DB, RLS |
| Citizen web (PWA) | Home, explore, report, ideas, profile |
| AI core | Intake, duplicate, routing, copilot agents; RAG; graph; evals |
| Data & knowledge | Public-source ingestion, agency directory, lineage |
| Office dashboard | Case queue, assignment, responses, copilot panel |
| Admin | Verification, moderation, AI run log |
| QA/security | RLS, E2E, accessibility, AI quality gates, release gates |
| Competition | `docs/aibc/` package, video, demo script, rehearsal |

Prioritize a complete end-to-end workflow over many disconnected
screens. The MVP is not complete until a citizen can submit a real test
issue and an authorized office user can process it with an auditable
status update.

------------------------------------------------------------------------

# 26. Environment Variables and Deployment

Example `.env.example` (placeholders only):

``` bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

MAP_PROVIDER=
MAP_PUBLIC_TOKEN=

FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=

EMAIL_PROVIDER_API_KEY=
SMS_PROVIDER_API_KEY=

ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-5-5
EMBEDDING_MODEL=
EMBEDDING_ENDPOINT=
STT_PROVIDER=
STT_API_KEY=

SENTRY_DSN=
```

Rules:

- Only public client-safe keys may use public prefixes.
- Service-role, email, SMS, AI and speech-to-text keys must be server-side secrets.
- Never put secrets in Git.
- Separate development, staging and production projects.
- Use least-privilege deployment credentials.
- Apply database migrations through reviewed CI/CD.
- Add a rollback plan for application releases and forward-fix strategy for database migrations.

------------------------------------------------------------------------

# 27. Seed Data and Demo Mode

For demos:

- Use clearly fictional citizens and staff.
- Label all sample reports, projects, budgets and statistics as demo data.
- Do not create fake verified MP profiles.
- Do not imply a real agency has received a report.
- Use a dedicated demo constituency or sandbox.
- Reset demo data safely between demonstrations.
- Ensure demo accounts cannot access production.
- Provide one-click demo citizen and demo office sign-in on staging only, for judges and reviewers.
- Keep a scripted demo reset that restores the golden-path starting state.
- Build the demo agency directory from real public sources (Section 17.6), but never send real agencies any demo case.

------------------------------------------------------------------------

# 28. Risks and Mitigation

| Risk | Mitigation |
|---|---|
| MP or office does not participate | Start with verified office onboarding; provide citizen-facing status and official contact alternatives |
| Reports are ignored | Public acknowledgement targets, escalation queue and transparent inactivity indicators |
| False or duplicate reports | Verification signals, duplicate linking, moderation and appeal |
| Political misuse | Neutral design, conduct policy, audit logs and transparent moderation |
| Privacy leakage | RLS, private media, approximate public location, security tests |
| Unverified project claims | Require source, verification date and evidence labels |
| Low digital literacy | Bangla-first UX, simple forms, assisted reporting and accessible help |
| Low bandwidth | Lightweight pages, image compression, draft saving |
| Agency does not integrate | Clearly label "referred" vs "officially registered" |
| AI errors | Human review, confidence labels and non-AI fallback |
| Operating cost grows | Usage limits, image optimization, monitoring and budget alerts |
| AI judged a gimmick | AI does measured structural work; show before/after and evaluation results |
| Weak Bangla AI quality | Bangla-first evaluation sets, parity metrics, human review, manual fallback |
| Wrong routing suggestion | Citations required, confidence shown, office confirmation before referral |
| AI provider outage or cost spike | Manual fallback, caching, rate limits, budget alerts |
| Deadline pressure (20 Nov, 26 Dec) | Golden path first, scope freeze dates, honest labelling of unfinished parts |
| Venue network fails on Congress Day | Recorded backup demo, local copy of slides and diagram |
| Response counts used to attack an MP | Context and method shown, no rankings or league tables, date ranges, neutral wording |
| "I have this problem too" or idea support gamed by fake accounts | Verified accounts, one per person, rate limits, anomaly checks, moderator review |
| Consultations captured by organized groups or turned political | Local-service topics only, moderation, aggregate-only results, minimum group size, no individual profiling |
| WhatsApp/SMS cost, consent or platform-rule problems | Approved providers, explicit consent, short Unicode messages, budget alerts, app as primary channel |
| Office misses committed threshold responses | Office-set targets, reminders, public overdue label, MP-level escalation |

------------------------------------------------------------------------

# 29. Launch Checklist

## Product

-   [ ] Citizen can register and select area.
-   [ ] Citizen can submit and track a report.
-   [ ] Citizen can submit and support an idea.
-   [ ] Citizen can ask a question.
-   [ ] Anyone can find their MP without an account.
-   [ ] "I have this problem too", follow, satisfaction rating and appeal work end-to-end.
-   [ ] Office response counts show their method and date range.
-   [ ] MP office can acknowledge, assign, update, forward and resolve.
-   [ ] Status history is visible and accurate.
-   [ ] Public and private content are clearly separated.

## Security

-   [ ] RLS enabled and tested.
-   [ ] MFA for privileged accounts.
-   [ ] No service keys in client bundles.
-   [ ] Upload validation and private storage configured.
-   [ ] Audit logs active.
-   [ ] Rate limiting enabled.
-   [ ] Backup and restore tested.

## Trust

-   [ ] Representative identity verified.
-   [ ] Constituency data source documented.
-   [ ] Terms and privacy policy published.
-   [ ] Moderation and appeals operational.
-   [ ] Emergency and official-channel disclaimers visible.
-   [ ] Public metrics have definitions and timestamps.

## UX

-   [ ] Bangla and English tested.
-   [ ] Mobile and desktop responsive.
-   [ ] Keyboard and screen-reader checks completed.
-   [ ] Empty/error/offline states implemented.
-   [ ] Low-bandwidth testing completed.

## Operations

-   [ ] Support contact and escalation process ready.
-   [ ] Monitoring and alerts active.
-   [ ] Incident response owner assigned.
-   [ ] Deployment and rollback runbooks ready.
-   [ ] Pilot office and citizen testers onboarded.

## AIBC submission

-   [ ] Team roles declared with named owners.
-   [ ] Preliminary video submitted by 20 Nov 2026.
-   [ ] Problem definition, AI architecture, data & sovereignty strategy, scalability roadmap and ethical safeguards documents complete.
-   [ ] AI usage and collaborator contributions documented.
-   [ ] Golden path works live on staging; backup recording ready.
-   [ ] AI evaluation results published with date and limitations.
-   [ ] Everything shown is real or clearly labelled as planned or demo.
-   [ ] 3-minute pitch rehearsed; Q&A sheet prepared.

------------------------------------------------------------------------

# 30. Product Copy and Key Interface Text

Bangla is the main copy; follow the style guide and glossary in Section 19.

-   App name: **জনকথা (Jonokotha)**
-   App tagline: **আপনার কথা, আপনার প্রতিনিধি, আপনার এলাকার উন্নয়ন।**
-   Report button: **সমস্যা জানান**
-   Speak or type: **বলুন বা লিখুন**
-   Idea button: **এলাকার উন্নয়নে আইডিয়া দিন**
-   Explore: **এলাকার সমস্যাগুলো দেখুন**
-   Ask MP: **এমপিকে প্রশ্ন করুন**
-   My reports: **আমার সমস্যাগুলো**
-   Status: **এখন কী অবস্থা**
-   Timeline: **কী কী হয়েছে**
-   Public projects: **এলাকার উন্নয়ন কাজ**
-   Office response: **এমপির অফিসের উত্তর**
-   Sent to authority: **দায়িত্বে থাকা অফিসে পাঠানো হয়েছে**
-   Resolved: **সমাধান হয়েছে — প্রমাণ দেখুন**
-   Support an idea: **আমিও চাই**
-   AI label: **AI-এর সাহায্যে লেখা — একবার দেখে নিন, দরকার হলে বদলান।**

Key messages:

-   **After sending:** "আপনার সমস্যা পাঠানো হয়েছে। সমস্যা নম্বর: JK-7Q4M2।
    এই নম্বর দিয়ে যেকোনো সময় খোঁজ নিতে পারবেন।"
-   **Before sending — what others can see:** "সবাই দেখবে: সমস্যার কথা, ছবি
    আর আনুমানিক জায়গা। কেউ দেখবে না: আপনার ফোন নম্বর, ইমেইল আর সঠিক ঠিকানা।"
-   **Personal details found in the text:** "আপনার লেখায় ফোন নম্বর বা এনআইডি
    নম্বর আছে। আপনার নিরাপত্তার জন্য এগুলো সরিয়ে দেব?"
-   **Location permission:** "সমস্যাটা ঠিক কোথায়, ম্যাপে দেখাতে আপনার লোকেশন
    লাগবে। না দিলেও চলবে — ম্যাপে নিজে জায়গা বেছে নিতে পারবেন।"
-   **No internet:** "ইন্টারনেট নেই। সংযোগ ফিরলে নিজে থেকেই পাঠানো হবে।"
-   **More information requested:** "এমপির অফিস আরও কিছু তথ্য জানতে চায়।
    উত্তর দিতে এখানে চাপ দিন।"

Important disclaimer (shown before the first report and in Help):

"জনকথায় সমস্যা জানালে তা নিজে থেকে সরকারি অভিযোগ হিসেবে জমা হয় না। আপনার
এমপির অফিস সমস্যাটি দেখবে, আর দরকার হলে দায়িত্বে থাকা অফিসে পাঠাবে। এখানে যে
অবস্থা দেখানো হয়, তা ওই অফিসগুলোর দেওয়া তথ্য। বিপদ বা জরুরি অবস্থায় এখনই
৯৯৯-এ ফোন করুন।"

Verify the emergency number and any official channel before launch, and keep
the English version of every message as a translation of the Bangla.

------------------------------------------------------------------------

# 31. Single Master Build Prompt for an AI Coding Agent

Copy the entire prompt below into your coding agent after adding this
master plan to the project repository.

------------------------------------------------------------------------

## MASTER BUILD PROMPT — JONOKOTHA (জনকথা)

You are the principal product architect, senior full-stack engineer,
mobile engineer, database architect, security engineer, UI/UX designer
and QA lead responsible for building **Jonokotha (জনকথা)**, a production-minded
citizen-to-representative communication and local development platform.

### Mission

Build a complete, user-friendly, secure, accessible and responsive
web application that works well on phones. Citizens must be able to report local
problems, attach evidence, identify a location, track progress, ask
their representative questions and suggest development ideas. Verified
MP offices must be able to manage reports, communicate with citizens,
assign work, refer issues to agencies, publish updates and show
verifiable progress. A human-reviewed AI core (Section 17) must turn
Bangla/English voice and text into structured cases, detect duplicates,
suggest cited routing and help office staff summarize and reply.

### Source of truth

Read this entire `masterplan_JONOKOTHA.md` before coding. Treat it as the
product and technical source of truth. If repository architecture
already exists, inspect it before changing anything. Preserve working
features. Do not overwrite or delete existing work without understanding
its purpose.

### Mandatory engineering principles

1.  Build a coherent end-to-end product, not disconnected UI mockups.
2.  Use TypeScript and strict typing.
3.  Use a modular monolith for the MVP.
4.  Use PostgreSQL, Supabase Auth, Storage and RLS if using the
    recommended Supabase stack.
5.  All privileged operations must be authorized server-side.
6.  Use database migrations for schema changes.
7.  Use shared validation schemas and API contracts.
8.  Make Bangla the primary language from the beginning: write every
    string in plain everyday চলিত Bangla first, following the style guide
    and glossary in Section 19; English is a secondary translation.
9.  Make web responsive and mobile touch-friendly.
10. Implement loading, empty, error, offline, success and unauthorized
    states.
11. Keep public data separate from private citizen data.
12. Create an audit event for every privileged case status or ownership
    change.
13. Never expose secret keys in client code.
14. Do not fabricate official representatives, agency integrations,
    budgets, project progress or statistics.
15. Label all seeded/demo content clearly.
16. The AI core is required, but humans retain decision authority: AI
    output is always a reviewable suggestion with provenance and a manual
    fallback.
17. Never silently discard a citizen report.
18. Do not claim an app submission is an official government filing
    unless an authorized integration proves it.
19. Design and validate the product against the AIBC 2026 judging rubric:
    Innovation & AI-Native Design; Technical Excellence & Architecture;
    Business Value & Commercial Viability; Global Scalability & Real-World
    Impact; Responsible AI, Data Sovereignty & Presentation. Use Section 2 as
    a mandatory product and delivery checklist.
20. Keep the MVP credible and demoable. Distinguish implemented, prototype,
    planned and assumed capabilities; never fabricate metrics, partnerships,
    revenue, official integrations or evaluation evidence.
21. Keep the architecture configurable for future countries while retaining
    Bangladesh as the initial context. Do not hard-code country-specific legal
    or administrative assumptions into shared business logic.
22. Use real, legally sourced public data with recorded lineage; never use
    hardcoded or fake data as a substitute for integration.

### Required applications

Build:

- Citizen web app: mobile-first, responsive and installable as a PWA.
- MP office dashboard (web).
- Platform admin and moderation console (web).

This is a web-only product: do not build native Android or iOS apps.

### Required citizen features

-   Registration, login and profile.
-   Bangla by default everywhere, with an English switch.
-   Constituency selection and representative directory.
-   Home dashboard.
-   Explore issue feed and map/list view.
-   Issue reporting wizard with category, title, description, location,
    optional image/video and review screen.
-   Unique report reference.
-   My Reports and issue detail timeline.
-   Private and public visibility rules.
-   Citizen additional information and reopen request.
-   Ideas feed, idea submission, support/vote and comments.
-   Ask Your MP private/public question flow.
-   Notifications and preferences.
-   Representative profile and verified office responses.
-   Help, privacy, terms and emergency disclaimer.
-   AI-assisted intake by text or Bangla voice, with a manual path.
-   Similar reports and similar ideas.
-   Personalized home feed with an off switch.
-   Public "find your MP" lookup.
-   "I have this problem too", follow, satisfaction rating and appeal.
-   Share links for WhatsApp and Facebook.

### Required MP office features

-   Secure office login and MFA support.
-   Role-based access for MP, office manager, staff and liaison.
-   Overview dashboard.
-   Case queue, search, filters and assignment.
-   Acknowledge, request information, update, forward and resolve
    actions.
-   Public response separated from internal notes.
-   Evidence attachments.
-   Idea review and decision with reasons.
-   Questions inbox and replies.
-   Announcements.
-   Projects and milestones when implemented.
-   Analytics, export permissions and audit log.
-   AI copilot panel: summary, missing-information check, similar cases,
    cited routing suggestion and reply draft, each with Accept/Edit/Dismiss.
-   Hotspot view.
-   Affected-citizen counts on cases, and the appeal queue.
-   Release 1.1: consultations, "you said, we did" reports, idea support
    thresholds and project check-in responses.

### Required admin features

-   Representative and office verification.
-   Constituency and category management.
-   User and role management.
-   Moderation queue and abuse reports.
-   Appeals and decision reasons.
-   Audit/security logs.
-   System health and integration configuration.
-   Safe demo-data management.
-   AI run log, evaluation results and knowledge-source management.

### Required workflows

Implement the complete workflows in the master plan:

- Citizen onboarding.
- Issue submission.
- Office review, assignment and response.
- External agency referral.
- Resolution with evidence and citizen feedback.
- Reopen and appeal.
- Idea review and lifecycle.
- Question and answer lifecycle.
- Moderation and abuse handling.
- Notification delivery.

Implement issue status transitions as a controlled state machine. Reject
invalid transitions server-side. Preserve every transition in an
immutable or append-only event history. Do not allow a client to
directly set an arbitrary status.

### Database and security

Create normalized tables and migrations for profiles, constituencies,
representatives, office members, issues, categories, media, events,
assignments, agency referrals, ideas, supports, comments, questions,
messages, projects, milestones, announcements, polls, votes,
notifications, moderation reports, audit logs, consents, agencies,
knowledge sources and chunks, issue embeddings, graph edges, AI runs, AI
suggestions and user preferences.

Add:

- Foreign keys, unique constraints and useful indexes.
- Geospatial support if the selected database configuration supports it.
- RLS policies denying access by default.
- Public-safe views that expose only approved fields.
- Private storage buckets and signed URLs.
- Server-side validation.
- Rate limiting.
- Upload size/type validation.
- Secure secrets management.
- MFA for privileged roles.
- Automated authorization tests.

Test that one citizen cannot view another citizen's private data and one
office cannot access another constituency's cases.

### UI/UX quality bar

Create a polished, modern civic-tech interface. It must feel
trustworthy, neutral, calm and easy to use. Use a consistent design
system, clear typography, Bangla-compatible fonts, responsive layouts,
accessible colors, large touch targets, concise copy and obvious primary
actions. Avoid political party branding and excessive decoration.

Use a consistent, friendly vector-illustration language to make civic tasks
approachable without making the product childish. Prefer clean flat vector
artwork, rounded geometry, restrained outlines, subtle depth and a cohesive
civic-blue / teal-green / warm-amber / off-white palette. Create reusable SVG
illustrations or optimized vector assets for onboarding, empty states, issue
categories (roads, drainage, flooding, waste, water, electricity and public
facilities), idea submission, report tracking, successful submission, work in
progress and verified resolution. Use recognizable icons for navigation and
actions. Illustrations must support comprehension, not replace labels or
status text. Keep the visual language politically neutral and representative
of Bangladesh's diverse communities. Respect reduced-motion preferences,
contrast requirements, text scaling and low-bandwidth loading; provide
lightweight fallbacks when illustrations cannot load.

Citizen navigation on phones (bottom bar): হোম / এলাকা / সমস্যা জানান / আইডিয়া / আমি.

Office dashboard: Overview / Reports / Assigned Cases / Ideas /
Questions / Projects / Announcements / Analytics / Staff / Audit /
Settings.

Admin: Overview / Constituencies / Representatives / Users / Moderation
/ Security / Integrations / Settings.

Use real functional controls. Every button, form, filter, tab, menu and
navigation item must work. Do not leave decorative controls pretending
to be functional. If a feature is not implemented, label it as
unavailable or keep it out of the production navigation.

### Data integrity and content

Use realistic but fictional demo data only in development. Mark it as
demo. Never invent a real MP, verified office, government agency
relationship, official budget or completion status. Display source and
verification dates for official data.

### AI core

Implement the agents, knowledge layer, personalization and evaluation suite
in Section 17. Build the golden path first: intake → submitted case →
duplicates → cited routing → copilot → human decision → citizen update.
Call the LLM only server-side through the official Anthropic SDK with
structured outputs; redact personal data first; log every run. Always label
output as a suggestion, require a human decision, and provide a non-AI
fallback. Never automatically reject, close or publish, and never determine
credibility.

### Development execution protocol

Work in the following order:

**Stage 1 — Repository audit**

- Inspect all files, dependencies, routes, existing components, database schema and deployment configuration.
- Identify what already works.
- Write a concise implementation plan and dependency map.
- Do not make destructive changes.

**Stage 2 — Foundation**

- Configure monorepo or preserve existing repository structure.
- Configure lint, formatting, type checking and CI.
- Configure environment variables and `.env.example`.
- Set up database migrations, auth and RLS.
- Add error monitoring.

**Stage 3 — Shared design and identity**

- Build design tokens, typography, buttons, inputs, cards, dialogs, navigation, status badges, tables, map/list primitives and localization.
- Build responsive shell and role-based navigation.

**Stage 4 — Citizen vertical slice**

- Complete registration → constituency → report → media/location → submission → reference ID → report details → status timeline.
- Add tests before moving on.

**Stage 5 — Office vertical slice**

- Complete office authentication → case queue → assignment → public update/internal note → referral → resolution evidence → citizen notification.
- Add RLS and workflow tests.

**Stage 6 — AI core and knowledge layer**

- Ingest public sources with lineage; build pgvector indexes and graph edges.
- Implement the Intake, Duplicate, Routing and Copilot agents with structured outputs and the suggestion decision flow.
- Add the MCP server for read-only tools, personalization and the evaluation suite in CI.

**Stage 7 — Ideas and questions**

- Complete idea submission, support uniqueness, moderation and office review.
- Complete private/public question and response workflow.

**Stage 8 — Admin and trust**

- Complete verification, moderation, abuse reports, appeals, audit and admin configuration.

**Stage 9 — Hardening**

- Test the PWA on real low-cost Android phones and on iPhone Safari, including install, offline drafts and web push.

- Run unit, integration, E2E, RLS, accessibility, performance and security checks.
- Fix critical and high-severity defects.
- Verify backup and restore.
- Prepare staging and production deployment documentation.

### Required testing scenarios

At minimum test:

1. Citizen A submits a report and can see it.
2. Citizen B cannot see Citizen A's private data.
3. Office A can manage only its authorized constituency.
4. Office B cannot access Office A's cases.
5. Invalid status transitions are rejected.
6. Every status transition creates an audit event.
7. Duplicate idea support is rejected.
8. Duplicate poll vote is rejected.
9. Private media cannot be accessed without authorization.
10. Public issue pages do not expose phone, email or exact private coordinates.
11. Reopening preserves previous history.
12. Demo records are visibly labelled.
13. Bangla and English layouts render correctly, and Bangla copy uses the
    Section 19 glossary with no সাধু forms or untranslated English.
14. Forms work on narrow mobile screens.
15. Offline/failed uploads can be retried without duplicate submissions.
16. No AI suggestion changes status or publishes content without a recorded human decision.
17. Personal data is redacted before any AI provider call.
18. Routing suggestions without a valid citation are not shown as confident.
19. Every AI feature falls back to its manual path when the provider fails.
20. "I have this problem too" counts once per account and never reveals who
    the other affected citizens are.
21. The MP profile shows response counts with method and date range and no
    comparison with other MPs.

### Documentation to deliver

-   `README.md` — setup, scripts and deployment.
-   `docs/architecture.md`
-   `docs/database-schema.md`
-   `docs/permissions-and-rls.md`
-   `docs/workflows.md`
-   `docs/api-contracts.md`
-   `docs/security-and-privacy.md`
-   `docs/testing.md`
-   `docs/deployment.md`
-   `docs/ai-architecture.md` and `docs/ai-evaluation.md`
-   `docs/data-sources.md`
-   `docs/aibc/` submission package (Section 2.4)
-   `.env.example`
-   Database migrations and seed scripts.
-   Test suite and CI workflow.

### Coding-agent behavior

-   Do not stop after producing a plan; implement the product.
-   Work in small, verifiable increments.
-   Before adding a dependency, explain why it is needed and check
    whether an existing dependency already solves the problem.
-   Do not rewrite working modules merely for stylistic preference.
-   Do not use mock data as a substitute for backend integration.
-   Do not mark a feature complete until it works end-to-end and has
    tests.
-   Run typecheck, lint, tests and production build after meaningful
    milestones.
-   Fix errors rather than hiding them with `any`, disabled lint rules
    or skipped tests.
-   If a credential or external integration is missing, build a safe
    adapter/interface, document the required setup and keep the rest of
    the application functional.
-   If a requirement conflicts with security or privacy, choose the
    safer design and document the trade-off.
-   Maintain a `BUILD_STATUS.md` with completed work, remaining work,
    known issues, test results and next steps.
-   At the end of each stage, report changed files, implemented
    features, commands run, test results and blockers.

### Final acceptance criteria

The product is ready for pilot only when:

- A citizen can submit and track a report end-to-end.
- An authorized office can process it end-to-end.
- Citizens can submit and support ideas.
- Office responses and public updates are distinguishable from citizen content.
- All sensitive data is protected by tested authorization policies.
- Every privileged case action is auditable.
- The mobile-first web app (PWA) performs every core citizen task on a low-cost Android phone and on iPhone Safari.
- Bangla is the default everywhere and passes plain-language review; English is usable.
- Moderation, privacy, emergency disclaimers and support processes exist.
- The AI core works end-to-end, is labelled, human-reviewed, privacy-minimized, evaluated for Bangla/English quality and backed by a non-AI fallback.
- The team can present truthful evidence for every AIBC judging component.
- The `docs/aibc/` submission package is complete.
- Deployment, backup, restore and operational documentation are complete.

Start with Stage 1: inspect the existing repository, summarize its
current state, identify gaps against this master plan, then proceed to
implementation in the specified order. Do not assume the repository is
empty.
