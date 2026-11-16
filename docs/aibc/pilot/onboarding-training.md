# Onboarding and training material (B6.1)

Draft for the pilot office. Bangla versions of the screens' own text come from the frontend strings; this page is the session plan and the practice scenarios.

## Office staff session (90 minutes, in person or video)

| Min | Topic | Show |
|---|---|---|
| 10 | What Jonokotha is and is not: it routes and tracks; it does not replace the office's decisions; AI drafts, people approve; public and private are separate | Public issue page vs office page |
| 15 | Sign in with email code; set up the authenticator app (TOTP) | MFA enrolment, recovery path from `runbooks/key-rotation.md` |
| 20 | The queue: statuses, acknowledging, assigning, requesting information, forwarding to an authority, resolving with evidence, closing, rejecting with an appeal route | `docs/state-machine.md` in plain words |
| 15 | AI help: reply drafts, routing suggestions with sources, duplicates. Always editable; nothing sent without a click; how to dismiss | Copilot panel |
| 10 | Public updates: what citizens see; what never to type into a public note (names, numbers, addresses of private people) | Public timeline |
| 10 | Small groups and metrics: why counts under 5 are hidden | Office KPIs |
| 10 | Getting help: support contact, escalation, what to send (reference code, time, what happened; never a password) | `support-escalation.md` |

## Practice scenarios (on staging, with the demo seed)

1. A pothole report arrives. Acknowledge it, assign it to a case officer, and add a public update.
2. A report has too little detail. Ask for information; the citizen answers; continue.
3. A drain report belongs to a utility. Forward it with a contact channel; see how the citizen sees it.
4. Two reports describe the same broken light. Mark one as duplicate of the other.
5. A report is out of your area. Mark it out of jurisdiction with a reason.
6. A report contains a phone number in the text. See what the system removed and what you should still check.
7. A reply draft is wrong. Edit it, then dismiss another. Where does that show up (AI acceptance)?
8. A report mentions danger to a person. What the system does (fixed guidance, moderator flag) and what the office does next (`runbooks/imminent-harm.md`).

Done when the manager completes all eight without help and can explain statuses to a colleague.

## Citizen tester guide (one page, Bangla first)

What is this: a pilot. Your report is public (without your name or contact) once it is shown; AI helps write it; you can delete your account and data any time (Settings). What to do: report a real local problem, follow it, answer questions from the office, tell us what was confusing. What not to type: other people's names, phone numbers, ID numbers. Voice: tap the microphone; typing always works. Help: [support contact]. In an emergency call 999; this service is not for emergencies.

Consent to evaluation examples (optional, separate from everything else): offering a report as an AI test example needs the `ai_eval_example` consent; it can be withdrawn at any time and the text is removed (`ai-real-use.md`).
