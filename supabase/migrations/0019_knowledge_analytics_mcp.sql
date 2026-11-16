-- Phase 2.11-2.14 (masterplan §17): knowledge retrieval for the Routing Agent, privacy-filtered analytics with office review,
-- and the audit hook for the read-only MCP server.
-- Requires 0004-0018.

-- Knowledge chunks: one row per (source, locale, content checksum), tied to the agency it describes. ---------------------
alter table knowledge_chunks add column if not exists checksum text;
alter table knowledge_chunks add column if not exists agency_id uuid references agencies on delete cascade;
create unique index if not exists knowledge_chunks_uq on knowledge_chunks (source_id, locale, checksum) where checksum is not null;
create index if not exists knowledge_chunks_agency_idx on knowledge_chunks (agency_id);

-- Retrieval for one issue, for office staff in scope. Demo and real sources never share an index: a sample issue only sees
-- sample sources, a real issue only real ones. Semantic (cosine) when an embedding is given, otherwise lexical:
-- 0.6 for an agency that serves the issue's category + 0.4 x trigram similarity of the text. Scores are comparable only within a method.
create or replace function retrieve_knowledge(p_issue uuid, p_embedding vector(1024) default null, p_limit integer default 5)
returns table (chunk_id uuid, source_id uuid, source_name text, source_url text, fetched_at timestamptz, locale text, content text, agency_id uuid, agency_key text, score real, method text)
language plpgsql stable security definer set search_path = public as $$
declare i issues%rowtype; semantic boolean := p_embedding is not null and vector_norm(p_embedding) > 0;
begin
  select * into i from issues where id = p_issue;
  if not found or not office_can(i.constituency_id, 'view', i.assigned_to) then raise exception 'issue not found' using errcode = 'JK404'; end if;
  if semantic then
    return query
    select k.id, s.id, s.name, s.url, s.fetched_at, k.locale, k.content, k.agency_id, a.key, (1 - (k.embedding <=> p_embedding))::real, 'semantic'::text
    from knowledge_chunks k join knowledge_sources s on s.id = k.source_id left join agencies a on a.id = k.agency_id
    where s.status = 'active' and s.is_demo = i.is_demo and k.embedding is not null and vector_norm(k.embedding) > 0
    order by k.embedding <=> p_embedding limit least(greatest(p_limit, 1), 10);
  else
    return query
    select k.id, s.id, s.name, s.url, s.fetched_at, k.locale, k.content, k.agency_id, a.key,
           ((case when a.categories @> array[i.category] then 0.6 else 0 end) + 0.4 * similarity(k.content, i.title || ' ' || i.description))::real, 'lexical'::text
    from knowledge_chunks k join knowledge_sources s on s.id = k.source_id left join agencies a on a.id = k.agency_id
    where s.status = 'active' and s.is_demo = i.is_demo
    order by 10 desc limit least(greatest(p_limit, 1), 10);
  end if;
end $$;
revoke all on function retrieve_knowledge(uuid, vector, integer) from public, anon;
grant execute on function retrieve_knowledge(uuid, vector, integer) to authenticated;

-- Analytics -------------------------------------------------------------------------------------------------------------
-- Aggregates for one constituency over the last p_days days (1-365). Any group smaller than 5 is reported as suppressed (count null),
-- so a number never singles out a few people. Needs the "view_analytics" permission in that constituency.
create or replace function analytics_overview(p_constituency text, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; since timestamptz; k constant integer := 5;
        total integer; resolved integer; med numeric; by_status jsonb; by_cat jsonb; trend jsonb; hot jsonb; agencies_j jsonb; clusters jsonb;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'view_analytics', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_days not between 1 and 365 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  since := now() - make_interval(days => p_days);

  select count(*), count(*) filter (where status in ('resolved','closed')),
         (percentile_cont(0.5) within group (order by extract(epoch from (resolved_at - created_at)) / 3600) filter (where resolved_at is not null))::numeric(10,1)
    into total, resolved, med from issues where constituency_id = c.id and created_at >= since;

  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', case when n >= k then n end, 'suppressed', n < k) order by status), '[]') into by_status
    from (select status::text, count(*)::int n from issues where constituency_id = c.id and created_at >= since group by status) s;
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', case when n >= k then n end, 'suppressed', n < k) order by n desc), '[]') into by_cat
    from (select category, count(*)::int n from issues where constituency_id = c.id and created_at >= since group by category) s;
  select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'count', case when n >= k then n end, 'suppressed', n < k) order by wk), '[]') into trend
    from (select (date_trunc('week', created_at))::date wk, count(*)::int n from issues where constituency_id = c.id and created_at >= since group by 1) s;

  -- Hotspots: public (grid-snapped) cells with at least k issues. Only the approximate point is used, never the exact one.
  select coalesce(jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'count', n, 'top_category', top) order by n desc), '[]') into hot
    from (select public_lat lat, public_lng lng, count(*)::int n, mode() within group (order by category) top
          from issues where constituency_id = c.id and created_at >= since and public_visibility and public_lat is not null
          group by public_lat, public_lng having count(*) >= k order by count(*) desc limit 10) h;

  -- Issue -> agency edges in the graph.
  select coalesce(jsonb_agg(jsonb_build_object('agency_key', key, 'count', n) order by n desc), '[]') into agencies_j
    from (select a.key, count(*)::int n from graph_edges e join issues i on i.id::text = e.from_id join agencies a on a.id::text = e.to_id
          where e.from_type = 'issue' and e.relation = 'routed_to' and i.constituency_id = c.id and i.created_at >= since group by a.key having count(*) >= k order by 2 desc limit 10) g;

  -- Duplicate clusters by recursive traversal of "duplicate_of" edges (members point at their master; chains are followed, depth capped).
  with recursive chain (root_id, member_id, depth) as (
    select i.id, i.id, 0 from issues i where i.constituency_id = c.id
    union all
    select ch.root_id, e.from_id::uuid, ch.depth + 1 from chain ch join graph_edges e
      on e.to_type = 'issue' and e.to_id = ch.member_id::text and e.relation = 'duplicate_of' and e.from_type = 'issue' where ch.depth < 8),
  sized as (select root_id, count(distinct member_id)::int n from chain group by root_id having count(distinct member_id) >= 2)
  select coalesce(jsonb_agg(jsonb_build_object('master_ref', i.ref, 'reports', s.n) order by s.n desc), '[]') into clusters
    from (select * from sized order by n desc limit 10) s join issues i on i.id = s.root_id and i.public_visibility;

  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'period_days', p_days, 'generated_at', now(),
    'received', case when total >= k then total end, 'received_suppressed', total < k, 'resolved', case when resolved >= k then resolved end,
    'median_hours_to_resolution', case when resolved >= k then med end,
    'by_status', by_status, 'by_category', by_cat, 'weekly_trend', trend, 'hotspots', hot, 'top_agencies', agencies_j, 'duplicate_clusters', clusters,
    'privacy', jsonb_build_object('min_group_size', k, 'note', 'Groups smaller than the minimum are hidden. Locations are approximate grid cells.'));
end $$;
revoke all on function analytics_overview(text, integer) from public, anon;
grant execute on function analytics_overview(text, integer) to authenticated;

-- Office review before anything is shared: a report is a frozen snapshot, draft until an office manager approves it.
create table if not exists analytics_reports (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies,
  period_days integer not null check (period_days between 1 and 365),
  payload jsonb not null,
  narrative text check (narrative is null or char_length(narrative) <= 1500),
  status text not null default 'draft' check (status in ('draft','approved','withdrawn')),
  created_by uuid references profiles on delete set null,
  approved_by uuid references profiles on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists analytics_reports_idx on analytics_reports (constituency_id, created_at desc);
alter table analytics_reports enable row level security;
drop policy if exists analytics_reports_select on analytics_reports;
create policy analytics_reports_select on analytics_reports for select using (office_can(constituency_id, 'view_analytics', null) or is_admin());
revoke all on analytics_reports from anon, authenticated;
grant select on analytics_reports to authenticated;
create or replace view public_analytics_reports with (security_invoker = false) as
  select r.id, c.key as constituency_key, r.period_days, r.payload, r.narrative, r.approved_at, c.is_demo
  from analytics_reports r join constituencies c on c.id = r.constituency_id where r.status = 'approved';
grant select on public_analytics_reports to anon, authenticated;

create or replace function create_analytics_report(p_constituency text, p_days integer, p_narrative text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; payload jsonb; v analytics_reports%rowtype;
begin
  payload := analytics_overview(p_constituency, p_days);      -- checks scope and permission
  select * into c from constituencies where key = p_constituency;
  insert into analytics_reports (constituency_id, period_days, payload, narrative, created_by) values (c.id, p_days, payload, nullif(btrim(coalesce(p_narrative, '')), ''), auth.uid()) returning * into v;
  perform audit_write('analytics_report.create', 'analytics_report', v.id::text, null, jsonb_build_object('status', 'draft'), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('id', v.id, 'status', v.status);
end $$;

create or replace function set_analytics_report_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v analytics_reports%rowtype;
begin
  select * into v from analytics_reports where id = p_id;
  if not found or not office_can(v.constituency_id, 'view_analytics', null) then raise exception 'report not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'decide', null) then raise exception 'only an office manager can share a report' using errcode = '42501'; end if;
  if p_status not in ('approved','withdrawn') or (p_status = 'approved' and v.status <> 'draft') or (p_status = 'withdrawn' and v.status = 'draft') then
    raise exception 'invalid status change' using errcode = 'JK001';
  end if;
  update analytics_reports set status = p_status, approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end where id = v.id;
  perform audit_write('analytics_report.' || p_status, 'analytics_report', v.id::text, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('id', v.id, 'status', p_status);
end $$;
revoke all on function create_analytics_report(text, integer, text), set_analytics_report_status(uuid, text) from public, anon;
grant execute on function create_analytics_report(text, integer, text), set_analytics_report_status(uuid, text) to authenticated;

-- MCP (read-only tools for staff clients): every tool call leaves an audit row with the tool name and the argument KEYS and sizes
-- (never the values, which may hold personal data). Only staff and admins can call it.
create or replace function record_mcp_call(p_tool text, p_args jsonb, p_results integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_role() not in ('staff', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  perform audit_write('mcp.tool_call', 'mcp_tool', left(p_tool, 60), null, null,
    jsonb_build_object('arg_keys', (select coalesce(jsonb_agg(k), '[]') from jsonb_object_keys(coalesce(p_args, '{}')) k), 'results', p_results, 'read_only', true));
end $$;
revoke all on function record_mcp_call(text, jsonb, integer) from public, anon;
grant execute on function record_mcp_call(text, jsonb, integer) to authenticated;
