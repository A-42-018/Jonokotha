# Runbook: taking content down

Who may do it: moderators and administrators, always with a written reason (5 to 500 characters), which is stored and audited.

| Case | Action |
|---|---|
| Abusive, false, spam or unsafe public content | Moderation queue (`GET /api/v1/admin/moderation`), then `POST /api/v1/admin/moderation/items` with action `hide` and a reason. Restore with `restore` if it was a mistake. |
| Personal data in a public post | Hide first, then ask the author to resubmit without it. Redaction at intake is heuristic (phones, emails, ID numbers only). |
| Legal takedown request | Record who asked, when, what, on what basis. Hide immediately if the basis looks credible, then get counsel's view. Keep the audit trail. |
| A person asks for their own data to be deleted | They use the in-app request (`POST /api/v1/me/deletion-request`); erasure runs after a 14-day grace period. An administrator cannot shorten it without a recorded reason. |
| Photo that should not be public | Photos start private and public only after approval. Reject or remove through the issue's media moderation. |

Never edit or delete audit rows; they are append-only on purpose. Challenge process: the author may reply to the moderator's reason through the office/support address in the privacy notice; a different moderator reviews within 5 working days (proposal; the team must staff it).
