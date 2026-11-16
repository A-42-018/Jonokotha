# Support contact and escalation (B6.1)

Names and numbers are blank on purpose: an unanswered runbook is worse than none. Fill before `live`.

| Level | Who | Reach | Answers within | Handles |
|---|---|---|---|---|
| 1. Support | [name] | [email / chat], working hours | 1 working day | How do I, forgot sign-in, wrong status explained, bug reports |
| 2. Pilot lead | [name] | [phone] | Same day | Office problems, abuse the moderators escalate, data-correction requests |
| 3. Engineering on call | [name], backup [name] | [phone / alert channel] | S1: immediately; S2: 2 hours | Outages, wrong-person data access, bad deploy (`runbooks/incident-response.md`) |
| 4. Data-protection owner | [name] | [email] | Privacy requests: within the legal period set with counsel | Export, correction, deletion, legal holds (`governance.md`) |

Rules: every support message gets a reference; never ask for passwords or codes; to look at a person's data an administrator's read is audited (`docs/audit.md`); a privacy request is never closed by support alone; anything that touches safety goes to level 3 at once.

During an incident or planned work: post a service notice (`POST /api/v1/admin/service-notices`, shown by `GET /api/v1/service-notices`) so people are told before they ask.

Escalation test (do once before go-live): send a test message at level 1, one at level 2 and an alert at level 3; record the response times in `docs/aibc/pilot/escalation-test.md`.
