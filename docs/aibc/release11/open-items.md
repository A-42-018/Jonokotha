# Release 1.1 (backend Phase 7): what is built and what still needs people, accounts or real data

Date: 2026-11-17. Branch `claude/backend-phase7`, migrations 0070–0074, local stack only; nothing is applied to the hosted project. Source table: `docs/backend.md` Phase 7. API: `docs/api-v1.md` "Phase 7".

## Needs an account, a contract or a decision by a person
| Item | Why it is open | Who / what unblocks it |
|---|---|---|
| WhatsApp intake (B7.2) | Needs a WhatsApp Business account, a verified number, approved message templates (free-form replies only work inside the 24-hour window after the citizen writes; update messages outside it need templates) and the platform's policy review. The webhook, signature check and conversation are built and tested with a fake provider; nothing was sent through Meta | Team lead: account and number; then set `WHATSAPP_*` and switch the `whatsapp_intake` flag on |
| SMS intake and SMS updates (B7.2, B7.4) | Needs a Bangladesh SMS provider contract, a sender ID or short code (registration rules differ by operator) and a price. The generic HTTPS adapter is written to a simple JSON shape; a real provider will probably need a small adapter | Team lead: provider; set `SMS_*`; flags `sms_intake`, `channel_notifications` |
| Message prices and budgets (B7.2) | We never assume a price. Until `SMS_COST_PER_SEGMENT_USD` and `WHATSAPP_COST_PER_MESSAGE_USD` are set, spend shows as unknown (counted separately) and the 80 %/100 % alerts cannot fire | Operator: prices from the contract, then `PUT /admin/channels/budget` |
| Consent and privacy notice wording for phone numbers (B7.2) | The in-app consent text and the first WhatsApp/SMS notice are drafts | Counsel and native-Bangla review (`docs/aibc/pilot/counsel-review.md`) |
| Text-to-speech (B7.12) | Needs a provider and a Bangla voice chosen by native listeners; the route is built with a fake provider and a browser-speech fallback. Voice quality was not evaluated | Team: provider account and listening test; `TTS_*`; flag `read_aloud` |
| PDF with correct Bangla conjuncts (B7.10) | CSV is built. A real PDF needs an OFL Bengali font file in the repository and a shaping-capable renderer; neither is in the project and conjunct rendering cannot be verified without them. Interim: `format=html` returns a print-ready page and the browser prints it to PDF with the device's own shaping | Team: choose font (for example Noto Sans Bengali, OFL) and renderer, then add `format=pdf` |
| Insight Agent prose quality (B7.1, B7.9) | The AI drafts are only checked for number grounding. No native-reader review of the Bangla prompts or outputs has happened, and `ANTHROPIC_API_KEY` is not set in tests | Native reviewers; run with a key and review drafts before relying on them |
| Real consultations, check-ins, surveys, commitments, priority rounds (B7.1, B7.3, B7.6–B7.8) | The mechanics are tested with synthetic data. No real office has run any of them, so no participation figure, group result or KPI is claimed anywhere | A pilot office; then read the KPIs at `GET /office/kpis/release-1-1` |
| Apache AGE (B7.14) | Decision recorded in `docs/aibc/graph-evaluation.md`: stay on recursive SQL for now. AGE availability on the hosted project was not checked | Check the provider's extension list when a trigger in that document is met |
| Frontend | Screens, badges ("citizen-submitted", "office commitment", "non-binding"), print stylesheet and read-aloud buttons are the frontend lane (`docs/api-v1.md`, Phase 7 handoff) | Frontend session |
| Migrations on the hosted project | 0021–0023, 0030–0036, 0060–0062 and 0070–0074 are not applied there (`docs/aibc/runbooks/deploy-and-rollback.md`) | The user, through the approval-gated migrate workflow |

## Decisions made without asking (recorded so they can be changed)
See the Phase 7 status block in `docs/backend.md`.
