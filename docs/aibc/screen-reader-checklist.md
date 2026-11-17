# Screen-reader pass: checklist for a person with a phone (task 3.1, not yet done)

A TalkBack (Android, Chrome) and VoiceOver (iPhone, Safari) pass needs a real device and a real voice, so it has not been run. Everything that can be checked by machine is done and recorded in `phase3-audit.md`. Use the staging URL, Bangla first, then English. Signed-in screens can be reached without an account at `/dev/screens/<name>` only on a server started with `JK_AUDIT=1`; on staging, sign in with a test account instead.

For each flow write what was announced and anything confusing or missing.

## 1. Report a problem (`/report`)
- [ ] Page title and "Step 1 of 5" are announced when the page opens.
- [ ] The category tiles read as one group with the question as its label; each says its name and whether it is selected.
- [ ] After "Draft" the screen reader says drafting is in progress, then that the draft is ready; AI-filled fields are announced as "AI suggestion".
- [ ] "Next" moves focus to the new step's heading; the step number is announced.
- [ ] A missing field: the error is read, and focus goes to the field.
- [ ] The photo step: warning text is read before the picker; added photos have a name; remove buttons say which photo.
- [ ] Review step: each row can be edited, and says which field.
- [ ] Offline: turn on airplane mode, submit; "saved on this phone" is announced.
- [ ] Success screen: reference number is read digit by digit and can be copied.

## 2. Issue detail (`/issue/<ref>`)
- [ ] Headings in order (one h1, then sections); status is read as words, not only colour.
- [ ] Timeline reads as a list with dates in Bangla.
- [ ] "Follow" and "Me too" announce their state (pressed or not); the report-content dialog traps focus and returns it on close.

## 3. Office case (`/office/<ref>`, staff)
- [ ] The AI panel announces "staff only"; each suggestion's Accept, Edit and Dismiss say which suggestion they act on.
- [ ] The acknowledge dialog: the note field's rules are read; the error on an empty note is read; success is announced as a status message.
- [ ] Internal notes and the public reply are clearly different regions.

## Also
- [ ] Rotor or headings list on `/`, `/area`, `/ideas` is meaningful.
- [ ] The language switch announces the new language.
