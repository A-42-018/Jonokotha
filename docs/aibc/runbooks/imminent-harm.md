# Runbook: threats of imminent harm

**Principle.** A person in danger gets fixed, human-written guidance and the national emergency numbers. A model never writes the reply. The system detects with rules (`src/lib/emergency.ts`), works without a network, and never blocks the report.

## What the system does

1. Intake (`POST /api/v1/ai/intake`), issue creation and private or public questions are checked by rules for self-harm, violence and threats, and children in danger (Bangla, English, Banglish).
2. On a match: intake returns `source: "emergency"`, `urgency: "urgent"` and the fixed text, with no model call. Issue and question creation still succeed and return an `emergency` object (kind, guidance in Bangla and English, numbers) for the UI to show prominently.
3. The item is flagged automatically in the moderators' queue as "unsafe" with the note "auto: imminent-harm language detected; review for safety first".

## What a moderator does (within the hour during staffed hours)

1. Read the item. If a person is in immediate danger and you can identify where, call 999 yourself; do not wait for the author.
2. If not clearly dangerous (a false alarm, e.g. a quoted threat in an old dispute), dismiss the flag with a reason.
3. Do not reply with AI text. If a human reply is appropriate, a staff member writes it, citing the numbers (999, 109 for violence against women and children, 1098 child helpline).
4. Record the decision in the moderation queue (reason required).

## Honest limits

- The system is not an emergency service and says so. Nobody is guaranteed to read a report in time.
- Rules favour false alarms over misses, so some ordinary posts show the notice. They are not blocked.
- Coverage is limited to the phrases in `src/lib/emergency.ts`; unusual wording is missed. Extend the list from real, reviewed cases only.
- **The Bangla and English wording, and the helpline numbers, are drafts. A native speaker and the team must approve them, and the numbers must be re-checked against official sources, before any real user sees them.** Counsel should confirm what duty the service takes on.
