-- Phase 3 (M.11, masterplan §3.3 and §22): office and admin KPIs. Every metric carries its own definition, period and
-- generation time so a figure is never shown without its meaning. Groups smaller than 5 are hidden (null) and marked suppressed.

create or replace function office_kpis(p_constituency text, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; since timestamptz; k constant integer := 5;
        received int; unassigned int; first_n int; first_med numeric; fwd_n int; fwd int; res_n int; res_ev int; reopen int;
        cop_n int; cop_med numeric; nocop_n int; nocop_med numeric; in_status jsonb; ai jsonb;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'view_analytics', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_days not between 1 and 365 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  since := now() - make_interval(days => p_days);

  select count(*) into received from issues where constituency_id = c.id and created_at >= since;
  select count(*) into unassigned from issues where constituency_id = c.id and assigned_to is null and status in ('submitted','under_review','acknowledged','reopened');

  -- first response = the first status change after submission
  with fr as (
    select i.id, i.created_at, (select min(e.created_at) from issue_events e where e.issue_id = i.id and e.event_type = 'status_change') first_at,
           exists (select 1 from ai_suggestions s where s.target_type = 'issue' and s.target_id = i.id::text and s.suggestion_type = 'reply_draft' and s.decision in ('accepted','edited')) used_copilot
    from issues i where i.constituency_id = c.id and i.created_at >= since)
  select count(first_at), (percentile_cont(0.5) within group (order by extract(epoch from (first_at - created_at)) / 3600) filter (where first_at is not null))::numeric(10,1),
         count(first_at) filter (where used_copilot), (percentile_cont(0.5) within group (order by extract(epoch from (first_at - created_at)) / 3600) filter (where first_at is not null and used_copilot))::numeric(10,1),
         count(first_at) filter (where not used_copilot), (percentile_cont(0.5) within group (order by extract(epoch from (first_at - created_at)) / 3600) filter (where first_at is not null and not used_copilot))::numeric(10,1)
    into first_n, first_med, cop_n, cop_med, nocop_n, nocop_med from fr;

  select count(*) filter (where ever_fwd), count(*) into fwd, fwd_n from (
    select exists (select 1 from issue_events e where e.issue_id = i.id and e.to_status = 'referred_to_authority') ever_fwd
    from issues i where i.constituency_id = c.id and i.created_at >= since) f;

  select count(*) filter (where was_resolved), count(*) filter (where was_resolved and was_reopened) into res_ev, reopen from (
    select exists (select 1 from issue_events e where e.issue_id = i.id and e.to_status = 'resolved') was_resolved,
           exists (select 1 from issue_events e where e.issue_id = i.id and e.to_status = 'reopened') was_reopened
    from issues i where i.constituency_id = c.id and i.created_at >= since) r;
  res_n := res_ev;

  -- time spent in each status: gap between an event and the next one for the same issue
  select coalesce(jsonb_agg(jsonb_build_object('status', st, 'median_hours', case when n >= k then med end, 'suppressed', n < k) order by st), '[]') into in_status from (
    select to_status::text st, count(*)::int n, (percentile_cont(0.5) within group (order by extract(epoch from (next_at - created_at)) / 3600))::numeric(10,1) med
    from (select e.to_status, e.created_at, lead(e.created_at) over (partition by e.issue_id order by e.created_at) next_at
          from issue_events e join issues i on i.id = e.issue_id where i.constituency_id = c.id and e.event_type = 'status_change' and e.created_at >= since) t
    where next_at is not null and to_status is not null group by to_status) s;

  select coalesce(jsonb_agg(jsonb_build_object('agent', agent, 'suggestions', case when n >= k then n end, 'accepted_or_edited_pct', case when n >= k then round(100.0 * used / n, 1) end, 'suppressed', n < k) order by agent), '[]') into ai from (
    select r.agent, count(*)::int n, count(*) filter (where s.decision in ('accepted','edited'))::int used
    from ai_suggestions s join ai_runs r on r.id = s.ai_run_id join issues i on s.target_type = 'issue' and s.target_id = i.id::text
    where i.constituency_id = c.id and s.created_at >= since and s.decision in ('accepted','edited','dismissed') group by r.agent) a;

  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'period_days', p_days, 'generated_at', now(), 'min_group_size', k, 'metrics', jsonb_build_object(
    'received', jsonb_build_object('value', case when received >= k then received end, 'suppressed', received < k, 'definition', 'Issues submitted in the period'),
    'unassigned_workload', jsonb_build_object('value', unassigned, 'definition', 'Open issues with no assigned officer right now (not limited to the period)'),
    'median_hours_to_first_response', jsonb_build_object('value', case when first_n >= k then first_med end, 'suppressed', first_n < k, 'definition', 'Median hours from submission to the first status change, for issues submitted in the period that have one'),
    'forwarding_rate_pct', jsonb_build_object('value', case when fwd_n >= k then round(100.0 * fwd / fwd_n, 1) end, 'suppressed', fwd_n < k, 'definition', 'Share of issues submitted in the period that were ever referred to an authority'),
    'reopen_rate_pct', jsonb_build_object('value', case when res_n >= k then round(100.0 * reopen / res_n, 1) end, 'suppressed', res_n < k, 'definition', 'Of issues submitted in the period that were ever resolved, the share later reopened'),
    'median_hours_in_status', jsonb_build_object('value', in_status, 'definition', 'Median hours an issue stayed in each status before its next change'),
    'handling_time_with_copilot', jsonb_build_object('with_hours', case when cop_n >= k then cop_med end, 'without_hours', case when nocop_n >= k then nocop_med end, 'with_n', case when cop_n >= k then cop_n end, 'without_n', case when nocop_n >= k then nocop_n end,
      'definition', 'Median hours to first response where an accepted or edited copilot reply draft exists, versus not. Offices choose when to use the copilot, so this is an association, not proof of effect'),
    'ai_acceptance', jsonb_build_object('value', ai, 'definition', 'Per agent: share of decided suggestions that staff accepted or edited (the rest were dismissed)')));
end $$;
revoke all on function office_kpis(text, integer) from public, anon;
grant execute on function office_kpis(text, integer) to authenticated;

create or replace function admin_kpis(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz; k constant integer := 5; users int; reporters int; issues_n int; reports_n int; hidden int; deliveries int; sent int; dead int; runs int; errs int; cost numeric; unresolved int;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_days not between 1 and 365 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  since := now() - make_interval(days => p_days);
  select count(*) into users from profiles where account_status = 'active' and created_at >= since;
  select count(distinct reporter_id), count(*) into reporters, issues_n from issues where created_at >= since and not is_demo;
  select count(*) into reports_n from moderation_reports where created_at >= since;
  select count(*) into hidden from moderation_reports where created_at >= since and status = 'actioned' and decision = 'hide';
  select count(*), count(*) filter (where status = 'sent'), count(*) filter (where status = 'dead') into deliveries, sent, dead from notification_deliveries where created_at >= since;
  select count(*), count(*) filter (where status <> 'ok'), coalesce(sum(cost_usd), 0) into runs, errs, cost from ai_runs where created_at >= since;
  select count(*) into unresolved from moderation_reports where status = 'open';
  return jsonb_build_object('period_days', p_days, 'generated_at', now(), 'min_group_size', k, 'metrics', jsonb_build_object(
    'new_accounts', jsonb_build_object('value', users, 'definition', 'Active accounts created in the period'),
    'active_reporters', jsonb_build_object('value', reporters, 'definition', 'Distinct people who submitted at least one non-sample issue in the period'),
    'issues_submitted', jsonb_build_object('value', issues_n, 'definition', 'Non-sample issues submitted in the period'),
    'abuse_report_rate_pct', jsonb_build_object('value', case when issues_n >= k then round(100.0 * reports_n / issues_n, 1) end, 'suppressed', issues_n < k, 'definition', 'Moderation reports created in the period per 100 issues submitted'),
    'content_hidden', jsonb_build_object('value', hidden, 'open_reports', unresolved, 'definition', 'Reports actioned with hide in the period; reports still open now'),
    'notification_delivery', jsonb_build_object('sent_pct', case when deliveries >= k then round(100.0 * sent / deliveries, 1) end, 'dead_letter', dead, 'total', deliveries, 'definition', 'Share of queued push and email deliveries sent in the period; deliveries that failed all retries'),
    'ai_error_rate_pct', jsonb_build_object('value', case when runs >= k then round(100.0 * errs / runs, 1) end, 'runs', runs, 'definition', 'AI runs that did not return a valid result, as a share of all AI runs in the period'),
    'ai_cost_usd', jsonb_build_object('value', round(cost, 2), 'definition', 'Sum of recorded AI cost in the period; zero if price variables are not set')));
end $$;
revoke all on function admin_kpis(integer) from public, anon;
grant execute on function admin_kpis(integer) to authenticated;
