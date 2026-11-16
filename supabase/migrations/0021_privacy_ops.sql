-- Phase 3: privacy (export, correction, deletion, retention), consent records, operational health (backend plan 3.7, 3.4, 3.6).

-- Deletion requests: the person asks; the sweep erases after a grace period (they can cancel until then).
create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'cancelled', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists deletion_requests_one_open on deletion_requests (user_id) where status = 'requested';
alter table deletion_requests enable row level security;
drop policy if exists deletion_requests_own_select on deletion_requests;
create policy deletion_requests_own_select on deletion_requests for select using (user_id = auth.uid());
revoke all on deletion_requests from anon, authenticated;
grant select on deletion_requests to authenticated;

create or replace function request_account_deletion() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r deletion_requests; n int;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  insert into deletion_requests (user_id) values (uid) on conflict (user_id) where status = 'requested' do nothing;
  get diagnostics n = row_count;
  select * into r from deletion_requests where user_id = uid and status = 'requested';
  if n > 0 then perform audit_write('privacy.deletion_requested', 'profile', uid::text, null, jsonb_build_object('request_id', r.id), '{}'); end if;
  return jsonb_build_object('status', r.status, 'requested_at', r.requested_at, 'erased_after', r.requested_at + interval '14 days');
end $$;

create or replace function cancel_account_deletion() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  update deletion_requests set status = 'cancelled' where user_id = uid and status = 'requested';
  get diagnostics n = row_count;
  if n > 0 then perform audit_write('privacy.deletion_cancelled', 'profile', uid::text, null, null, '{}'); end if;
  return jsonb_build_object('cancelled', n > 0);
end $$;

-- Correction: the only profile fields a person edits themselves.
create or replace function update_my_profile(p_display_name text default null, p_language text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b profiles; a profiles;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_language is not null and p_language not in ('bn', 'en') then raise exception 'language must be bn or en' using errcode = '22023'; end if;
  if p_display_name is not null and char_length(btrim(p_display_name)) not between 1 and 80 then raise exception 'display name must be 1 to 80 characters' using errcode = '22023'; end if;
  select * into b from profiles where id = uid and account_status = 'active';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  update profiles set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name), preferred_language = coalesce(p_language, preferred_language), updated_at = now()
   where id = uid returning * into a;
  perform audit_write('privacy.profile_corrected', 'profile', uid::text, jsonb_build_object('display_name', b.display_name, 'preferred_language', b.preferred_language),
                      jsonb_build_object('display_name', a.display_name, 'preferred_language', a.preferred_language), '{}');
  return jsonb_build_object('display_name', a.display_name, 'preferred_language', a.preferred_language);
end $$;

-- Consent records: one open row per type; granting again after withdrawal adds a new row.
create or replace function record_consent(p_type text, p_version text, p_granted boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_type !~ '^[a-z_]{3,40}$' or p_version !~ '^[A-Za-z0-9._-]{1,20}$' then raise exception 'invalid consent' using errcode = '22023'; end if;
  if p_granted then
    if not exists (select 1 from consents where user_id = uid and consent_type = p_type and withdrawn_at is null) then
      insert into consents (user_id, consent_type, policy_version) values (uid, p_type, p_version);
    end if;
  else
    update consents set withdrawn_at = now() where user_id = uid and consent_type = p_type and withdrawn_at is null;
  end if;
  perform audit_write(case when p_granted then 'privacy.consent_granted' else 'privacy.consent_withdrawn' end, 'consent', uid::text, null, jsonb_build_object('type', p_type, 'version', p_version), '{}');
  return jsonb_build_object('type', p_type, 'granted', p_granted);
end $$;

-- Export: everything the person gave or caused, as one JSON document. Internal notes, staff data and other people's data are not included.
create or replace function export_my_data() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); out jsonb;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'role' from (select id, display_name, preferred_language, created_at, account_status from profiles where id = uid) p),
    'preferences', (select to_jsonb(u) from user_preferences u where u.user_id = uid),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) order by c.granted_at) from (select consent_type, policy_version, granted_at, withdrawn_at from consents where user_id = uid) c), '[]'),
    'issues', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from (select ref, title, category, description, area, status, created_at, lat, lng, resolution_note from issues where reporter_id = uid) i), '[]'),
    'issue_feedback', coalesce((select jsonb_agg(to_jsonb(f)) from (select issue_id, rating, comment, created_at from issue_feedback where user_id = uid) f), '[]'),
    'affected', coalesce((select jsonb_agg(to_jsonb(a)) from (select issue_id, created_at from issue_affected where user_id = uid) a), '[]'),
    'follows', coalesce((select jsonb_agg(to_jsonb(f)) from (select target_type, issue_id, constituency_id, category, created_at from follows where user_id = uid) f), '[]'),
    'ideas', coalesce((select jsonb_agg(to_jsonb(d)) from (select ref, title, body, category, status, created_at from ideas where author_id = uid) d), '[]'),
    'questions', coalesce((select jsonb_agg(to_jsonb(q)) from (select ref, title, body, visibility, status, created_at from questions where asker_id = uid) q), '[]'),
    'question_messages', coalesce((select jsonb_agg(to_jsonb(m)) from (select question_id, body, created_at from question_messages where author_id = uid) m), '[]'),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n)) from (select type, title, body, created_at, read_at from notifications where user_id = uid order by created_at desc limit 500) n), '[]'),
    'deletion_requests', coalesce((select jsonb_agg(to_jsonb(r)) from (select status, requested_at, completed_at from deletion_requests where user_id = uid) r), '[]')
  ) into out;
  perform audit_write('privacy.export', 'profile', uid::text, null, null, '{}');
  return out;
end $$;

-- Erasure (service role only). Keeps the public civic record and the audit trail; removes what identifies the person.
-- Returns the storage paths of their photos so the caller can delete the files.
create or replace function erase_user_data(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare paths text[]; n_issues int;
begin
  if not exists (select 1 from profiles where id = p_user) then return jsonb_build_object('erased', false); end if;
  select coalesce(array_agg(storage_path), '{}') into paths from issue_media where uploader_id = p_user;
  delete from issue_media where uploader_id = p_user;
  delete from push_subscriptions where user_id = p_user;
  delete from notification_deliveries where user_id = p_user;
  delete from notifications where user_id = p_user;
  delete from follows where user_id = p_user;
  delete from issue_affected where user_id = p_user;
  delete from user_preferences where user_id = p_user;
  delete from idempotency_keys where user_id = p_user;
  update consents set withdrawn_at = coalesce(withdrawn_at, now()) where user_id = p_user;
  update issue_feedback set comment = null where user_id = p_user;
  update issues set lat = null, lng = null where reporter_id = p_user;
  get diagnostics n_issues = row_count;
  update ideas set body = '[removed by the author]', title = '[removed]' where author_id = p_user;
  update questions set body = '[removed by the author]', title = '[removed]' where asker_id = p_user;
  update question_messages set body = '[removed by the author]' where author_id = p_user;
  update profiles set display_name = 'Deleted user', avatar_path = null, account_status = 'deleted', updated_at = now() where id = p_user;
  update deletion_requests set status = 'completed', completed_at = now() where user_id = p_user and status = 'requested';
  perform audit_write('privacy.erased', 'profile', p_user::text, null, jsonb_build_object('issues_kept', n_issues, 'photos_removed', coalesce(array_length(paths, 1), 0)), '{}');
  return jsonb_build_object('erased', true, 'storage_paths', to_jsonb(paths));
end $$;
revoke all on function erase_user_data(uuid) from public, anon, authenticated;
grant execute on function erase_user_data(uuid) to service_role;

-- Retention sweep (service role only): expired rows, plus erasure of accounts whose 14-day deletion grace has passed.
create or replace function run_retention() returns jsonb language plpgsql security definer set search_path = public as $$
declare n_idem int; n_rl int; n_notif int; n_deliv int; n_ai int; u record; erased int := 0; paths jsonb := '[]';
begin
  delete from idempotency_keys where expires_at < now(); get diagnostics n_idem = row_count;
  delete from rate_limits where window_start < now() - interval '1 day'; get diagnostics n_rl = row_count;
  delete from notifications where retention_until is not null and retention_until < now(); get diagnostics n_notif = row_count;
  delete from notification_deliveries where status in ('sent', 'skipped', 'dead') and created_at < now() - interval '90 days'; get diagnostics n_deliv = row_count;
  delete from ai_runs where retention_until is not null and retention_until < now(); get diagnostics n_ai = row_count;
  for u in select user_id from deletion_requests where status = 'requested' and requested_at < now() - interval '14 days' loop
    paths := paths || coalesce(erase_user_data(u.user_id) -> 'storage_paths', '[]');
    erased := erased + 1;
  end loop;
  perform audit_write('privacy.retention_run', 'system', 'retention', null,
    jsonb_build_object('idempotency_keys', n_idem, 'rate_limits', n_rl, 'notifications', n_notif, 'deliveries', n_deliv, 'ai_runs', n_ai, 'accounts_erased', erased), '{}');
  return jsonb_build_object('idempotency_keys', n_idem, 'rate_limits', n_rl, 'notifications', n_notif, 'deliveries', n_deliv, 'ai_runs', n_ai, 'accounts_erased', erased, 'storage_paths', paths);
end $$;
revoke all on function run_retention() from public, anon, authenticated;
grant execute on function run_retention() to service_role;

revoke all on function request_account_deletion(), cancel_account_deletion(), export_my_data() from public, anon;
grant execute on function request_account_deletion(), cancel_account_deletion(), export_my_data() to authenticated;
revoke all on function update_my_profile(text, text), record_consent(text, text, boolean) from public, anon;
grant execute on function update_my_profile(text, text), record_consent(text, text, boolean) to authenticated;

-- Operations health (service role only): queue and AI failure signals for monitoring (backend plan 3.4).
create or replace function ops_health() returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'checked_at', now(),
    'deliveries_pending', (select count(*) from notification_deliveries where status in ('pending', 'failed') and next_attempt_at <= now() - interval '10 minutes'),
    'deliveries_dead', (select count(*) from notification_deliveries where status = 'dead' and created_at > now() - interval '24 hours'),
    'ai_runs_24h', (select count(*) from ai_runs where created_at > now() - interval '24 hours'),
    'ai_errors_24h', (select count(*) from ai_runs where created_at > now() - interval '24 hours' and status <> 'ok'),
    'open_deletion_requests', (select count(*) from deletion_requests where status = 'requested'));
$$;
revoke all on function ops_health() from public, anon, authenticated;
grant execute on function ops_health() to service_role;

-- Imminent-harm flag (backend plan M.8): the author's own issue or question goes into the moderators' queue as "unsafe",
-- marked as automatic. Self-report only; one row per person and item. Rules detect the language; nothing here is an AI reply.
create or replace function flag_emergency(p_type text, p_ref text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mine boolean;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  mine := case p_type when 'issue' then exists (select 1 from issues where ref = p_ref and reporter_id = uid)
                      when 'question' then exists (select 1 from questions where ref = p_ref and asker_id = uid) else false end;
  if not mine then raise exception 'not found' using errcode = 'P0002'; end if;
  insert into moderation_reports (reporter_id, target_type, target_ref, reason_code, details)
  values (uid, p_type, p_ref, 'unsafe', 'auto: imminent-harm language detected; review for safety first')
  on conflict (reporter_id, target_type, target_ref) do nothing;
end $$;
revoke all on function flag_emergency(text, text) from public, anon;
grant execute on function flag_emergency(text, text) to authenticated;
