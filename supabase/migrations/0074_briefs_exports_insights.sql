-- Phase 7 (B7.9, B7.10, B7.11, B7.13; masterplan §4.3, §3.3, §15, §19.7, §22): weekly insight briefs with office review, permission-checked
-- exports, heatmap and cluster data with small-group suppression, Release 1.1 KPIs, jobs, feature flags and erasure of Phase 7 data.
-- Requires 0070-0073. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 7 status):
--   * A weekly brief is data first: counts with the 5-person rule, drafted into prose by the Insight Agent when a key exists (every number in the
--     prose must occur in the data, same check as analytics reports). A brief is a DRAFT that only the reviewing roles (those who can publish for
--     the area) can see until a person approves it; approving shares it with the rest of the office. The AI never shares anything itself.
--   * Exports are office-only, scoped to the caller's area, and carry no free text and no person identifiers (no title, description, reporter,
--     location text). Every export is written to the audit log with the kind, format and row count. CSV is built here; PDF rendering is an API-layer
--     matter (see docs/api-v1.md, Phase 7).
--   * Heatmaps and clusters use grid cells of 250 m to 5 km; a cell with fewer than 5 issues is not returned at all (only how many cells were hidden).
--   * Erasing an account also erases what Phase 7 stored about it; check-in photo files are queued for deletion (pending_file_deletions).

-- Jobs -------------------------------------------------------------------------------------------------------------------------------------------------
alter table background_jobs drop constraint if exists background_jobs_kind_check;
alter table background_jobs add constraint background_jobs_kind_check check (kind in ('notify_deliver','media_scan','ai_task','ingest','poll_maintenance','purge','release11_maintenance','weekly_briefs'));
create or replace function ensure_periodic_jobs() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if enqueue_job('poll_maintenance', '{}', now(), 'poll:' || to_char(now(), 'YYYYMMDDHH24')) is not null then n := n + 1; end if;
  if enqueue_job('purge', '{}', now(), 'purge:' || to_char(now(), 'YYYYMMDD')) is not null then n := n + 1; end if;
  if enqueue_job('notify_deliver', '{}', now(), 'deliver:' || to_char(now(), 'YYYYMMDDHH24MI')) is not null then n := n + 1; end if;
  if enqueue_job('release11_maintenance', '{}', now(), 'r11:' || to_char(now(), 'YYYYMMDDHH24')) is not null then n := n + 1; end if;
  if enqueue_job('weekly_briefs', '{}', now(), 'briefs:' || to_char(now(), 'IYYY-IW')) is not null then n := n + 1; end if;
  return n;
end $$;
revoke all on function ensure_periodic_jobs() from public, anon, authenticated;
grant execute on function ensure_periodic_jobs() to service_role;

-- Files to delete from storage after an account is erased (service role only).
create table if not exists pending_file_deletions (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (char_length(bucket) <= 60),
  path text not null check (char_length(path) <= 300),
  created_at timestamptz not null default now()
);
alter table pending_file_deletions enable row level security;
revoke all on pending_file_deletions from anon, authenticated;
create or replace function take_file_deletions(p_limit integer default 100) returns table (id uuid, bucket text, path text)
language sql security definer set search_path = public as $$
  select id, bucket, path from pending_file_deletions order by created_at limit least(greatest(p_limit, 1), 500) $$;
create or replace function finish_file_deletions(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin delete from pending_file_deletions where id = any (p_ids); get diagnostics n = row_count; return n; end $$;
revoke all on function take_file_deletions(integer), finish_file_deletions(uuid[]) from public, anon, authenticated;
grant execute on function take_file_deletions(integer), finish_file_deletions(uuid[]) to service_role;

-- Weekly briefs ----------------------------------------------------------------------------------------------------------------------------------------
create table if not exists insight_briefs (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies on delete cascade,
  week_start date not null,
  payload jsonb not null,
  narrative_draft text check (narrative_draft is null or char_length(narrative_draft) <= 1500),
  narrative text check (narrative is null or char_length(narrative) <= 1500),
  status text not null default 'draft' check (status in ('draft','approved','withdrawn')),
  generated_at timestamptz not null default now(),
  reviewed_by uuid references profiles on delete set null,
  reviewed_at timestamptz,
  shared_at timestamptz,
  unique (constituency_id, week_start)
);
alter table insight_briefs enable row level security;
drop policy if exists insight_briefs_select on insight_briefs;
create policy insight_briefs_select on insight_briefs for select
  using (is_admin() or office_can(constituency_id, 'publish', null) or (status = 'approved' and office_can(constituency_id, 'view_analytics', null)));
revoke all on insight_briefs from anon, authenticated;
grant select on insight_briefs to authenticated;

create or replace function weekly_brief_payload(p_constituency uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare k constant integer := 5; since timestamptz := now() - interval '7 days'; prev timestamptz := now() - interval '14 days'; c constituencies%rowtype;
        rec integer; prv integer; res integer; cats jsonb; cells integer; fb_n integer; fb_avg numeric;
begin
  select * into c from constituencies where id = p_constituency;
  select count(*)::int into rec from issues where constituency_id = c.id and created_at >= since;
  select count(*)::int into prv from issues where constituency_id = c.id and created_at >= prev and created_at < since;
  select count(*)::int into res from issues where constituency_id = c.id and resolved_at >= since;
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', n) order by n desc), '[]') into cats
    from (select category, count(*)::int n from issues where constituency_id = c.id and created_at >= since group by category having count(*) >= k order by 2 desc limit 5) x;
  select count(*)::int into cells from (select public_lat, public_lng from issues where constituency_id = c.id and created_at >= since and public_visibility and public_lat is not null
    group by public_lat, public_lng having count(*) >= k) h;
  select count(*)::int, avg(f.rating) into fb_n, fb_avg from issue_feedback f join issues i on i.id = f.issue_id where i.constituency_id = c.id and f.created_at >= since;
  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'period_days', 7, 'generated_at', now(),
    'received', case when rec >= k then rec end, 'received_suppressed', rec < k,
    'previous_week_received', case when prv >= k then prv end,
    'resolved', case when res >= k then res end,
    'top_categories', cats, 'hotspot_cells', cells,
    'satisfaction_ratings', case when fb_n >= k then fb_n end, 'satisfaction_average', case when fb_n >= k then round(fb_avg, 2) end,
    'ideas_awaiting_response', (select count(*)::int from ideas where constituency_id = c.id and threshold_reached_at is not null and responded_at is null),
    'ideas_overdue', (select count(*)::int from ideas where constituency_id = c.id and threshold_reached_at is not null and responded_at is null and response_due_at < now()),
    'consultations_open', (select count(*)::int from consultations where constituency_id = c.id and status = 'open'),
    'commitments_delayed', (select count(*)::int from commitments where constituency_id = c.id and status = 'delayed'),
    'privacy', jsonb_build_object('min_group_size', k, 'note', 'Counts below the minimum are hidden.'));
end $$;
revoke all on function weekly_brief_payload(uuid) from public, anon, authenticated;

-- Job: one draft per area with an active office per week. Returns what the TypeScript side needs to draft the prose.
create or replace function generate_weekly_briefs() returns table (id uuid, constituency_key text, payload jsonb)
language plpgsql security definer set search_path = public as $$
declare c record; ws date := date_trunc('week', now())::date; v insight_briefs%rowtype;
begin
  for c in select k.id, k.key from constituencies k where k.is_active and exists (select 1 from office_members m where m.constituency_id = k.id and m.status = 'active') loop
    insert into insight_briefs (constituency_id, week_start, payload) values (c.id, ws, weekly_brief_payload(c.id)) on conflict (constituency_id, week_start) do nothing returning * into v;
    if v.id is not null then
      perform notify_office(c.id, 'publish', 'brief_ready', 'সাপ্তাহিক সারাংশ পর্যালোচনার জন্য প্রস্তুত', to_char(ws, 'YYYY-MM-DD'),
        jsonb_build_object('week', ws, 'en', jsonb_build_object('title', 'The weekly brief is ready for review', 'body', to_char(ws, 'YYYY-MM-DD'))), 'brief:' || v.id, null);
      id := v.id; constituency_key := c.key; payload := v.payload; return next;
    end if;
    v := null;
  end loop;
end $$;
revoke all on function generate_weekly_briefs() from public, anon, authenticated;
grant execute on function generate_weekly_briefs() to service_role;

create or replace function set_brief_draft(p_id uuid, p_text text) returns void
language sql security definer set search_path = public as $$
  update insight_briefs set narrative_draft = nullif(left(btrim(coalesce(p_text, '')), 1500), '') where id = p_id and status = 'draft' $$;
revoke all on function set_brief_draft(uuid, text) from public, anon, authenticated;
grant execute on function set_brief_draft(uuid, text) to service_role;

create or replace function review_insight_brief(p_id uuid, p_decision text, p_narrative text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b insight_briefs%rowtype; text_final text;
begin
  select * into b from insight_briefs where id = p_id;
  if not found or not (office_can(b.constituency_id, 'publish', null) or is_admin()) then raise exception 'brief not found' using errcode = 'JK404'; end if;
  if p_decision not in ('approve','withdraw') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if b.status <> 'draft' then raise exception 'already reviewed' using errcode = 'JK003', detail = 'reviewed'; end if;
  text_final := nullif(btrim(coalesce(p_narrative, b.narrative_draft, '')), '');
  if p_decision = 'approve' and char_length(coalesce(text_final, '')) < 10 then raise exception 'a reviewed text is required' using errcode = 'JK002', detail = 'narrative'; end if;
  update insight_briefs set status = case when p_decision = 'approve' then 'approved' else 'withdrawn' end, narrative = case when p_decision = 'approve' then text_final end,
    reviewed_by = auth.uid(), reviewed_at = now(), shared_at = case when p_decision = 'approve' then now() end where id = b.id;
  if p_decision = 'approve' then
    perform notify_office(b.constituency_id, 'view_analytics', 'brief_ready', 'সাপ্তাহিক সারাংশ শেয়ার করা হয়েছে', to_char(b.week_start, 'YYYY-MM-DD'),
      jsonb_build_object('week', b.week_start, 'en', jsonb_build_object('title', 'The weekly brief was shared', 'body', to_char(b.week_start, 'YYYY-MM-DD'))), 'brief-shared:' || b.id, null);
  end if;
  perform audit_write('brief.' || p_decision, 'insight_brief', b.id::text, jsonb_build_object('status', b.status), jsonb_build_object('status', case when p_decision = 'approve' then 'approved' else 'withdrawn' end), jsonb_build_object('ai_draft_edited', p_narrative is not null and p_narrative is distinct from b.narrative_draft));
  return jsonb_build_object('id', b.id, 'status', case when p_decision = 'approve' then 'approved' else 'withdrawn' end);
end $$;
revoke all on function review_insight_brief(uuid, text, text) from public, anon;
grant execute on function review_insight_brief(uuid, text, text) to authenticated;

-- Exports --------------------------------------------------------------------------------------------------------------------------------------------------
create or replace function export_rows(p_kind text, p_constituency text, p_days integer default 90, p_format text default 'csv') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; since timestamptz; cols text[]; rows jsonb; n integer;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not (office_can(c.id, 'view', null) or is_admin()) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not (office_can(c.id, 'view_analytics', null) or is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('cases','ideas') then raise exception 'kind' using errcode = 'JK002', detail = 'kind'; end if;
  if p_format not in ('csv','pdf') then raise exception 'format' using errcode = 'JK002', detail = 'format'; end if;
  if p_days not between 1 and 730 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  since := now() - make_interval(days => p_days);
  if p_kind = 'cases' then
    cols := array['ref','category','status','source_channel','created_at','resolved_at','public'];
    select coalesce(jsonb_agg(jsonb_build_array(ref, category, status, source_channel, created_at, resolved_at, public_visibility) order by created_at desc), '[]') into rows
      from (select ref, category, status, source_channel, created_at, resolved_at, public_visibility from issues where constituency_id = c.id and created_at >= since order by created_at desc limit 5000) x;
  else
    cols := array['ref','category','status','support_count','threshold_reached_at','response_due_at','response_state','created_at'];
    select coalesce(jsonb_agg(jsonb_build_array(ref, category, status, support_count, threshold_reached_at, response_due_at, response_state, created_at) order by created_at desc), '[]') into rows
      from (select p.ref, p.category, p.status, p.support_count, p.threshold_reached_at, p.response_due_at, p.response_state, p.created_at from public_ideas p where p.constituency_key = c.key and p.created_at >= since order by p.created_at desc limit 5000) x;
  end if;
  n := jsonb_array_length(rows);
  perform audit_write('export.office', 'constituency', c.key, null, jsonb_build_object('kind', p_kind, 'format', p_format, 'rows', n, 'days', p_days));
  return jsonb_build_object('constituency', c.key, 'kind', p_kind, 'columns', to_jsonb(cols), 'rows', rows, 'row_count', n, 'generated_at', now(), 'is_sample', c.is_demo, 'period_days', p_days,
    'definition', 'No titles, descriptions, names or exact locations are included. At most 5000 rows, newest first.');
end $$;
revoke all on function export_rows(text, text, integer, text) from public, anon;
grant execute on function export_rows(text, text, integer, text) to authenticated;

-- Heatmaps and clusters -------------------------------------------------------------------------------------------------------------------------------
create or replace function heatmap_core(p_constituency uuid, p_days integer, p_category text, p_cell_m integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare k constant integer := 5; step double precision := p_cell_m / 111320.0; since timestamptz := now() - make_interval(days => p_days); prev timestamptz := now() - make_interval(days => p_days * 2);
        cells jsonb; hidden integer; total integer;
begin
  with pts as (
    select floor(public_lat / step) gy, floor(public_lng / step) gx, category, created_at >= since as cur
    from issues where constituency_id = p_constituency and public_visibility and public_lat is not null and created_at >= prev and (p_category is null or category = p_category)),
  agg as (
    select gy, gx, count(*) filter (where cur)::int n, count(*) filter (where not cur)::int prev_n, mode() within group (order by category) filter (where cur) top
    from pts group by gy, gx having count(*) filter (where cur) > 0)
  select count(*) filter (where n < k)::int, coalesce(sum(n), 0)::int into hidden, total from agg;
  -- the cell list is built separately and only from cells with k or more issues
  with pts as (
    select floor(public_lat / step) gy, floor(public_lng / step) gx, category, created_at >= since as cur
    from issues where constituency_id = p_constituency and public_visibility and public_lat is not null and created_at >= prev and (p_category is null or category = p_category)),
  agg as (
    select gy, gx, count(*) filter (where cur)::int n, count(*) filter (where not cur)::int prev_n, mode() within group (order by category) filter (where cur) top
    from pts group by gy, gx having count(*) filter (where cur) >= k)
  select coalesce(jsonb_agg(jsonb_build_object('lat', round(((gy + 0.5) * step)::numeric, 5), 'lng', round(((gx + 0.5) * step)::numeric, 5), 'count', n, 'top_category', top,
           'previous_period_count', case when prev_n >= k then prev_n end, 'emerging', (prev_n < k or n >= prev_n * 2)) order by n desc), '[]')
    into cells from agg;
  return jsonb_build_object('cells', cells, 'cells_hidden', hidden, 'min_group_size', k, 'cell_size_m', p_cell_m, 'period_days', p_days, 'category', p_category, 'generated_at', now(),
    'definition', 'Public issues with an approximate location, grouped in square cells. A cell with fewer than 5 issues is not shown. "Emerging" = at least double the previous period or no comparable previous count. Not a ranking of areas.');
end $$;
revoke all on function heatmap_core(uuid, integer, text, integer) from public, anon, authenticated;

create or replace function public_heatmap(p_constituency text, p_days integer default 30, p_category text default null, p_cell_m integer default 1000) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if p_days not between 1 and 365 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  if p_cell_m not between 500 and 5000 then raise exception 'cell size' using errcode = 'JK002', detail = 'cell_m'; end if;
  if p_category is not null and p_category !~ '^[a-z_]{2,40}$' then raise exception 'category' using errcode = 'JK002', detail = 'category'; end if;
  return heatmap_core(c.id, p_days, p_category, p_cell_m) || jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo);
end $$;
revoke all on function public_heatmap(text, integer, text, integer) from public;
grant execute on function public_heatmap(text, integer, text, integer) to anon, authenticated;

-- Office: finer cells, category clusters and the duplicate clusters of analytics_overview.
create or replace function office_clusters(p_constituency text, p_days integer default 30, p_category text default null, p_cell_m integer default 250) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; k constant integer := 5; cats jsonb;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'view_analytics', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_days not between 1 and 365 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  if p_cell_m not between 250 and 5000 then raise exception 'cell size' using errcode = 'JK002', detail = 'cell_m'; end if;
  if p_category is not null and p_category !~ '^[a-z_]{2,40}$' then raise exception 'category' using errcode = 'JK002', detail = 'category'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', n) order by n desc), '[]') into cats
    from (select category, count(*)::int n from issues where constituency_id = c.id and created_at >= now() - make_interval(days => p_days) group by category having count(*) >= k) x;
  return heatmap_core(c.id, p_days, p_category, p_cell_m) || jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'category_clusters', cats);
end $$;
revoke all on function office_clusters(text, integer, text, integer) from public, anon;
grant execute on function office_clusters(text, integer, text, integer) to authenticated;

-- Release 1.1 KPIs --------------------------------------------------------------------------------------------------------------------------------------------
create or replace function release11_kpis(p_constituency text default null, p_days integer default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; cid uuid; k constant integer := 5; since timestamptz; scoped boolean := p_constituency is not null;
        cons_total integer; cons_closed integer; cons_reported integer; voters integer; thr integer; thr_due integer; thr_ontime integer; chk integer; prio integer; surv integer;
        cases_total integer; cases_channel integer; fb_n integer; fb_avg numeric; alerts integer; cm_total integer; cm_delivered integer;
begin
  if scoped then
    select * into c from constituencies where key = p_constituency and is_active;
    if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
    if not office_can(c.id, 'view_analytics', null) then raise exception 'not allowed' using errcode = '42501'; end if;
    cid := c.id;
  elsif not is_admin() then raise exception 'administrators only' using errcode = '42501';
  end if;
  if p_days not between 1 and 730 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  since := now() - make_interval(days => p_days);
  select count(*)::int, count(*) filter (where status in ('closed','reported'))::int, count(*) filter (where status = 'reported')::int into cons_total, cons_closed, cons_reported
    from consultations where (cid is null or constituency_id = cid) and created_at >= since and status <> 'draft' and status <> 'cancelled';
  select count(distinct v.user_id)::int into voters from statement_votes v join consultation_statements s on s.id = v.statement_id join consultations x on x.id = s.consultation_id
    where (cid is null or x.constituency_id = cid) and v.voted_at >= since;
  select count(*)::int, count(*) filter (where response_due_at < now() or responded_at is not null)::int, count(*) filter (where responded_at is not null and responded_at <= response_due_at)::int into thr, thr_due, thr_ontime
    from ideas where (cid is null or constituency_id = cid) and threshold_reached_at >= since;
  select count(*)::int into chk from project_checkins k2 join projects p on p.id = k2.project_id where (cid is null or p.constituency_id = cid) and k2.moderation_status = 'approved' and k2.created_at >= since;
  select count(distinct r.user_id)::int into prio from priority_ranks r join priority_rounds x on x.id = r.round_id where (cid is null or x.constituency_id = cid) and r.ranked_at >= since;
  select count(*)::int into surv from survey_responses r join surveys x on x.id = r.survey_id where (cid is null or x.constituency_id = cid) and r.submitted_at >= since;
  select count(*)::int, count(*) filter (where source_channel in ('whatsapp','sms'))::int into cases_total, cases_channel from issues where (cid is null or constituency_id = cid) and created_at >= since;
  select count(*)::int, avg(f.rating) into fb_n, fb_avg from issue_feedback f join issues i on i.id = f.issue_id where (cid is null or i.constituency_id = cid) and f.created_at >= since;
  select count(*)::int into alerts from area_alerts where (cid is null or constituency_id = cid) and created_at >= since;
  select count(*)::int, count(*) filter (where status = 'delivered')::int into cm_total, cm_delivered from commitments where (cid is null or constituency_id = cid) and status in ('planned','in_progress','delivered','delayed','dropped') and created_at >= since;
  return jsonb_build_object('constituency', p_constituency, 'period_days', p_days, 'generated_at', now(), 'min_group_size', k, 'kpis', jsonb_build_object(
    'consultation_participants', jsonb_build_object('value', case when voters >= k then voters end, 'suppressed', voters < k, 'definition', 'Distinct verified accounts that voted on at least one consultation statement in the period.'),
    'consultation_report_rate', jsonb_build_object('value', case when cons_closed >= 1 then round(cons_reported::numeric / cons_closed, 3) end, 'n', cons_closed, 'definition', 'Share of consultations created in the period that were closed and have a published "you said, we did" report. n = closed or reported consultations.'),
    'idea_threshold_on_time', jsonb_build_object('value', case when thr_due >= 1 then round(thr_ontime::numeric / thr_due, 3) end, 'n', thr_due, 'reached', thr, 'definition', 'Of ideas that reached their area''s support threshold in the period and are answered or past their due date, the share answered by the due date.'),
    'project_checkins', jsonb_build_object('value', case when chk >= k then chk end, 'suppressed', chk < k, 'definition', 'Approved citizen check-ins on public projects.'),
    'priority_participants', jsonb_build_object('value', case when prio >= k then prio end, 'suppressed', prio < k, 'definition', 'Distinct verified local accounts that ranked community priorities.'),
    'survey_responses', jsonb_build_object('value', case when surv >= k then surv end, 'suppressed', surv < k, 'definition', 'Completed survey responses.'),
    'channel_intake_share', jsonb_build_object('value', case when cases_total >= k then round(cases_channel::numeric / cases_total, 3) end, 'n', case when cases_total >= k then cases_total end, 'definition', 'Share of reports created through WhatsApp or SMS.'),
    'satisfaction_average', jsonb_build_object('value', case when fb_n >= k then round(fb_avg, 2) end, 'n', case when fb_n >= k then fb_n end, 'definition', 'Average 1 to 5 rating after case resolution.'),
    'area_alerts_sent', jsonb_build_object('value', alerts, 'definition', 'Area alerts sent by offices.'),
    'commitments_delivered', jsonb_build_object('value', case when cm_total >= 1 then cm_delivered end, 'n', cm_total, 'definition', 'Commitments created in the period that are now marked delivered with evidence, out of all published commitments created in the period.')));
end $$;
revoke all on function release11_kpis(text, integer) from public, anon;
grant execute on function release11_kpis(text, integer) to authenticated;

-- Feature flags and integrations ----------------------------------------------------------------------------------------------------------------------------
insert into feature_flags (key, enabled, data_status, description) values
  ('consultations', true, 'live', 'Consultations with consensus mapping (aggregates only)'),
  ('whatsapp_intake', false, 'planned', 'Report through WhatsApp (needs an approved provider account and a number)'),
  ('sms_intake', false, 'planned', 'Report through SMS (needs an SMS provider account and a number)'),
  ('channel_notifications', false, 'planned', 'Case updates and area alerts by SMS or WhatsApp (needs provider accounts and a budget)'),
  ('project_checkins', true, 'live', 'Citizen check-ins on public projects (reviewed before they are public)'),
  ('idea_arguments', true, 'live', 'For and against points on ideas'),
  ('idea_threshold', true, 'live', 'Support threshold with an office response time'),
  ('surveys', true, 'live', 'Surveys and public satisfaction summary'),
  ('commitments', true, 'live', 'Commitment tracker'),
  ('priority_ranking', true, 'live', 'Non-binding community priority ranking'),
  ('weekly_briefs', true, 'live', 'Weekly insight briefs, reviewed by the office before sharing'),
  ('exports', true, 'live', 'CSV exports for offices'),
  ('read_aloud', false, 'planned', 'Bangla text-to-speech (needs a provider key; browser speech is the fallback)')
on conflict (key) do nothing;

alter table integration_settings drop constraint if exists integration_settings_kind_check;
alter table integration_settings add constraint integration_settings_kind_check check (kind in ('ai','email','sms','push','maps','stt','embeddings','malware_scan','error_monitoring','analytics','whatsapp','tts'));
insert into integration_settings (provider, kind, enabled) values ('whatsapp','whatsapp',false), ('tts','tts',false) on conflict (provider) do nothing;

-- Erasure of Phase 7 data, called from erase_user_data (guarded by legal holds in 0061) ---------------------------------------------------------------------------
create or replace function erase_phase7_data(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update channel_messages set body = null where link_id in (select id from channel_links where user_id = p_user);
  delete from channel_conversations where link_id in (select id from channel_links where user_id = p_user);
  update channel_links set status = 'revoked', address = null, address_hash = null, address_hint = null, code_hash = null, updates_enabled = false where user_id = p_user and status <> 'revoked';
  delete from statement_votes where user_id = p_user;
  update consultation_statements set body = '[removed ' || left(id::text, 8) || ']', status = 'rejected', author_id = null where author_id = p_user and kind = 'citizen';
  delete from idea_argument_votes where user_id = p_user;
  update idea_arguments set body = '[removed by the author]', status = 'hidden' where author_id = p_user;
  insert into pending_file_deletions (bucket, path) select 'project-checkins', photo_path from project_checkins where author_id = p_user and photo_path is not null;
  update project_checkins set note = '[removed by the author]', photo_path = null, moderation_status = 'hidden' where author_id = p_user;
  delete from survey_responses where user_id = p_user;
  delete from priority_ranks where user_id = p_user;
end $$;
revoke all on function erase_phase7_data(uuid) from public, anon, authenticated;

create or replace function erase_user_data(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if legal_hold_active(p_user) then
    perform audit_write('privacy.erasure_blocked_by_hold', 'profile', p_user::text, null, null, '{}');
    return jsonb_build_object('erased', false, 'held', true);
  end if;
  r := erase_user_data_unchecked(p_user);
  if coalesce((r ->> 'erased')::boolean, false) then perform erase_phase7_data(p_user); end if;
  return r;
end $$;
revoke all on function erase_user_data(uuid) from public, anon, authenticated;
grant execute on function erase_user_data(uuid) to service_role;
