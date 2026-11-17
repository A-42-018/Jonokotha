-- Phase 2.15 (masterplan §5, §14, §18): administration.
--   * invitations: office staff join by invitation; MP accounts are linked by an administrator to a VERIFIED representative
--   * verification of representatives (official source required) and their profile fields
--   * moderation: reports from users, a queue for moderators with required reasons, publication review for ideas and public
--     questions; every action is audited and moderators never read private data
--   * AI evaluation results, constituency boundary import
-- Requires 0004-0019.

-- Invitations ---------------------------------------------------------------------------------------------------------
create table if not exists office_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  constituency_id uuid not null references constituencies on delete cascade,
  office_role text not null check (office_role in ('case_officer','office_manager','mp','agency_liaison')),
  representative_id uuid references representatives on delete set null,
  invited_by uuid references profiles on delete set null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references profiles on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (office_role <> 'mp' or representative_id is not null)
);
create index if not exists office_invitations_constituency_idx on office_invitations (constituency_id, status);
alter table office_invitations enable row level security;
drop policy if exists office_invitations_select on office_invitations;
create policy office_invitations_select on office_invitations for select using (is_admin() or office_can(constituency_id, 'assign', null));
revoke all on office_invitations from anon, authenticated;
grant select (id, email, constituency_id, office_role, status, expires_at, created_at, accepted_at) on office_invitations to authenticated;

-- Admins invite anyone; an office manager invites case officers and agency liaisons into their OWN office. MPs need a verified representative.
create or replace function create_office_invitation(p_email text, p_constituency text, p_role text, p_representative uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; tok text := encode(extensions.gen_random_bytes(24), 'hex'); v office_invitations%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if is_admin() then null;
  elsif office_can(c.id, 'assign', null) and p_role in ('case_officer', 'agency_liaison') then null;
  else
    if office_can(c.id, 'view', null) then raise exception 'not allowed' using errcode = '42501'; end if;
    raise exception 'area not found' using errcode = 'JK404';
  end if;
  if p_role = 'mp' and not exists (select 1 from representatives r join representative_constituencies rc on rc.representative_id = r.id
      where r.id = p_representative and r.verification_status = 'verified' and rc.constituency_id = c.id) then
    raise exception 'an MP invitation needs a verified representative of this area' using errcode = 'JK002', detail = 'representative';
  end if;
  if exists (select 1 from office_invitations where lower(email) = lower(p_email) and constituency_id = c.id and status = 'pending' and expires_at > now()) then
    raise exception 'an invitation is already pending' using errcode = 'JK003', detail = 'already_invited';
  end if;
  insert into office_invitations (email, constituency_id, office_role, representative_id, invited_by, token_hash)
  values (btrim(p_email), c.id, p_role, case when p_role = 'mp' then p_representative end, auth.uid(), encode(extensions.digest(tok, 'sha256'), 'hex')) returning * into v;
  perform audit_write('invitation.create', 'office_invitation', v.id::text, null, jsonb_build_object('role', p_role, 'constituency', p_constituency), jsonb_build_object('email_domain', split_part(lower(p_email), '@', 2)));
  return jsonb_build_object('id', v.id, 'token', tok, 'expires_at', v.expires_at);   -- the token is shown once; only its hash is stored
exception when check_violation then raise exception 'invalid invitation' using errcode = 'JK002', detail = 'email';
end $$;

create or replace function revoke_office_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v office_invitations%rowtype;
begin
  select * into v from office_invitations where id = p_id and status = 'pending';
  if not found or not (is_admin() or office_can(v.constituency_id, 'assign', null)) then raise exception 'invitation not found' using errcode = 'JK404'; end if;
  update office_invitations set status = 'revoked' where id = p_id;
  perform audit_write('invitation.revoke', 'office_invitation', p_id::text, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'revoked'));
end $$;

-- Lets profiles_guard allow exactly one platform-role change: a citizen who accepted an invitation seconds ago becomes staff.
create or replace function invitation_just_accepted(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from office_invitations where accepted_by = p_user and status = 'accepted' and accepted_at > now() - interval '1 minute') $$;
revoke all on function invitation_just_accepted(uuid) from public, anon, authenticated;
create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.account_status is distinct from old.account_status)
     and auth.uid() is not null and not is_admin()
     and not (old.role = 'citizen' and new.role = 'staff' and new.account_status = old.account_status and new.id = auth.uid() and invitation_just_accepted(new.id)) then
    raise exception 'role and account status can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end $$;

-- Accepting needs the token AND the signed-in account's confirmed email to match the invited address.
create or replace function accept_office_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v office_invitations%rowtype; uid uuid := auth.uid(); mail text; r text;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into v from office_invitations where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v.status <> 'pending' or v.expires_at <= now() then raise exception 'invitation not valid' using errcode = 'JK404'; end if;
  select email into mail from auth.users where id = uid and email_confirmed_at is not null;
  if mail is null or lower(mail) <> lower(v.email) then raise exception 'this invitation was sent to a different email address' using errcode = '42501'; end if;
  select role into r from profiles where id = uid;
  if r not in ('citizen', 'staff') then raise exception 'this account cannot join an office' using errcode = '42501'; end if;
  update office_invitations set status = 'accepted', accepted_by = uid, accepted_at = now() where id = v.id;
  if r = 'citizen' then update profiles set role = 'staff' where id = uid; end if;
  insert into office_members (user_id, representative_id, constituency_id, office_role, status, invited_by)
  values (uid, v.representative_id, v.constituency_id, v.office_role, 'active', v.invited_by)
  on conflict (user_id, constituency_id) do update set office_role = excluded.office_role, representative_id = excluded.representative_id, status = 'active';
  perform audit_write('invitation.accept', 'office_invitation', v.id::text, null, jsonb_build_object('role', v.office_role), jsonb_build_object('constituency_id', v.constituency_id));
  return jsonb_build_object('office_role', v.office_role, 'constituency_id', v.constituency_id);
end $$;
revoke all on function create_office_invitation(text, text, text, uuid), revoke_office_invitation(uuid), accept_office_invitation(text) from public, anon;
grant execute on function create_office_invitation(text, text, text, uuid), revoke_office_invitation(uuid), accept_office_invitation(text) to authenticated;

-- Verification of representatives -----------------------------------------------------------------------------------------
create or replace function verify_representative(p_rep uuid, p_status text, p_source_url text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r representatives%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into r from representatives where id = p_rep;
  if not found then raise exception 'representative not found' using errcode = 'JK404'; end if;
  if p_status not in ('pending', 'verified', 'revoked') then raise exception 'status' using errcode = 'JK002', detail = 'status'; end if;
  if p_status = 'verified' and (p_source_url is null or p_source_url !~ '^https?://') then raise exception 'verification needs an official source link' using errcode = 'JK002', detail = 'source_url'; end if;
  update representatives set verification_status = p_status, source_url = coalesce(p_source_url, source_url), verified_at = case when p_status = 'verified' then now() else verified_at end where id = p_rep;
  perform audit_write('representative.' || p_status, 'representative', p_rep::text, jsonb_build_object('status', r.verification_status), jsonb_build_object('status', p_status), jsonb_build_object('source_url', p_source_url, 'note', left(p_note, 300)));
  return jsonb_build_object('id', p_rep, 'verification_status', p_status);
end $$;

create or replace function set_representative_field(p_rep uuid, p_field text, p_value text, p_source text, p_checked date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if not exists (select 1 from representatives where id = p_rep) then raise exception 'representative not found' using errcode = 'JK404'; end if;
  if p_source is null or p_source !~ '^https?://' or p_checked is null then raise exception 'a field needs a source link and the date it was checked' using errcode = 'JK002', detail = 'source_url'; end if;
  insert into representative_fields (representative_id, field, value, source_url, source_checked_at) values (p_rep, p_field, btrim(p_value), p_source, p_checked)
  on conflict (representative_id, field) do update set value = excluded.value, source_url = excluded.source_url, source_checked_at = excluded.source_checked_at;
  perform audit_write('representative.field', 'representative', p_rep::text, null, jsonb_build_object('field', p_field), jsonb_build_object('source_url', p_source));
exception when check_violation then raise exception 'invalid field' using errcode = 'JK002', detail = 'field';
end $$;

create or replace function admin_set_account(p_user uuid, p_role text, p_status text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o profiles%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into o from profiles where id = p_user;
  if not found then raise exception 'account not found' using errcode = 'JK404'; end if;
  if p_role not in ('citizen','staff','moderator','admin') or p_status not in ('active','suspended') then raise exception 'role or status' using errcode = 'JK002', detail = 'role'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is required' using errcode = 'JK002', detail = 'reason'; end if;
  if p_user = auth.uid() and (p_role <> o.role or p_status <> 'active') then raise exception 'you cannot change your own role or status' using errcode = 'JK003', detail = 'self'; end if;
  update profiles set role = p_role, account_status = p_status where id = p_user;
  perform audit_write('account.change', 'profile', p_user::text, jsonb_build_object('role', o.role, 'status', o.account_status), jsonb_build_object('role', p_role, 'status', p_status), jsonb_build_object('reason', left(p_reason, 300)));
  return jsonb_build_object('id', p_user, 'role', p_role, 'account_status', p_status);
end $$;
revoke all on function verify_representative(uuid, text, text, text), set_representative_field(uuid, text, text, text, date), admin_set_account(uuid, text, text, text) from public, anon;
grant execute on function verify_representative(uuid, text, text, text), set_representative_field(uuid, text, text, text, date), admin_set_account(uuid, text, text, text) to authenticated;

-- Moderation ---------------------------------------------------------------------------------------------------------------
create table if not exists moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles on delete cascade,
  target_type text not null check (target_type in ('issue','idea','question','media')),
  target_ref text not null check (char_length(target_ref) between 3 and 80),
  reason_code text not null check (reason_code in ('abuse','personal_data','spam','false_information','unsafe','other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  handled_by uuid references profiles on delete set null,
  handled_at timestamptz,
  decision text check (decision in ('hide','restore','dismiss')),
  decision_reason text check (decision_reason is null or char_length(decision_reason) between 5 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_ref)
);
create index if not exists moderation_reports_queue_idx on moderation_reports (status, created_at);
alter table moderation_reports enable row level security;
drop policy if exists moderation_reports_select on moderation_reports;
create policy moderation_reports_select on moderation_reports for select using (reporter_id = auth.uid() or is_moderator() or is_admin());
revoke all on moderation_reports from anon, authenticated;
grant select on moderation_reports to authenticated;

-- Anyone with a verified account can report PUBLIC content (one report per person and item; 10 per day).
create or replace function report_content(p_type text, p_ref text, p_reason text, p_details text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ok boolean; v moderation_reports%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  if (select count(*) from moderation_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily report limit reached' using errcode = 'JK003', detail = 'report_limit';
  end if;
  ok := case p_type
    when 'issue' then exists (select 1 from issues where ref = p_ref and public_visibility)
    when 'idea' then exists (select 1 from ideas where ref = p_ref and status in ('published','under_consideration','planned','declined'))
    when 'question' then exists (select 1 from questions where ref = p_ref and visibility = 'public' and status in ('open','answered','closed'))
    when 'media' then exists (select 1 from issue_media m join issues i on i.id = m.issue_id where m.id::text = p_ref and m.visibility = 'public' and m.moderation_status = 'approved' and i.public_visibility)
    else false end;
  if not ok then raise exception 'content not found' using errcode = 'JK404'; end if;
  insert into moderation_reports (reporter_id, target_type, target_ref, reason_code, details) values (uid, p_type, p_ref, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (reporter_id, target_type, target_ref) do nothing returning * into v;
  if v.id is null then raise exception 'you already reported this' using errcode = 'JK003', detail = 'already_reported'; end if;
  return jsonb_build_object('id', v.id, 'status', 'open');
exception when check_violation then raise exception 'invalid reason' using errcode = 'JK002', detail = 'reason';
end $$;

-- The moderator's queue: open reports grouped by item, plus items waiting for publication review. Only PUBLIC content is shown, as a
-- short excerpt; no reporter identity, no private issue data, no author identity.
create or replace function moderation_queue(p_limit integer default 50) returns table (kind text, target_type text, target_ref text, excerpt text, reasons text[], report_count integer, oldest timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_moderator() or is_admin()) then raise exception 'moderators only' using errcode = '42501'; end if;
  return query
  select * from (
    select 'report'::text, r.target_type, r.target_ref,
           left(case r.target_type
             when 'issue' then (select i.title || ': ' || i.description from issues i where i.ref = r.target_ref)
             when 'idea' then (select x.title || ': ' || x.body from ideas x where x.ref = r.target_ref)
             when 'question' then (select q.title || ': ' || q.body from questions q where q.ref = r.target_ref and q.visibility = 'public')
             when 'media' then (select coalesce(m.caption, '(photo)') from issue_media m where m.id::text = r.target_ref and m.visibility = 'public') end, 240),
           array_agg(distinct r.reason_code), count(*)::int, min(r.created_at)
    from moderation_reports r where r.status = 'open' group by r.target_type, r.target_ref
    union all
    select 'review', 'idea', x.ref, left(x.title || ': ' || x.body, 240), array[]::text[], 0, x.created_at from ideas x where x.status = 'pending_review'
    union all
    select 'review', 'question', q.ref, left(q.title || ': ' || q.body, 240), array[]::text[], 0, q.created_at from questions q where q.status = 'pending_review' and q.visibility = 'public'
  ) u order by 7 limit least(greatest(p_limit, 1), 100);
end $$;

-- Acting on a reported item. A reason is always required and is stored and audited. hide / restore / dismiss.
create or replace function moderate_item(p_type text, p_ref text, p_action text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (is_moderator() or is_admin()) then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('hide', 'restore', 'dismiss') then raise exception 'action' using errcode = 'JK002', detail = 'action'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is required' using errcode = 'JK002', detail = 'reason'; end if;
  n := 0;
  if p_action = 'hide' then
    if p_type = 'issue' then update issues set public_visibility = false where ref = p_ref and public_visibility;
    elsif p_type = 'idea' then update ideas set status = 'hidden', moderation_reason = btrim(p_reason), updated_at = now() where ref = p_ref and status <> 'hidden';
    elsif p_type = 'question' then update questions set status = 'hidden', moderation_reason = btrim(p_reason), updated_at = now() where ref = p_ref and visibility = 'public' and status <> 'hidden';
    elsif p_type = 'media' then update issue_media set visibility = 'private', moderation_status = 'rejected' where id::text = p_ref and visibility = 'public';
    end if;
    get diagnostics n = row_count;
  elsif p_action = 'restore' then
    if p_type = 'issue' then update issues set public_visibility = true where ref = p_ref and not public_visibility;
    elsif p_type = 'idea' then update ideas set status = 'published', moderation_reason = null, updated_at = now() where ref = p_ref and status = 'hidden';
    elsif p_type = 'question' then update questions set status = 'open', moderation_reason = null, updated_at = now() where ref = p_ref and visibility = 'public' and status = 'hidden';
    end if;
    get diagnostics n = row_count;
  else n := 1; end if;
  if n = 0 then raise exception 'nothing to change' using errcode = 'JK404'; end if;
  update moderation_reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, handled_by = auth.uid(), handled_at = now(), decision = p_action, decision_reason = btrim(p_reason)
   where target_type = p_type and target_ref = p_ref and status = 'open';
  perform audit_write('moderation.' || p_action, p_type, p_ref, null, null, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('target_type', p_type, 'target_ref', p_ref, 'action', p_action);
end $$;

-- Publication review of new ideas and public questions (publish, or reject with a reason).
create or replace function review_pending(p_type text, p_ref text, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (is_moderator() or is_admin()) then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('publish', 'reject') then raise exception 'action' using errcode = 'JK002', detail = 'action'; end if;
  if p_action = 'reject' and char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is required' using errcode = 'JK002', detail = 'reason'; end if;
  n := 0;
  if p_type = 'idea' then
    update ideas set status = case when p_action = 'publish' then 'published' else 'hidden' end, moderation_reason = case when p_action = 'reject' then btrim(p_reason) end, updated_at = now() where ref = p_ref and status = 'pending_review';
    get diagnostics n = row_count;
  elsif p_type = 'question' then
    update questions set status = case when p_action = 'publish' then 'open' else 'hidden' end, moderation_reason = case when p_action = 'reject' then btrim(p_reason) end, updated_at = now() where ref = p_ref and visibility = 'public' and status = 'pending_review';
    get diagnostics n = row_count;
  end if;
  if n = 0 then raise exception 'nothing waiting for review' using errcode = 'JK404'; end if;
  perform audit_write('moderation.' || p_action, p_type, p_ref, jsonb_build_object('status', 'pending_review'), null, jsonb_build_object('reason', left(btrim(coalesce(p_reason, '')), 300)));
  return jsonb_build_object('target_type', p_type, 'target_ref', p_ref, 'action', p_action);
end $$;
revoke all on function report_content(text, text, text, text), moderation_queue(integer), moderate_item(text, text, text, text), review_pending(text, text, text, text) from public, anon;
grant execute on function report_content(text, text, text, text), moderation_queue(integer), moderate_item(text, text, text, text), review_pending(text, text, text, text) to authenticated;

-- AI evaluation results (recorded by an administrator after `npm run eval`) -----------------------------------------------------
create table if not exists ai_eval_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null check (char_length(dataset_name) between 2 and 80),
  dataset_size integer not null check (dataset_size > 0),
  model text,
  prompt_versions jsonb not null default '{}',
  metrics jsonb not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table ai_eval_runs enable row level security;
drop policy if exists ai_eval_runs_admin on ai_eval_runs;
create policy ai_eval_runs_admin on ai_eval_runs for select using (is_admin());
revoke all on ai_eval_runs from anon, authenticated;
grant select on ai_eval_runs to authenticated;
create or replace function record_ai_eval(p_dataset text, p_size integer, p_model text, p_prompts jsonb, p_metrics jsonb, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into ai_eval_runs (dataset_name, dataset_size, model, prompt_versions, metrics, notes, created_by) values (p_dataset, p_size, p_model, coalesce(p_prompts, '{}'), p_metrics, p_notes, auth.uid()) returning id into rid;
  perform audit_write('ai_eval.record', 'ai_eval_run', rid::text, null, null, jsonb_build_object('dataset', p_dataset, 'size', p_size));
  return rid;
exception when check_violation then raise exception 'invalid evaluation record' using errcode = 'JK002', detail = 'metrics';
end $$;
revoke all on function record_ai_eval(text, integer, text, jsonb, jsonb, text) from public, anon;
grant execute on function record_ai_eval(text, integer, text, jsonb, jsonb, text) to authenticated;

-- Constituency import (boundaries from a verified file, e.g. HDX administrative boundaries) -------------------------------------
-- p_source: {name, url, license, fetched_at}; p_items: [{key,name_bn,name_en,district,upazila_or_city,boundary,min_lat,max_lat,min_lng,max_lng}]. One transaction; max 100.
create or replace function import_constituencies(p_source jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid; it jsonb; n integer := 0;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'items' using errcode = 'JK002', detail = 'items'; end if;
  if coalesce(p_source ->> 'name', '') = '' or coalesce(p_source ->> 'url', '') !~ '^https?://' or coalesce(p_source ->> 'license', '') = '' or coalesce(p_source ->> 'fetched_at', '') = '' then
    raise exception 'the import needs the source name, link, licence and fetch date' using errcode = 'JK002', detail = 'source';
  end if;
  insert into knowledge_sources (name, url, license_or_terms, collection_method, fetched_at, is_demo) values (p_source ->> 'name', p_source ->> 'url', p_source ->> 'license', 'file', (p_source ->> 'fetched_at')::timestamptz, false) returning id into sid;
  for it in select * from jsonb_array_elements(p_items) loop
    if not (valid_bd_point((it ->> 'min_lat')::float8, (it ->> 'min_lng')::float8) and valid_bd_point((it ->> 'max_lat')::float8, (it ->> 'max_lng')::float8))
       or (it ->> 'min_lat')::float8 >= (it ->> 'max_lat')::float8 or (it ->> 'min_lng')::float8 >= (it ->> 'max_lng')::float8 or it ->> 'key' !~ '^[a-z0-9-]{2,60}$' then
      raise exception 'invalid boundary or key for %', coalesce(it ->> 'key', '?') using errcode = 'JK002', detail = 'items';
    end if;
    insert into constituencies (key, name_bn, name_en, district, upazila_or_city, boundary, boundary_source_id, boundary_source, boundary_verified_at, min_lat, max_lat, min_lng, max_lng, is_demo, is_active)
    values (it ->> 'key', it ->> 'name_bn', it ->> 'name_en', it ->> 'district', it ->> 'upazila_or_city', it -> 'boundary', sid, p_source ->> 'name', now(),
            (it ->> 'min_lat')::float8, (it ->> 'max_lat')::float8, (it ->> 'min_lng')::float8, (it ->> 'max_lng')::float8, false, true)
    on conflict (key) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, district = excluded.district, upazila_or_city = excluded.upazila_or_city, boundary = excluded.boundary,
      boundary_source_id = sid, boundary_source = excluded.boundary_source, boundary_verified_at = now(), min_lat = excluded.min_lat, max_lat = excluded.max_lat, min_lng = excluded.min_lng, max_lng = excluded.max_lng;
    n := n + 1;
  end loop;
  perform audit_write('constituency.import', 'knowledge_source', sid::text, null, jsonb_build_object('count', n), jsonb_build_object('source', p_source ->> 'name'));
  return jsonb_build_object('source_id', sid, 'imported', n);
exception when check_violation or invalid_text_representation or datetime_field_overflow then raise exception 'invalid import data' using errcode = 'JK002', detail = 'items';
end $$;
revoke all on function import_constituencies(jsonb, jsonb) from public, anon;
grant execute on function import_constituencies(jsonb, jsonb) to authenticated;
