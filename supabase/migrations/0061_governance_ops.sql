-- Phase 6 (B6.1, B6.3, B6.4, B6.7): pilot sites and cost tracking, retention policies and legal holds, service notices, penetration-test findings.

-- Retention policy register -----------------------------------------------------------------------------------------------------
-- One row per data class. `status` says whether code enforces the rule today ('enforced') or the figure is still a proposal for counsel.
create table if not exists retention_policies (
  data_class text primary key check (data_class ~ '^[a-z_]{3,40}$'),
  description text not null check (char_length(description) between 10 and 300),
  retain_days integer check (retain_days is null or retain_days between 1 and 36500),
  action text not null check (action in ('delete', 'anonymise', 'keep')),
  basis text not null check (char_length(basis) between 5 and 300),
  legal_hold_applies boolean not null default true,
  status text not null default 'proposed' check (status in ('enforced', 'proposed')),
  enforced_by text,
  owner_role text not null default 'data_protection_owner',
  counsel_reviewed boolean not null default false,
  reviewed_on date,
  updated_at timestamptz not null default now()
);
alter table retention_policies enable row level security;
drop policy if exists retention_policies_admin on retention_policies;
create policy retention_policies_admin on retention_policies for select using (is_admin());
revoke all on retention_policies from anon, authenticated;
grant select on retention_policies to authenticated;

-- Figures marked 'enforced' match what run_retention() does today (migration 0021); the rest are proposals, not promises.
insert into retention_policies (data_class, description, retain_days, action, basis, legal_hold_applies, status, enforced_by) values
  ('idempotency_keys', 'Request replay keys, so a retry does not repeat an action', 1, 'delete', 'Operational need only', false, 'enforced', 'run_retention'),
  ('rate_limits', 'Counters that slow down abuse', 1, 'delete', 'Operational need only', false, 'enforced', 'run_retention'),
  ('notification_deliveries', 'Delivery attempts for email, push and in-app messages', 90, 'delete', 'Debugging failed deliveries', false, 'enforced', 'run_retention'),
  ('notifications', 'In-app notifications to a person', null, 'delete', 'Each row carries its own expiry date', false, 'enforced', 'run_retention'),
  ('ai_runs', 'Logs of AI calls (redacted input hash, output, cost)', null, 'delete', 'Each row carries its own expiry date', true, 'enforced', 'run_retention'),
  ('account_after_deletion_request', 'A person''s account data after they ask for deletion (14-day grace to cancel)', 14, 'anonymise', 'The person''s request; the public civic record and audit trail are kept without identity', true, 'enforced', 'run_retention'),
  ('issue_public_record', 'The civic record of a report (category, area, status history) after the reporter leaves', null, 'keep', 'Public interest in a traceable record; reporter identity removed', true, 'proposed', null),
  ('audit_logs', 'Who did what to which record', 730, 'keep', 'Accountability; immutable. Counsel to confirm the period', true, 'proposed', null),
  ('eval_examples', 'Consented, redacted examples used to evaluate the AI', null, 'delete', 'Kept until the person withdraws consent or deletes the account', true, 'enforced', 'eval_candidates triggers'),
  ('ingestion_records', 'Staged records from public data sources (no personal data)', 365, 'delete', 'Lineage and review of public data', false, 'proposed', null),
  ('uploaded_photos', 'Photos attached to reports', null, 'delete', 'Removed with the account on erasure; period for open reports to be set with the pilot office', true, 'proposed', 'run_retention (erasure only)')
on conflict (data_class) do nothing;

-- Public, plain statement of how long each class is kept (and whether the rule is enforced yet).
create or replace view public_retention_policies with (security_invoker = false) as
  select data_class, description, retain_days, action, status, counsel_reviewed from retention_policies;
revoke all on public_retention_policies from public;
grant select on public_retention_policies to anon, authenticated;

-- Legal holds -------------------------------------------------------------------------------------------------------------------------
create table if not exists legal_holds (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'issue')),
  subject_id text not null check (char_length(subject_id) between 1 and 80),
  reason text not null check (char_length(reason) between 10 and 500),
  authority_ref text not null check (char_length(authority_ref) between 3 and 120),
  placed_by uuid references profiles on delete set null,
  placed_at timestamptz not null default now(),
  released_by uuid references profiles on delete set null,
  released_at timestamptz,
  release_reason text check (release_reason is null or char_length(release_reason) <= 300)
);
create unique index if not exists legal_holds_one_open on legal_holds (subject_type, subject_id) where released_at is null;
alter table legal_holds enable row level security;
drop policy if exists legal_holds_admin on legal_holds;
create policy legal_holds_admin on legal_holds for select using (is_admin());
revoke all on legal_holds from anon, authenticated;
grant select on legal_holds to authenticated;

-- True when erasing this account is blocked: a hold on the person, or on any report they filed.
create or replace function legal_hold_active(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from legal_holds h where h.released_at is null and (
           (h.subject_type = 'user' and h.subject_id = p_user::text)
        or (h.subject_type = 'issue' and h.subject_id in (select i.id::text from issues i where i.reporter_id = p_user)))) $$;
revoke all on function legal_hold_active(uuid) from public, anon, authenticated;
grant execute on function legal_hold_active(uuid) to service_role;

create or replace function place_legal_hold(p_type text, p_id text, p_reason text, p_authority text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h legal_holds;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_type = 'issue' then
    if not exists (select 1 from issues where ref = p_id or id::text = p_id) then raise exception 'issue not found' using errcode = 'JK404'; end if;
    p_id := (select id::text from issues where ref = p_id or id::text = p_id limit 1);
  elsif p_type = 'user' then
    if not exists (select 1 from profiles where id::text = p_id) then raise exception 'user not found' using errcode = 'JK404'; end if;
  end if;
  insert into legal_holds (subject_type, subject_id, reason, authority_ref, placed_by) values (p_type, p_id, p_reason, p_authority, auth.uid()) returning * into h;
  perform audit_write('legal_hold.placed', 'legal_hold', h.id::text, null, jsonb_build_object('subject_type', p_type, 'authority_ref', p_authority), '{}');
  return jsonb_build_object('id', h.id, 'subject_type', h.subject_type, 'placed_at', h.placed_at);
exception when unique_violation then raise exception 'already on hold' using errcode = 'JK003', detail = 'already_held';
          when check_violation then raise exception 'invalid hold' using errcode = 'JK002', detail = 'hold';
end $$;

create or replace function release_legal_hold(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h legal_holds;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if char_length(coalesce(p_reason, '')) < 5 then raise exception 'reason' using errcode = 'JK002', detail = 'reason'; end if;
  update legal_holds set released_at = now(), released_by = auth.uid(), release_reason = p_reason where id = p_id and released_at is null returning * into h;
  if not found then raise exception 'hold not found' using errcode = 'JK404'; end if;
  perform audit_write('legal_hold.released', 'legal_hold', h.id::text, null, jsonb_build_object('subject_type', h.subject_type), '{}');
  return jsonb_build_object('id', h.id, 'released_at', h.released_at);
end $$;

revoke all on function place_legal_hold(text, text, text, text), release_legal_hold(uuid, text) from public, anon;
grant execute on function place_legal_hold(text, text, text, text), release_legal_hold(uuid, text) to authenticated;

-- Erasure honours holds: keep the 0021 body as the unchecked version and put a guard in front. Guarded so the migration is repeatable.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'erase_user_data_unchecked') then
    alter function erase_user_data(uuid) rename to erase_user_data_unchecked;
  end if;
end $$;
revoke all on function erase_user_data_unchecked(uuid) from public, anon, authenticated, service_role;
create or replace function erase_user_data(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if legal_hold_active(p_user) then
    perform audit_write('privacy.erasure_blocked_by_hold', 'profile', p_user::text, null, null, '{}');
    return jsonb_build_object('erased', false, 'held', true);
  end if;
  return erase_user_data_unchecked(p_user);
end $$;
revoke all on function erase_user_data(uuid) from public, anon, authenticated;
grant execute on function erase_user_data(uuid) to service_role;

-- The sweep: same as 0021, plus a count of accounts left alone because of a hold.
create or replace function run_retention() returns jsonb language plpgsql security definer set search_path = public as $$
declare n_idem int; n_rl int; n_notif int; n_deliv int; n_ai int; u record; erased int := 0; held int := 0; paths jsonb := '[]'; r jsonb;
begin
  delete from idempotency_keys where expires_at < now(); get diagnostics n_idem = row_count;
  delete from rate_limits where window_start < now() - interval '1 day'; get diagnostics n_rl = row_count;
  delete from notifications where retention_until is not null and retention_until < now(); get diagnostics n_notif = row_count;
  delete from notification_deliveries where status in ('sent', 'skipped', 'dead') and created_at < now() - interval '90 days'; get diagnostics n_deliv = row_count;
  delete from ai_runs where retention_until is not null and retention_until < now(); get diagnostics n_ai = row_count;
  for u in select user_id from deletion_requests where status = 'requested' and requested_at < now() - interval '14 days' loop
    r := erase_user_data(u.user_id);
    if coalesce((r ->> 'held')::boolean, false) then held := held + 1;
    else paths := paths || coalesce(r -> 'storage_paths', '[]'); erased := erased + 1; end if;
  end loop;
  perform audit_write('privacy.retention_run', 'system', 'retention', null,
    jsonb_build_object('idempotency_keys', n_idem, 'rate_limits', n_rl, 'notifications', n_notif, 'deliveries', n_deliv, 'ai_runs', n_ai, 'accounts_erased', erased, 'accounts_held', held), '{}');
  return jsonb_build_object('idempotency_keys', n_idem, 'rate_limits', n_rl, 'notifications', n_notif, 'deliveries', n_deliv, 'ai_runs', n_ai, 'accounts_erased', erased, 'accounts_held', held, 'storage_paths', paths);
end $$;
revoke all on function run_retention() from public, anon, authenticated;
grant execute on function run_retention() to service_role;

-- Service notices (status page substitute) ---------------------------------------------------------------------------------------------
create table if not exists service_notices (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info', 'maintenance', 'degraded', 'outage')),
  title_bn text not null check (char_length(title_bn) between 3 and 140),
  title_en text not null check (char_length(title_en) between 3 and 140),
  body_bn text check (body_bn is null or char_length(body_bn) <= 1000),
  body_en text check (body_en is null or char_length(body_en) <= 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_by uuid references profiles on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table service_notices enable row level security;
drop policy if exists service_notices_admin on service_notices;
create policy service_notices_admin on service_notices for select using (is_admin());
revoke all on service_notices from anon, authenticated;
grant select on service_notices to authenticated;
create or replace view public_service_notices with (security_invoker = false) as
  select id, severity, title_bn, title_en, body_bn, body_en, starts_at, ends_at from service_notices
  where status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now());
revoke all on public_service_notices from public;
grant select on public_service_notices to anon, authenticated;

create or replace function post_service_notice(p_severity text, p_title_bn text, p_title_en text, p_body_bn text default null, p_body_en text default null,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n service_notices;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into service_notices (severity, title_bn, title_en, body_bn, body_en, starts_at, ends_at, created_by)
  values (p_severity, p_title_bn, p_title_en, p_body_bn, p_body_en, coalesce(p_starts_at, now()), p_ends_at, auth.uid()) returning * into n;
  perform audit_write('service_notice.posted', 'service_notice', n.id::text, null, jsonb_build_object('severity', p_severity), '{}');
  return jsonb_build_object('id', n.id, 'status', n.status);
exception when check_violation then raise exception 'invalid notice' using errcode = 'JK002', detail = 'notice';
end $$;

create or replace function resolve_service_notice(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n service_notices;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  update service_notices set status = 'resolved', resolved_at = now() where id = p_id and status = 'active' returning * into n;
  if not found then raise exception 'notice not found' using errcode = 'JK404'; end if;
  perform audit_write('service_notice.resolved', 'service_notice', n.id::text, null, null, '{}');
  return jsonb_build_object('id', n.id, 'status', n.status);
end $$;
revoke all on function post_service_notice(text, text, text, text, text, timestamptz, timestamptz), resolve_service_notice(uuid) from public, anon;
grant execute on function post_service_notice(text, text, text, text, text, timestamptz, timestamptz), resolve_service_notice(uuid) to authenticated;

-- Penetration-test findings and retest tracking -----------------------------------------------------------------------------------------
create sequence if not exists pentest_ref_seq start 1;
create table if not exists pentest_findings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PT-' || lpad(nextval('pentest_ref_seq')::text, 3, '0')),
  round integer not null default 1 check (round between 1 and 20),
  title text not null check (char_length(title) between 5 and 200),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  category text check (category is null or char_length(category) <= 80),
  affected text check (affected is null or char_length(affected) <= 300),
  description text check (description is null or char_length(description) <= 4000),
  reported_by text not null check (char_length(reported_by) between 2 and 120),
  reported_on date not null default current_date,
  status text not null default 'open' check (status in ('open', 'fix_in_progress', 'fixed_pending_retest', 'retest_passed', 'retest_failed', 'accepted_risk', 'not_reproducible')),
  fix_ref text check (fix_ref is null or char_length(fix_ref) <= 200),
  fixed_on date,
  retest_on date,
  retest_by text check (retest_by is null or char_length(retest_by) <= 120),
  retest_note text check (retest_note is null or char_length(retest_note) <= 1000),
  acceptance_reason text check (acceptance_reason is null or char_length(acceptance_reason) <= 1000),
  accepted_by uuid references profiles on delete set null,
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table pentest_findings enable row level security;
drop policy if exists pentest_findings_admin on pentest_findings;
create policy pentest_findings_admin on pentest_findings for select using (is_admin());
revoke all on pentest_findings from anon, authenticated;
grant select on pentest_findings to authenticated;

create or replace function record_pentest_finding(p_title text, p_severity text, p_reported_by text, p_category text default null, p_affected text default null,
  p_description text default null, p_round integer default 1, p_reported_on date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f pentest_findings;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into pentest_findings (title, severity, reported_by, category, affected, description, round, reported_on, created_by)
  values (p_title, p_severity, p_reported_by, p_category, p_affected, p_description, p_round, coalesce(p_reported_on, current_date), auth.uid()) returning * into f;
  perform audit_write('pentest.finding_recorded', 'pentest_finding', f.id::text, null, jsonb_build_object('ref', f.ref, 'severity', f.severity), '{}');
  return jsonb_build_object('id', f.id, 'ref', f.ref, 'status', f.status);
exception when check_violation then raise exception 'invalid finding' using errcode = 'JK002', detail = 'finding';
end $$;

-- Status rules: a fix needs a reference; a retest passes only after a fix and needs a note and who retested; critical and high findings cannot be
-- "accepted"; an accepted risk needs a reason.
create or replace function update_pentest_finding(p_ref text, p_status text, p_fix_ref text default null, p_retest_by text default null, p_retest_note text default null,
  p_acceptance_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f pentest_findings; allowed text[];
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into f from pentest_findings where ref = p_ref for update;
  if not found then raise exception 'finding not found' using errcode = 'JK404'; end if;
  allowed := case f.status
    when 'open' then array['fix_in_progress', 'fixed_pending_retest', 'accepted_risk', 'not_reproducible']
    when 'fix_in_progress' then array['fixed_pending_retest', 'open']
    when 'fixed_pending_retest' then array['retest_passed', 'retest_failed']
    when 'retest_failed' then array['fix_in_progress', 'fixed_pending_retest']
    else array[]::text[] end;
  if not (p_status = any (allowed)) then raise exception 'cannot go from % to %', f.status, p_status using errcode = 'JK001'; end if;
  if p_status = 'fixed_pending_retest' and char_length(coalesce(p_fix_ref, f.fix_ref, '')) < 3 then raise exception 'fix reference' using errcode = 'JK002', detail = 'fix_ref'; end if;
  if p_status in ('retest_passed', 'retest_failed') and (char_length(coalesce(p_retest_by, '')) < 2 or char_length(coalesce(p_retest_note, '')) < 10) then
    raise exception 'retest needs who and what was tried' using errcode = 'JK002', detail = 'retest_note'; end if;
  if p_status = 'accepted_risk' then
    if f.severity in ('critical', 'high') then raise exception 'critical and high findings cannot be accepted' using errcode = 'JK003', detail = 'severity_blocks_acceptance'; end if;
    if char_length(coalesce(p_acceptance_reason, '')) < 10 then raise exception 'reason' using errcode = 'JK002', detail = 'acceptance_reason'; end if;
  end if;
  update pentest_findings set status = p_status, fix_ref = coalesce(p_fix_ref, fix_ref),
    fixed_on = case when p_status = 'fixed_pending_retest' then current_date else fixed_on end,
    retest_on = case when p_status in ('retest_passed', 'retest_failed') then current_date else retest_on end,
    retest_by = coalesce(p_retest_by, retest_by), retest_note = coalesce(p_retest_note, retest_note),
    acceptance_reason = coalesce(p_acceptance_reason, acceptance_reason), accepted_by = case when p_status = 'accepted_risk' then auth.uid() else accepted_by end
   where id = f.id returning * into f;
  perform audit_write('pentest.finding_' || p_status, 'pentest_finding', f.id::text, null, jsonb_build_object('ref', f.ref, 'severity', f.severity), '{}');
  return jsonb_build_object('ref', f.ref, 'status', f.status);
end $$;

-- Launch gate: how many findings still block a public launch (open or unretested critical/high, and any retest that failed).
create or replace function pentest_summary() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  return jsonb_build_object('generated_at', now(),
    'total', (select count(*) from pentest_findings),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from pentest_findings group by status) s), '{}'),
    'blocking_launch', (select count(*) from pentest_findings where (severity in ('critical', 'high') and status not in ('retest_passed', 'not_reproducible')) or status = 'retest_failed'),
    'rounds', (select count(distinct round) from pentest_findings));
end $$;
revoke all on function record_pentest_finding(text, text, text, text, text, text, integer, date), update_pentest_finding(text, text, text, text, text, text), pentest_summary() from public, anon;
grant execute on function record_pentest_finding(text, text, text, text, text, text, integer, date), update_pentest_finding(text, text, text, text, text, text), pentest_summary() to authenticated;

-- Pilot sites and cost tracking ---------------------------------------------------------------------------------------------------------
create table if not exists pilot_sites (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null unique references constituencies on delete cascade,
  status text not null default 'planning' check (status in ('planning', 'onboarding', 'live', 'paused', 'ended')),
  categories text[] not null default '{}' check (cardinality(categories) <= 12),
  support_contact text check (support_contact is null or char_length(support_contact) <= 200),
  escalation_contact text check (escalation_contact is null or char_length(escalation_contact) <= 200),
  office_verified_at date,
  starts_on date,
  ends_on date,
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  check (status <> 'live' or (office_verified_at is not null and support_contact is not null and escalation_contact is not null and cardinality(categories) > 0))
);
create table if not exists pilot_budget_lines (
  line text primary key check (line in ('hosting_app', 'hosting_database', 'ai_inference', 'speech', 'email_sms', 'support', 'moderation', 'security_testing', 'other')),
  monthly_budget_usd numeric not null check (monthly_budget_usd >= 0),
  basis text not null check (char_length(basis) between 5 and 300),
  updated_at timestamptz not null default now()
);
create table if not exists pilot_cost_entries (
  id uuid primary key default gen_random_uuid(),
  month date not null check (month = date_trunc('month', month)::date),
  line text not null references pilot_budget_lines (line),
  amount_usd numeric not null check (amount_usd >= 0),
  note text check (note is null or char_length(note) <= 300),
  source_ref text check (source_ref is null or char_length(source_ref) <= 120),
  recorded_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pilot_cost_entries_month_idx on pilot_cost_entries (month, line);
alter table pilot_sites enable row level security;
alter table pilot_budget_lines enable row level security;
alter table pilot_cost_entries enable row level security;
drop policy if exists pilot_sites_admin on pilot_sites;
create policy pilot_sites_admin on pilot_sites for select using (is_admin());
drop policy if exists pilot_budget_admin on pilot_budget_lines;
create policy pilot_budget_admin on pilot_budget_lines for select using (is_admin());
drop policy if exists pilot_costs_admin on pilot_cost_entries;
create policy pilot_costs_admin on pilot_cost_entries for select using (is_admin());
revoke all on pilot_sites, pilot_budget_lines, pilot_cost_entries from anon, authenticated;
grant select on pilot_sites, pilot_budget_lines, pilot_cost_entries to authenticated;

create or replace function upsert_pilot_site(p_constituency text, p_status text, p_categories text[], p_support text default null, p_escalation text default null,
  p_office_verified_at date default null, p_starts_on date default null, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; s pilot_sites;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_constituency;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if exists (select 1 from unnest(coalesce(p_categories, '{}')) k where k not in (select slug from issue_categories)) then raise exception 'unknown category' using errcode = 'JK002', detail = 'categories'; end if;
  insert into pilot_sites (constituency_id, status, categories, support_contact, escalation_contact, office_verified_at, starts_on, notes)
  values (c.id, p_status, coalesce(p_categories, '{}'), p_support, p_escalation, p_office_verified_at, p_starts_on, p_notes)
  on conflict (constituency_id) do update set status = excluded.status, categories = excluded.categories, support_contact = excluded.support_contact, escalation_contact = excluded.escalation_contact,
    office_verified_at = excluded.office_verified_at, starts_on = excluded.starts_on, notes = excluded.notes, updated_at = now()
  returning * into s;
  perform audit_write('pilot.site_saved', 'pilot_site', s.id::text, null, jsonb_build_object('constituency', p_constituency, 'status', s.status), '{}');
  return jsonb_build_object('id', s.id, 'status', s.status, 'categories', s.categories);
exception when check_violation then raise exception 'a live pilot needs a verified office, categories, a support contact and an escalation contact' using errcode = 'JK002', detail = 'pilot_site';
end $$;

create or replace function set_pilot_budget_line(p_line text, p_monthly_usd numeric, p_basis text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into pilot_budget_lines (line, monthly_budget_usd, basis) values (p_line, p_monthly_usd, p_basis)
  on conflict (line) do update set monthly_budget_usd = excluded.monthly_budget_usd, basis = excluded.basis, updated_at = now();
  perform audit_write('pilot.budget_set', 'pilot_budget', p_line, null, jsonb_build_object('monthly_usd', p_monthly_usd), '{}');
  return jsonb_build_object('line', p_line, 'monthly_budget_usd', p_monthly_usd);
exception when check_violation or foreign_key_violation then raise exception 'invalid budget line' using errcode = 'JK002', detail = 'line';
end $$;

create or replace function record_pilot_cost(p_month date, p_line text, p_amount_usd numeric, p_note text default null, p_source_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e pilot_cost_entries;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into pilot_cost_entries (month, line, amount_usd, note, source_ref, recorded_by) values (date_trunc('month', p_month)::date, p_line, p_amount_usd, p_note, p_source_ref, auth.uid()) returning * into e;
  perform audit_write('pilot.cost_recorded', 'pilot_cost', e.id::text, null, jsonb_build_object('line', p_line, 'amount_usd', p_amount_usd), '{}');
  return jsonb_build_object('id', e.id);
exception when check_violation or foreign_key_violation then raise exception 'invalid cost entry' using errcode = 'JK002', detail = 'cost';
end $$;

-- Budget versus actual for a month, per line and per pilot constituency. AI inference actuals come from ai_runs automatically.
create or replace function pilot_cost_report(p_month date default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m date := date_trunc('month', coalesce(p_month, current_date))::date; sites int; lines jsonb; tot_b numeric; tot_a numeric;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select count(*) into sites from pilot_sites where status in ('onboarding', 'live');
  with l as (
    select b.line, b.monthly_budget_usd budget,
      coalesce((select sum(amount_usd) from pilot_cost_entries e where e.month = m and e.line = b.line), 0)
      + case when b.line = 'ai_inference' then coalesce((select sum(cost_usd) from ai_runs r where r.created_at >= m and r.created_at < m + interval '1 month'), 0) else 0 end actual
    from pilot_budget_lines b)
  select coalesce(jsonb_agg(jsonb_build_object('line', line, 'budget_usd', budget, 'actual_usd', actual, 'variance_usd', actual - budget, 'over_budget', actual > budget) order by line), '[]'),
         coalesce(sum(budget), 0), coalesce(sum(actual), 0) into lines, tot_b, tot_a from l;
  return jsonb_build_object('month', m, 'generated_at', now(), 'active_pilot_sites', sites, 'lines', lines, 'total_budget_usd', tot_b, 'total_actual_usd', tot_a,
    'actual_per_site_usd', case when sites > 0 then round(tot_a / sites, 2) end,
    'unbudgeted_lines', coalesce((select jsonb_agg(distinct e.line) from pilot_cost_entries e where e.month = m and not exists (select 1 from pilot_budget_lines b where b.line = e.line)), '[]'),
    'note', 'AI inference actuals are summed from ai_runs; other lines are entered by hand with an invoice reference. The budget lines come from docs/aibc/pilot/cost-model.md (M.5).');
end $$;

revoke all on function upsert_pilot_site(text, text, text[], text, text, date, date, text), set_pilot_budget_line(text, numeric, text), record_pilot_cost(date, text, numeric, text, text), pilot_cost_report(date) from public, anon;
grant execute on function upsert_pilot_site(text, text, text[], text, text, date, date, text), set_pilot_budget_line(text, numeric, text), record_pilot_cost(date, text, numeric, text, text), pilot_cost_report(date) to authenticated;
