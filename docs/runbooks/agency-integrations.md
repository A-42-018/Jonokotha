# Agency integrations and "officially registered"

"Officially registered" means the agency's own system accepted the case. We say so only with evidence.
1. Reach an agreement with the agency (an API, a mail gateway or a portal we can verify). Record it: `POST /api/v1/admin/agency-integrations {agency_id, kind, status: "confirmed", note}` (admin; audited). Until then the status can only be `forwarded` or `received`.
2. For each case the office manager records the agency's reference and proof: `POST /api/v1/office/referrals/{id}/register {reference, proof}`. The database refuses the state without proof and a confirmed integration.
3. If an integration stops working set it to `retired`; existing registrations stay (they were true when recorded) and new ones are refused.
4. The public page shows the stage and `integration_confirmed`, never the proof.
