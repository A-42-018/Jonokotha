-- Phase 6 (B6.5, B6.6): AI evaluation on real use (consented examples, routing accuracy against office decisions, thresholds from measured
-- baselines, speech tests) and KPI baselines measured in the pilot and published with their method.

-- Consented examples for the evaluation set ------------------------------------------------------------------------------------------------
-- A citizen may offer one of their own reports as an evaluation example. The text is the already-redacted text; it is never published,
-- is reviewed by an administrator, and disappears when the person withdraws consent or deletes the account.
create table if not exists eval_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete set null,
  issue_id uuid references issues on delete set null,
  text text check (text is null or char_length(text) between 10 and 2000),
  language text not null default 'bn' check (language in ('bn', 'en', 'mixed')),
  category text,
  expected_agency_key text,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'withdrawn')),
  reviewed_by uuid references profiles on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 300),
  pii_checked boolean not null default false,
  consent_id uuid references consents on delete set null,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or (text is not null and category is not null and pii_checked))
);
create unique index if not exists eval_candidates_one_per_issue on eval_candidates (user_id, issue_id) where user_id is not null;
alter table eval_candidates enable row level security;
drop policy if exists eval_candidates_own on eval_candidates;
create policy eval_candidates_own on eval_candidates for select using (user_id = auth.uid() or is_admin());
revoke all on eval_candidates from anon, authenticated;
grant select (id, issue_id, status, language, created_at, reviewed_at, review_note, user_id) on eval_candidates to authenticated;

create or replace function submit_eval_example(p_ref text, p_text text, p_language text default 'bn') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); i issues%rowtype; cid uuid; e eval_candidates;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into i from issues where ref = p_ref and reporter_id = uid;
  if not found then raise exception 'issue not found' using errcode = 'JK404'; end if;
  select id into cid from consents where user_id = uid and consent_type = 'ai_eval_example' and withdrawn_at is null order by granted_at desc limit 1;
  if cid is null then raise exception 'consent first' using errcode = 'JK003', detail = 'consent_required'; end if;
  if i.is_demo then raise exception 'demo issues are not used' using errcode = 'JK003', detail = 'demo'; end if;
  insert into eval_candidates (user_id, issue_id, text, language, consent_id) values (uid, i.id, p_text, p_language, cid)
  on conflict (user_id, issue_id) where user_id is not null do nothing returning * into e;
  if not found then raise exception 'already offered' using errcode = 'JK003', detail = 'already_offered'; end if;
  perform audit_write('eval.example_submitted', 'eval_candidate', e.id::text, null, jsonb_build_object('language', p_language), '{}');
  return jsonb_build_object('id', e.id, 'status', e.status);
exception when check_violation then raise exception 'invalid example' using errcode = 'JK002', detail = 'text';
end $$;

create or replace function withdraw_eval_example(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  update eval_candidates set status = 'withdrawn', text = null, category = null, expected_agency_key = null, pii_checked = false where id = p_id and user_id = uid and status <> 'withdrawn';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not found' using errcode = 'JK404'; end if;
  perform audit_write('eval.example_withdrawn', 'eval_candidate', p_id::text, null, null, '{}');
  return jsonb_build_object('withdrawn', true);
end $$;

create or replace function review_eval_example(p_id uuid, p_decision text, p_category text default null, p_expected_agency_key text default null, p_language text default null,
  p_note text default null, p_pii_checked boolean default false, p_text_override text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e eval_candidates;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  select * into e from eval_candidates where id = p_id and status = 'pending_review';
  if not found then raise exception 'not found' using errcode = 'JK404'; end if;
  if p_decision = 'approve' then
    if not p_pii_checked then raise exception 'confirm no personal data remains' using errcode = 'JK002', detail = 'pii_checked'; end if;
    if p_category is null or not exists (select 1 from issue_categories where slug = p_category) then raise exception 'category' using errcode = 'JK002', detail = 'category'; end if;
    if p_expected_agency_key is not null and not exists (select 1 from agencies where key = p_expected_agency_key) then raise exception 'agency' using errcode = 'JK002', detail = 'expected_agency_key'; end if;
    update eval_candidates set status = 'approved', category = p_category, expected_agency_key = p_expected_agency_key, language = coalesce(p_language, language),
      text = coalesce(p_text_override, text), pii_checked = true, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = e.id;
  else
    update eval_candidates set status = 'rejected', text = null, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = e.id;
  end if;
  perform audit_write('eval.example_' || p_decision, 'eval_candidate', e.id::text, null, null, '{}');
  return jsonb_build_object('id', e.id, 'status', case when p_decision = 'approve' then 'approved' else 'rejected' end);
exception when check_violation then raise exception 'invalid review' using errcode = 'JK002', detail = 'review';
end $$;

-- The review queue: administrators read the text through this function (the text column is not granted to anyone directly).
create or replace function pending_eval_examples(p_limit integer default 50) returns table (id uuid, text text, language text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  return query select e.id, e.text, e.language, e.status, e.created_at from eval_candidates e where e.status = 'pending_review' order by e.created_at limit least(greatest(p_limit, 1), 200);
end $$;
revoke all on function pending_eval_examples(integer) from public, anon;
grant execute on function pending_eval_examples(integer) to authenticated;

-- The approved examples in the dataset format of tests/ai/dataset.v0.json (id, text, category, language, expected agency). Admin only; audited.
create or replace function eval_set_export() returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', 'real-' || substr(replace(id::text, '-', ''), 1, 10), 'text', text, 'category', category, 'language', language,
    'expected_agency', expected_agency_key, 'source', 'consented_real') order by created_at), '[]') into out from eval_candidates where status = 'approved';
  perform audit_write('eval.set_exported', 'eval_set', 'real', null, jsonb_build_object('count', jsonb_array_length(out)), '{}');
  return jsonb_build_object('generated_at', now(), 'examples', out);
end $$;

-- Consent withdrawn or account deleted: the text goes.
create or replace function eval_candidates_forget() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'consents' then
    if new.consent_type = 'ai_eval_example' and new.withdrawn_at is not null and old.withdrawn_at is null then
      update eval_candidates set status = 'withdrawn', text = null, category = null, expected_agency_key = null, pii_checked = false where user_id = new.user_id and status <> 'withdrawn';
    end if;
  elsif new.account_status = 'deleted' and old.account_status is distinct from 'deleted' then
    update eval_candidates set status = 'withdrawn', text = null, category = null, expected_agency_key = null, pii_checked = false, user_id = null where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists eval_forget_on_consent on consents;
create trigger eval_forget_on_consent after update of withdrawn_at on consents for each row execute function eval_candidates_forget();
drop trigger if exists eval_forget_on_deletion on profiles;
create trigger eval_forget_on_deletion after update of account_status on profiles for each row execute function eval_candidates_forget();

-- Routing accuracy against what offices actually did --------------------------------------------------------------------------------------
-- For each issue with an AI routing suggestion AND a recorded referral, did the suggested agency match the first agency the office forwarded to?
-- Small buckets are hidden (fewer than 5). Demo issues are excluded unless asked for.
create or replace function routing_accuracy(p_days integer default 90, p_include_demo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz; k constant integer := 5; out jsonb; n_all int; n_match int;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_days not between 1 and 730 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  since := now() - make_interval(days => p_days);
  with ra as (
    select s.confidence conf, (s.payload ->> 'agency_id')::uuid is not distinct from r.agency_id matched
    from ai_suggestions s
    join issues i on s.target_type = 'issue' and s.target_id = i.id::text
    join lateral (select agency_id from issue_agency_referrals r where r.issue_id = i.id order by forwarded_at limit 1) r on true
    where s.suggestion_type = 'routing' and s.created_at >= since and (p_include_demo or not i.is_demo)),
  buckets as (select matched, case when conf is null then -1 when conf < 0.5 then 0 when conf < 0.7 then 0.5 when conf < 0.85 then 0.7 else 0.85 end lo from ra)
  select (select count(*) from ra), (select count(*) filter (where matched) from ra),
         coalesce((select jsonb_agg(jsonb_build_object('confidence_from', lo, 'n', case when n >= k then n end, 'accuracy_pct', case when n >= k then round(100.0 * m / n, 1) end, 'suppressed', n < k) order by lo)
                   from (select lo, count(*) n, count(*) filter (where matched) m from buckets group by lo) q), '[]')
    into n_all, n_match, out;
  return jsonb_build_object('period_days', p_days, 'generated_at', now(), 'min_group_size', k, 'include_demo', p_include_demo,
    'compared', case when n_all >= k then n_all end, 'accuracy_pct', case when n_all >= k then round(100.0 * n_match / n_all, 1) end, 'suppressed', n_all < k,
    'by_confidence', out,
    'definition', 'Share of AI routing suggestions whose agency equals the first agency the office forwarded the same issue to. Only issues with both a suggestion and a referral are counted; an office choosing differently is data, not an error of the office.');
end $$;
revoke all on function submit_eval_example(text, text, text), withdraw_eval_example(uuid), review_eval_example(uuid, text, text, text, text, text, boolean, text), eval_set_export(), routing_accuracy(integer, boolean) from public, anon;
grant execute on function submit_eval_example(text, text, text), withdraw_eval_example(uuid), review_eval_example(uuid, text, text, text, text, text, boolean, text), eval_set_export(), routing_accuracy(integer, boolean) to authenticated;

-- Thresholds set from measured baselines ------------------------------------------------------------------------------------------------------
create table if not exists ai_thresholds (
  key text primary key check (key in ('duplicate_min_score', 'routing_min_confidence', 'stt_min_confidence')),
  value numeric not null check (value between 0 and 1),
  basis jsonb not null,
  set_by uuid references profiles on delete set null,
  set_at timestamptz not null default now()
);
alter table ai_thresholds enable row level security;
drop policy if exists ai_thresholds_admin on ai_thresholds;
create policy ai_thresholds_admin on ai_thresholds for select using (is_admin());
revoke all on ai_thresholds from anon, authenticated;
grant select on ai_thresholds to authenticated;

-- A threshold needs evidence: how many cases it was measured on, which metric, how, and when.
create or replace function set_ai_threshold(p_key text, p_value numeric, p_basis jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare old ai_thresholds;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if jsonb_typeof(p_basis) <> 'object' or coalesce((p_basis ->> 'n')::int, 0) < 30 or coalesce(p_basis ->> 'metric', '') = '' or coalesce(p_basis ->> 'method', '') = '' or coalesce(p_basis ->> 'measured_on', '') = '' then
    raise exception 'basis needs n (30 or more), metric, method and measured_on' using errcode = 'JK002', detail = 'basis';
  end if;
  select * into old from ai_thresholds where key = p_key;
  insert into ai_thresholds (key, value, basis, set_by) values (p_key, p_value, p_basis, auth.uid())
  on conflict (key) do update set value = excluded.value, basis = excluded.basis, set_by = excluded.set_by, set_at = now();
  perform audit_write('ai.threshold_set', 'ai_threshold', p_key, case when old.key is null then null else jsonb_build_object('value', old.value, 'basis', old.basis) end, jsonb_build_object('value', p_value, 'basis', p_basis), '{}');
  return jsonb_build_object('key', p_key, 'value', p_value);
exception when check_violation or invalid_text_representation then raise exception 'invalid threshold' using errcode = 'JK002', detail = 'value';
end $$;
revoke all on function set_ai_threshold(text, numeric, jsonb) from public, anon;
grant execute on function set_ai_threshold(text, numeric, jsonb) to authenticated;

-- Speech tests (aggregate results only; no audio or transcripts are stored) -----------------------------------------------------------------------
create table if not exists stt_test_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 2 and 60),
  language text not null default 'bn' check (language in ('bn', 'en')),
  district text not null check (char_length(district) between 2 and 60),
  age_band text not null check (age_band in ('18-29', '30-44', '45-59', '60+')),
  environment text not null check (environment in ('quiet_room', 'street', 'market', 'vehicle', 'office', 'other')),
  samples integer not null check (samples between 1 and 10000),
  word_error_rate numeric not null check (word_error_rate between 0 and 5),
  participants_consented boolean not null check (participants_consented),
  notes text check (notes is null or char_length(notes) <= 500),
  recorded_by uuid references profiles on delete set null,
  recorded_at timestamptz not null default now()
);
alter table stt_test_runs enable row level security;
drop policy if exists stt_test_runs_admin on stt_test_runs;
create policy stt_test_runs_admin on stt_test_runs for select using (is_admin());
revoke all on stt_test_runs from anon, authenticated;
grant select on stt_test_runs to authenticated;

create or replace function record_stt_test(p_provider text, p_district text, p_age_band text, p_environment text, p_samples integer, p_wer numeric, p_consented boolean,
  p_language text default 'bn', p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r stt_test_runs;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into stt_test_runs (provider, language, district, age_band, environment, samples, word_error_rate, participants_consented, notes, recorded_by)
  values (p_provider, p_language, p_district, p_age_band, p_environment, p_samples, p_wer, p_consented, p_notes, auth.uid()) returning * into r;
  perform audit_write('stt.test_recorded', 'stt_test_run', r.id::text, null, jsonb_build_object('district', p_district, 'environment', p_environment), '{}');
  return jsonb_build_object('id', r.id);
exception when check_violation then raise exception 'invalid test record' using errcode = 'JK002', detail = 'stt';
end $$;

create or replace function stt_summary() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  return jsonb_build_object('generated_at', now(), 'definition', 'Sample-weighted word error rate (lower is better) by group',
    'by_environment', coalesce((select jsonb_agg(jsonb_build_object('environment', environment, 'samples', s, 'wer', w) order by environment) from (select environment, sum(samples) s, round(sum(word_error_rate * samples) / sum(samples), 3) w from stt_test_runs group by environment) x), '[]'),
    'by_age_band', coalesce((select jsonb_agg(jsonb_build_object('age_band', age_band, 'samples', s, 'wer', w) order by age_band) from (select age_band, sum(samples) s, round(sum(word_error_rate * samples) / sum(samples), 3) w from stt_test_runs group by age_band) x), '[]'),
    'by_district', coalesce((select jsonb_agg(jsonb_build_object('district', district, 'samples', s, 'wer', w) order by district) from (select district, sum(samples) s, round(sum(word_error_rate * samples) / sum(samples), 3) w from stt_test_runs group by district) x), '[]'));
end $$;
revoke all on function record_stt_test(text, text, text, text, integer, numeric, boolean, text, text), stt_summary() from public, anon;
grant execute on function record_stt_test(text, text, text, text, integer, numeric, boolean, text, text), stt_summary() to authenticated;

-- KPI baselines -------------------------------------------------------------------------------------------------------------------------------
create table if not exists kpi_baselines (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies on delete cascade,
  period_start date not null,
  period_end date not null,
  metric_key text not null check (metric_key ~ '^[a-z0-9_]{3,60}$'),
  value numeric,
  n integer,
  suppressed boolean not null default false,
  definition text not null check (char_length(definition) between 10 and 600),
  method text not null check (char_length(method) between 10 and 600),
  source text not null check (source in ('computed', 'manual')),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  created_by uuid references profiles on delete set null,
  published_by uuid references profiles on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index if not exists kpi_baselines_idx on kpi_baselines (constituency_id, period_end, status);
alter table kpi_baselines enable row level security;
drop policy if exists kpi_baselines_staff on kpi_baselines;
create policy kpi_baselines_staff on kpi_baselines for select using (is_admin() or office_can(constituency_id, 'view_analytics', null));
revoke all on kpi_baselines from anon, authenticated;
grant select on kpi_baselines to authenticated;
create or replace view public_kpi_baselines with (security_invoker = false) as
  select c.key as constituency, c.is_demo as is_sample, b.metric_key, case when b.suppressed then null else b.value end as value, case when b.suppressed then null else b.n end as n,
         b.suppressed, b.period_start, b.period_end, b.definition, b.method, b.published_at
  from kpi_baselines b join constituencies c on c.id = b.constituency_id where b.status = 'published';
revoke all on public_kpi_baselines from public;
grant select on public_kpi_baselines to anon, authenticated;

-- Computes the baseline from the database (office_kpis does the permission check) and stores it as a draft. Nothing is public until an administrator publishes.
create or replace function snapshot_kpi_baseline(p_constituency text, p_days integer default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; k jsonb; m jsonb; ps date := current_date - p_days; pe date := current_date; outcomes int; cnt int := 0; meth constant text := 'Computed from the production database by office_kpis() over the period; groups under 5 are suppressed. Not adjusted for seasonality.';
  rec record;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  k := office_kpis(p_constituency, p_days);          -- raises 42501 for anyone without analytics permission
  m := k -> 'metrics';
  delete from kpi_baselines where constituency_id = c.id and period_end = pe and source = 'computed' and status = 'draft';
  for rec in select * from (values
      ('received', (m -> 'received' ->> 'value')::numeric, (m -> 'received' ->> 'value')::int, coalesce((m -> 'received' ->> 'suppressed')::boolean, false), m -> 'received' ->> 'definition'),
      ('median_hours_to_first_response', (m -> 'median_hours_to_first_response' ->> 'value')::numeric, null::int, coalesce((m -> 'median_hours_to_first_response' ->> 'suppressed')::boolean, false), m -> 'median_hours_to_first_response' ->> 'definition'),
      ('forwarding_rate_pct', (m -> 'forwarding_rate_pct' ->> 'value')::numeric, null, coalesce((m -> 'forwarding_rate_pct' ->> 'suppressed')::boolean, false), m -> 'forwarding_rate_pct' ->> 'definition'),
      ('reopen_rate_pct', (m -> 'reopen_rate_pct' ->> 'value')::numeric, null, coalesce((m -> 'reopen_rate_pct' ->> 'suppressed')::boolean, false), m -> 'reopen_rate_pct' ->> 'definition'),
      ('handling_hours_with_copilot', (m -> 'handling_time_with_copilot' ->> 'with_hours')::numeric, (m -> 'handling_time_with_copilot' ->> 'with_n')::int, (m -> 'handling_time_with_copilot' ->> 'with_hours') is null, m -> 'handling_time_with_copilot' ->> 'definition'),
      ('handling_hours_without_copilot', (m -> 'handling_time_with_copilot' ->> 'without_hours')::numeric, (m -> 'handling_time_with_copilot' ->> 'without_n')::int, (m -> 'handling_time_with_copilot' ->> 'without_hours') is null, m -> 'handling_time_with_copilot' ->> 'definition')
    ) v(metric_key, value, n, suppressed, definition) loop
    insert into kpi_baselines (constituency_id, period_start, period_end, metric_key, value, n, suppressed, definition, method, source, created_by)
    values (c.id, ps, pe, rec.metric_key, rec.value, rec.n, rec.suppressed, rec.definition, meth, 'computed', auth.uid());
    cnt := cnt + 1;
  end loop;
  -- North-star (masterplan 3.2): issues that reached a documented outcome in the period, per month. The state machine requires a note or reason for every terminal status.
  select count(distinct e.issue_id) into outcomes from issue_events e join issues i on i.id = e.issue_id
   where i.constituency_id = c.id and e.event_type = 'status_change' and e.to_status in ('resolved', 'rejected', 'closed', 'duplicate', 'out_of_jurisdiction')
     and e.created_at >= ps and e.created_at < pe + 1;
  insert into kpi_baselines (constituency_id, period_start, period_end, metric_key, value, n, suppressed, definition, method, source, created_by)
  values (c.id, ps, pe, 'north_star_outcomes_per_month', case when outcomes >= 5 then round(outcomes * 30.0 / p_days, 1) end, case when outcomes >= 5 then outcomes end, outcomes < 5,
    'Issues that reached a documented outcome (resolved with a note, rejected with a reason, closed, duplicate or out of jurisdiction) per month, for this constituency',
    meth || ' Monthly figure = count in period x 30 / period days.', 'computed', auth.uid());
  perform audit_write('kpi.baseline_snapshot', 'constituency', c.id::text, null, jsonb_build_object('period_days', p_days), '{}');
  return jsonb_build_object('constituency', p_constituency, 'period_start', ps, 'period_end', pe, 'metrics', cnt + 1, 'status', 'draft');
end $$;

-- Measurements nobody can compute from case data (accessibility task completion, time-and-motion studies, surveys) are entered with their method.
create or replace function record_manual_kpi(p_constituency text, p_metric text, p_value numeric, p_n integer, p_method text, p_definition text, p_start date, p_end date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; b kpi_baselines;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_metric not in ('accessibility_task_completion_pct', 'copilot_time_study_with_minutes', 'copilot_time_study_without_minutes', 'citizen_satisfaction_pct', 'report_completion_rate_pct') then
    raise exception 'metric' using errcode = 'JK002', detail = 'metric'; end if;
  select * into c from constituencies where key = p_constituency;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  delete from kpi_baselines where constituency_id = c.id and period_end = p_end and metric_key = p_metric and source = 'manual' and status = 'draft';
  insert into kpi_baselines (constituency_id, period_start, period_end, metric_key, value, n, suppressed, definition, method, source, created_by)
  values (c.id, p_start, p_end, p_metric, p_value, p_n, coalesce(p_n, 0) < 5, p_definition, p_method, 'manual', auth.uid()) returning * into b;
  perform audit_write('kpi.manual_recorded', 'kpi_baseline', b.id::text, null, jsonb_build_object('metric', p_metric, 'n', p_n), '{}');
  return jsonb_build_object('id', b.id, 'suppressed', b.suppressed, 'status', b.status);
exception when check_violation then raise exception 'invalid measurement' using errcode = 'JK002', detail = 'kpi';
end $$;

create or replace function publish_kpi_baselines(p_constituency text, p_period_end date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; n int;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_constituency;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not exists (select 1 from kpi_baselines where constituency_id = c.id and period_end = p_period_end and status = 'draft') then raise exception 'nothing to publish' using errcode = 'JK404'; end if;
  update kpi_baselines o set status = 'withdrawn' where o.constituency_id = c.id and o.status = 'published'
    and exists (select 1 from kpi_baselines d where d.constituency_id = c.id and d.period_end = p_period_end and d.status = 'draft' and d.metric_key = o.metric_key and d.source = o.source);
  update kpi_baselines set status = 'published', published_by = auth.uid(), published_at = now() where constituency_id = c.id and period_end = p_period_end and status = 'draft';
  get diagnostics n = row_count;
  perform audit_write('kpi.baseline_published', 'constituency', c.id::text, null, jsonb_build_object('period_end', p_period_end, 'metrics', n), '{}');
  return jsonb_build_object('published', n);
end $$;

create or replace function withdraw_kpi_baselines(p_constituency text, p_period_end date, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; n int;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if char_length(coalesce(p_reason, '')) < 5 then raise exception 'reason' using errcode = 'JK002', detail = 'reason'; end if;
  select * into c from constituencies where key = p_constituency;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  update kpi_baselines set status = 'withdrawn' where constituency_id = c.id and period_end = p_period_end and status = 'published';
  get diagnostics n = row_count;
  perform audit_write('kpi.baseline_withdrawn', 'constituency', c.id::text, null, jsonb_build_object('period_end', p_period_end, 'reason', p_reason), '{}');
  return jsonb_build_object('withdrawn', n);
end $$;

revoke all on function snapshot_kpi_baseline(text, integer), record_manual_kpi(text, text, numeric, integer, text, text, date, date), publish_kpi_baselines(text, date), withdraw_kpi_baselines(text, date, text) from public, anon;
grant execute on function snapshot_kpi_baseline(text, integer), record_manual_kpi(text, text, numeric, integer, text, text, date, date), publish_kpi_baselines(text, date), withdraw_kpi_baselines(text, date, text) to authenticated;
