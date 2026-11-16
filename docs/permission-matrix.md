# Roles, scopes and permission matrix

Source: masterplan §5 and §14. Implemented in migration `0006_roles_scopes.sql` and `src/lib/auth.ts`.
The database is the authority (functions `office_can`, `office_scope`, RLS in step 3); the TypeScript copy only gives clean 403s, and `tests/db/roles.test.ts` fails if the two ever differ.

## Two layers

| Layer | Where | Values |
|---|---|---|
| Platform role | `profiles.role` | `citizen`, `staff`, `moderator`, `admin` |
| Office role (per constituency) | `office_members.office_role` | `case_officer`, `office_manager`, `mp`, `agency_liaison` |

- Only a `staff` account can hold an active office membership (trigger `office_members_guard`).
- A user's role is never taken from a request. Platform role and account status change only from the SQL editor, the service role or an admin (trigger `profiles_guard`); nobody changes them through the API.
- Staff with no active membership have no office access at all. The legacy single `staff` role was backfilled as `office_manager` of the demo constituency only.
- Admin acts in every constituency, but only with MFA once enforced, and every privileged admin action is audited (step 6).
- Moderators have no office permissions; their access is limited to moderation queues (RLS, step 3).

## Office permissions (`office_permissions` table)

"Assigned" means the action is allowed only on issues assigned to the actor.

| Action | Office manager | MP | Case officer | Agency liaison |
|---|---|---|---|---|
| view | yes | yes | assigned | assigned |
| acknowledge | yes | | | |
| assign | yes | | | |
| request_information | yes | | assigned | |
| forward | yes | | | |
| update (progress, internal notes) | yes | | assigned | assigned |
| resolve | yes | | | |
| close | yes | | | |
| view_analytics | yes | yes | | |

Case officers recommend forwarding or resolution; the office manager performs it (§5.4). The MP views, sees analytics and (Phase 2) publishes announcements; the MP does not change case status. Changing this table is a migration plus an edit to `OFFICE_PERMISSIONS`, never an ad-hoc SQL update.

## MFA plan (§14: MP, moderator and admin)

- Enforcement is built: `mfa_required()` is true for moderators, admins and anyone with an active `mp` membership; `mfa_ok()` requires a Supabase TOTP session (`aal2` in the JWT) when `app_settings.enforce_mfa` is `true`. `office_can`, `office_scope`, `is_admin` and `is_moderator` all call it, so with the flag on an `aal1` session loses every elevated permission.
- The flag is `false` for now because the sign-in UI cannot yet enrol or challenge TOTP (frontend work: `supabase.auth.mfa.enroll/challenge/verify`). Dev sign-in uses demo accounts, which are not MP, moderator or admin.
- Before real MP, moderator or admin accounts exist: enable TOTP in Supabase Auth settings, ship the enrol/challenge screens, create the accounts, then set the flag with `update app_settings set value = 'true' where key = 'enforce_mfa';`. This is a Phase 3 security-review gate at the latest.
- Hosted Supabase may require the Pro plan for some MFA settings; confirm before relying on it.

## Still to come in this document
The full table-by-table RLS matrix (citizen A/B, office A/B, moderator, admin) is added with the RLS suite in step 3.
