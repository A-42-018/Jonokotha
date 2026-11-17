# Workflows

Plain-language description of the main flows and who acts at each step. Status machine: `docs/state-machine.md`; permissions: `docs/permission-matrix.md`; endpoints: `docs/api-v1.md`.

## 1. A citizen reports a problem
1. Draft (optionally with the AI intake, voice, a photo or one video). The citizen reviews and submits with an `Idempotency-Key`. Personal data is removed from the text before it is stored.
2. If the position is uncertain (several possible areas) the citizen chooses; the app never guesses. `submitted` → the reporter gets a "report submitted" notification (reference only).
3. The office acknowledges, may ask for more information, assigns (assignee notified), and handles. Each public note is a reply the citizen sees; **in an approval area a reply waits for the MP** (202) and is posted when approved.
4. Referral: the manager forwards to an agency (`forwarded`). The agency's liaison acknowledges (`received`), adds updates, records the agency's reference and closes their task with evidence. `officially_registered` is shown only when an administrator confirmed an integration for that agency and the office attached proof.
5. Resolution needs a note and evidence; the citizen is asked for a rating. A rejected report can be appealed (reopen); the answer notifies the citizen (`appeal_answered`).

## 2. MP approval
Area setting `mp_approval_required` (MP or admin turns it on). An office manager's announcement, public reply or project change becomes an approval request; the MP approves (the item goes out, the requester is notified) or rejects with a reason (announcement returns to draft). The MP's own actions publish directly. If the area has no active MP the rule does not apply (nothing would ever decide).

## 3. Delegation
MP or manager gives a task to a case officer or manager of the same area (optionally linked to an issue). The assignee is notified, completes it; only the delegator cancels.

## 4. Polls
Office drafts (2–10 options) → publishes (open) → closes (or it closes at its time). Verified accounts vote once. Results are hidden until closed (or always, if the office chose) and until 5 people voted. Followers who have not voted get one reminder in the last 24 hours.

## 5. Location change
Same area: applied. Different area or not placeable: pending review; the office manager of the current area (or an admin) picks one of the candidate areas or rejects; approving moves the issue and clears its assignee.

## 6. Administration
Admins manage categories, SLA targets, directory records, accounts and invitations, feature flags, integrations and knowledge sources through audited functions; they read health, jobs and security alerts. Demo data tools exist outside production only.

## 7. Background work
A scheduled call to `/api/internal/jobs/run` enqueues and runs: notification delivery, poll closing and reminders, retention and security-event purge, media scans. Failures retry with backoff; after 5 attempts a job is dead and appears in `/admin/jobs` (runbook: `docs/runbooks/jobs-dead-letters.md`).
