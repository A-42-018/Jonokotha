-- Phase 7 (B7.1; masterplan §7.14, §8.10, §12 R1.1, §15): consultations with consensus mapping.
-- Requires 0004-0062. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 7 status):
--   * Lifecycle: draft -> (pending_approval ->) open -> closed -> reported. The MP-approval rule of B5.1 applies to opening: where the area
--     requires it and an active MP exists, an office manager's "open" waits for the MP (or an administrator).
--   * Statements are 5 to 140 characters, one idea each; no replies. Citizen statements wait for a moderator or the office; the office's
--     own seed statements are approved from the start.
--   * One vote per verified account per statement (primary key). A vote can be changed while the consultation is open.
--   * Votes are never shown per person. The matrix the grouping works on has NO user ids (participants are numbered per request) and is
--     returned only to office staff with analytics rights; the stored report holds aggregates only and the database itself drops any group
--     smaller than 5 people, so a bug in the API layer cannot publish a small group.
--   * Per-statement counts are hidden from citizens until the report is published (no bandwagon effect).

-- Helpers shared by Phase 7 ------------------------------------------------------------------------------------------------------------------
-- "Local verified account": a verified account that follows the area. Used where the masterplan says "verified local supporters/accounts".
create or replace function local_verified_account(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select verified_account() and exists (select 1 from follows f where f.user_id = auth.uid() and f.target_type = 'area' and f.constituency_id = c) $$;
revoke all on function local_verified_account(uuid) from public, anon;
grant execute on function local_verified_account(uuid) to authenticated;

-- Tell everyone who follows an area (respecting their mute lists, channels and quiet hours through notify_user). Returns how many were told.
create or replace function notify_area_followers(p_constituency uuid, p_type text, p_title text, p_body text, p_data jsonb, p_dedupe text, p_ref text default null, p_exclude uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare f record; n integer := 0;
begin
  for f in select distinct user_id from follows where target_type = 'area' and constituency_id = p_constituency and user_id is distinct from p_exclude loop
    if notify_user(f.user_id, p_type, p_title, p_body, p_data, p_dedupe, p_ref) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function notify_area_followers(uuid, text, text, text, jsonb, text, text, uuid) from public, anon, authenticated;

-- Tell office members of an area who hold a given permission (for example 'decide' or 'view_analytics').
create or replace function notify_office(p_constituency uuid, p_action text, p_type text, p_title text, p_body text, p_data jsonb, p_dedupe text, p_ref text default null) returns integer
language plpgsql security definer set search_path = public as $$
declare m record; n integer := 0;
begin
  for m in select distinct om.user_id from office_members om join office_permissions op on op.office_role = om.office_role and op.action = p_action
            where om.constituency_id = p_constituency and om.status = 'active' loop
    if notify_user(m.user_id, p_type, p_title, p_body, p_data, p_dedupe || ':' || m.user_id, p_ref) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function notify_office(uuid, text, text, text, text, jsonb, text, text) from public, anon, authenticated;

-- Tables ------------------------------------------------------------------------------------------------------------------------------------
create sequence if not exists consultation_ref_seq start 1000;
create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('CN-' || to_char(now(), 'YYYY') || '-' || nextval('consultation_ref_seq')),
  constituency_id uuid not null references constituencies,
  created_by uuid references profiles on delete set null,
  question text not null check (char_length(question) between 10 and 200),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'draft' check (status in ('draft','pending_approval','open','closed','reported','cancelled')),
  closes_at timestamptz not null,
  opened_at timestamptz,
  closed_at timestamptz,
  approved_by uuid references profiles on delete set null,
  approved_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists consultations_scope_idx on consultations (constituency_id, status, created_at desc);

create table if not exists consultation_statements (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations on delete cascade,
  author_id uuid references profiles on delete set null,
  kind text not null default 'citizen' check (kind in ('seed','citizen')),
  body text not null check (char_length(body) between 5 and 140),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  moderation_reason text check (moderation_reason is null or char_length(moderation_reason) <= 300),
  moderated_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists consultation_statements_idx on consultation_statements (consultation_id, status);
create unique index if not exists consultation_statements_unique_text on consultation_statements (consultation_id, lower(body));

create table if not exists statement_votes (
  statement_id uuid not null references consultation_statements on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  vote text not null check (vote in ('agree','disagree','pass')),
  voted_at timestamptz not null default now(),
  primary key (statement_id, user_id)
);
create index if not exists statement_votes_user_idx on statement_votes (user_id);

create table if not exists consultation_reports (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references consultations on delete cascade,
  participants integer not null default 0,
  groups jsonb not null default '[]',
  agreement jsonb not null default '[]',
  hidden_groups integer not null default 0,
  min_group_size integer not null default 5,
  ai_summary text check (ai_summary is null or char_length(ai_summary) <= 2000),
  summary_bn text check (summary_bn is null or char_length(summary_bn) <= 2000),
  you_said_we_did text check (you_said_we_did is null or char_length(you_said_we_did) <= 3000),
  actions jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','reviewed','published')),
  reviewed_by uuid references profiles on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  generated_at timestamptz not null default now()
);

alter table consultations enable row level security;
alter table consultation_statements enable row level security;
alter table statement_votes enable row level security;
alter table consultation_reports enable row level security;
drop policy if exists consultations_select on consultations;
create policy consultations_select on consultations for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists consultation_statements_select on consultation_statements;
create policy consultation_statements_select on consultation_statements for select
  using (author_id = auth.uid() or is_moderator() or is_admin()
         or exists (select 1 from consultations c where c.id = consultation_id and office_can(c.constituency_id, 'view', null)));
drop policy if exists statement_votes_select on statement_votes;
create policy statement_votes_select on statement_votes for select using (user_id = auth.uid());
drop policy if exists consultation_reports_select on consultation_reports;
create policy consultation_reports_select on consultation_reports for select
  using (is_admin() or exists (select 1 from consultations c where c.id = consultation_id and office_can(c.constituency_id, 'view_analytics', null)));
revoke all on consultations, consultation_statements, statement_votes, consultation_reports from anon, authenticated;
grant select on consultations, consultation_statements, statement_votes, consultation_reports to authenticated;

-- Public views: only what a visitor may see. Per-statement vote counts are NOT here. ----------------------------------------------------------
create or replace view public_consultations with (security_invoker = false) as
  select c.ref, k.key as constituency_key, c.question, c.description, c.status, c.closes_at, c.opened_at, c.closed_at, c.is_demo,
         (select count(*)::int from consultation_statements s where s.consultation_id = c.id and s.status = 'approved') as statement_count,
         (select case when count(distinct v.user_id) >= 5 then count(distinct v.user_id)::int end from statement_votes v join consultation_statements s on s.id = v.statement_id where s.consultation_id = c.id) as participant_count
  from consultations c join constituencies k on k.id = c.constituency_id where c.status in ('open','closed','reported');
create or replace view public_consultation_statements with (security_invoker = false) as
  select c.ref as consultation_ref, s.id, s.body, s.kind
  from consultation_statements s join consultations c on c.id = s.consultation_id
  where s.status = 'approved' and c.status in ('open','closed','reported');
create or replace view public_consultation_reports with (security_invoker = false) as
  select c.ref as consultation_ref, k.key as constituency_key, r.participants, r.groups, r.agreement, r.hidden_groups, r.min_group_size, r.summary_bn, r.you_said_we_did, r.actions, r.published_at, c.is_demo
  from consultation_reports r join consultations c on c.id = r.consultation_id join constituencies k on k.id = c.constituency_id
  where r.status = 'published' and c.status = 'reported';
grant select on public_consultations, public_consultation_statements, public_consultation_reports to anon, authenticated;

-- Office: create (a draft with seed statements) ---------------------------------------------------------------------------------------------
create or replace function create_consultation(p_constituency text, p_question text, p_description text, p_seed text[], p_closes_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v consultations%rowtype; s text; seeds text[];
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_closes_at is null or p_closes_at <= now() or p_closes_at > now() + interval '120 days' then raise exception 'closing time' using errcode = 'JK002', detail = 'closes_at'; end if;
  select array_agg(btrim(x)) into seeds from unnest(coalesce(p_seed, '{}')) x where btrim(x) <> '';
  if coalesce(array_length(seeds, 1), 0) > 10 then raise exception 'at most 10 seed statements' using errcode = 'JK002', detail = 'seed'; end if;
  if exists (select 1 from unnest(coalesce(seeds, '{}')) x where char_length(x) not between 5 and 140) then raise exception 'statement length' using errcode = 'JK002', detail = 'seed'; end if;
  if (select count(distinct lower(x)) from unnest(coalesce(seeds, '{}')) x) <> coalesce(array_length(seeds, 1), 0) then raise exception 'duplicate statements' using errcode = 'JK002', detail = 'seed'; end if;
  insert into consultations (constituency_id, created_by, question, description, closes_at, is_demo)
  values (c.id, auth.uid(), btrim(p_question), nullif(btrim(coalesce(p_description, '')), ''), p_closes_at, c.is_demo) returning * into v;
  foreach s in array coalesce(seeds, '{}') loop
    insert into consultation_statements (consultation_id, author_id, kind, body, status, moderated_by) values (v.id, auth.uid(), 'seed', s, 'approved', auth.uid());
  end loop;
  perform audit_write('consultation.create', 'consultation', v.ref, null, jsonb_build_object('status', v.status, 'seed_statements', coalesce(array_length(seeds, 1), 0)), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation then raise exception 'invalid consultation' using errcode = 'JK002', detail = 'question';
end $$;

create or replace function trg_consultation_opened(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v consultations%rowtype;
begin
  select * into v from consultations where id = p_id;
  perform notify_area_followers(v.constituency_id, 'consultation_opened', 'আপনার এলাকায় একটি মতামত যাচাই শুরু হয়েছে', 'নম্বর ' || v.ref,
    jsonb_build_object('ref', v.ref, 'en', jsonb_build_object('title', 'A consultation opened in your area', 'body', 'Reference ' || v.ref)), 'cons-open:' || v.ref, v.ref);
end $$;
revoke all on function trg_consultation_opened(uuid) from public, anon, authenticated;

-- Office: open. Needs at least 2 approved statements. Where the MP-approval rule applies it waits for the MP (or an administrator). ----------------
create or replace function open_consultation(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v consultations%rowtype; wait boolean; st text;
begin
  select * into v from consultations where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status <> 'draft' then raise exception 'only a draft can be opened' using errcode = 'JK001'; end if;
  if v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  if (select count(*) from consultation_statements where consultation_id = v.id and status = 'approved') < 2 then raise exception 'at least 2 statements are needed' using errcode = 'JK003', detail = 'statements'; end if;
  wait := approval_needed(v.constituency_id);
  st := case when wait then 'pending_approval' else 'open' end;
  update consultations set status = st, opened_at = case when st = 'open' then now() else null end where id = v.id;
  if st = 'open' then perform trg_consultation_opened(v.id);
  else perform notify_office(v.constituency_id, 'approve', 'approval_decision', 'একটি মতামত যাচাই অনুমোদনের অপেক্ষায়', 'নম্বর ' || v.ref,
    jsonb_build_object('ref', v.ref, 'en', jsonb_build_object('title', 'A consultation waits for your approval', 'body', 'Reference ' || v.ref)), 'cons-wait:' || v.ref, v.ref); end if;
  perform audit_write('consultation.' || case when wait then 'request_approval' else 'open' end, 'consultation', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', st));
  return jsonb_build_object('ref', v.ref, 'status', st);
end $$;

create or replace function decide_consultation(p_ref text, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v consultations%rowtype; ok boolean := (p_decision = 'approve');
begin
  select * into v from consultations where ref = p_ref for update;
  if not found or not (office_can(v.constituency_id, 'view', null) or is_admin()) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if not (office_can(v.constituency_id, 'approve', null) or is_admin()) then raise exception 'only the MP or an administrator can decide' using errcode = '42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if v.status <> 'pending_approval' then raise exception 'nothing waits for approval' using errcode = 'JK001'; end if;
  if not ok and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is required to reject' using errcode = 'JK002', detail = 'note'; end if;
  if ok and v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  update consultations set status = case when ok then 'open' else 'draft' end, opened_at = case when ok then now() else null end,
    approved_by = auth.uid(), approved_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = v.id;
  if ok then perform trg_consultation_opened(v.id); end if;
  perform audit_write('consultation.' || p_decision, 'consultation', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', case when ok then 'open' else 'draft' end));
  perform notify_user(v.created_by, 'approval_decision', case when ok then 'আপনার অনুরোধ অনুমোদিত হয়েছে' else 'আপনার অনুরোধ অনুমোদিত হয়নি' end, 'নম্বর ' || v.ref,
    jsonb_build_object('ref', v.ref, 'en', jsonb_build_object('title', case when ok then 'Your request was approved' else 'Your request was not approved' end, 'body', 'Reference ' || v.ref)), 'cons-appr:' || v.ref, v.ref);
  return jsonb_build_object('ref', v.ref, 'status', case when ok then 'open' else 'draft' end);
end $$;

create or replace function close_consultation(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v consultations%rowtype;
begin
  select * into v from consultations where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status not in ('open','draft','pending_approval') then raise exception 'cannot close from this status' using errcode = 'JK001'; end if;
  update consultations set status = case when v.status = 'open' then 'closed' else 'cancelled' end, closed_at = now() where id = v.id;
  perform audit_write('consultation.' || case when v.status = 'open' then 'close' else 'cancel' end, 'consultation', v.ref, jsonb_build_object('status', v.status), null);
  return jsonb_build_object('ref', v.ref, 'status', case when v.status = 'open' then 'closed' else 'cancelled' end);
end $$;

create or replace function close_due_consultations() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update consultations set status = 'closed', closed_at = now() where status = 'open' and closes_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function close_due_consultations() from public, anon, authenticated;
grant execute on function close_due_consultations() to service_role;

-- Citizens: add a statement (moderated) and vote ---------------------------------------------------------------------------------------------
create or replace function add_consultation_statement(p_ref text, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v consultations%rowtype; b text := btrim(coalesce(p_text, '')); s consultation_statements%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into v from consultations where ref = p_ref and status = 'open';
  if not found then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if v.closes_at <= now() then raise exception 'this consultation is closed' using errcode = 'JK003', detail = 'consultation_closed'; end if;
  if char_length(b) not between 5 and 140 then raise exception 'statement length' using errcode = 'JK002', detail = 'text'; end if;
  if (select count(*) from consultation_statements where consultation_id = v.id and author_id = uid and kind = 'citizen') >= 3 then raise exception 'statement limit for this consultation' using errcode = 'JK003', detail = 'statement_limit'; end if;
  if exists (select 1 from consultation_statements where consultation_id = v.id and lower(body) = lower(b)) then raise exception 'this statement already exists' using errcode = 'JK003', detail = 'duplicate'; end if;
  insert into consultation_statements (consultation_id, author_id, kind, body) values (v.id, uid, 'citizen', b) returning * into s;
  return jsonb_build_object('id', s.id, 'status', s.status);
end $$;

create or replace function moderate_consultation_statement(p_id uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s consultation_statements%rowtype; c consultations%rowtype;
begin
  select * into s from consultation_statements where id = p_id;
  if not found then raise exception 'statement not found' using errcode = 'JK404'; end if;
  select * into c from consultations where id = s.consultation_id;
  if not (office_can(c.constituency_id, 'publish', null) or is_moderator() or is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('approve','reject') then raise exception 'action' using errcode = 'JK002', detail = 'action'; end if;
  if p_action = 'reject' and char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is required' using errcode = 'JK002', detail = 'reason'; end if;
  if s.status <> 'pending_review' then raise exception 'already moderated' using errcode = 'JK003', detail = 'moderated'; end if;
  update consultation_statements set status = case when p_action = 'approve' then 'approved' else 'rejected' end, moderation_reason = nullif(btrim(coalesce(p_reason, '')), ''), moderated_by = auth.uid() where id = s.id;
  perform audit_write('consultation.statement.' || p_action, 'consultation', c.ref, null, jsonb_build_object('statement', s.id));
  return jsonb_build_object('id', s.id, 'status', case when p_action = 'approve' then 'approved' else 'rejected' end);
end $$;

create or replace function vote_consultation_statement(p_id uuid, p_vote text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s consultation_statements%rowtype; c consultations%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  if p_vote not in ('agree','disagree','pass') then raise exception 'vote' using errcode = 'JK002', detail = 'vote'; end if;
  select * into s from consultation_statements where id = p_id and status = 'approved';
  if not found then raise exception 'statement not found' using errcode = 'JK404'; end if;
  select * into c from consultations where id = s.consultation_id and status in ('open','closed','reported');
  if not found then raise exception 'statement not found' using errcode = 'JK404'; end if;
  if c.status <> 'open' or c.closes_at <= now() then raise exception 'this consultation is closed' using errcode = 'JK003', detail = 'consultation_closed'; end if;
  insert into statement_votes (statement_id, user_id, vote) values (s.id, uid, p_vote)
  on conflict (statement_id, user_id) do update set vote = excluded.vote, voted_at = now();
  return jsonb_build_object('statement_id', s.id, 'vote', p_vote);
end $$;

-- A citizen's own votes in one consultation (the only per-person read there is).
create or replace function my_consultation_votes(p_ref text) returns table (statement_id uuid, vote text)
language sql stable security definer set search_path = public as $$
  select v.statement_id, v.vote from statement_votes v join consultation_statements s on s.id = v.statement_id join consultations c on c.id = s.consultation_id
  where c.ref = p_ref and v.user_id = auth.uid() $$;
revoke all on function my_consultation_votes(text) from public, anon;
grant execute on function my_consultation_votes(text) to authenticated;

-- Office: the vote matrix for grouping. NO user ids: participants are numbered 1..n in an order unrelated to identity (md5 of id and ref).
create or replace function consultation_vote_matrix(p_ref text) returns table (participant integer, statement_id uuid, vote text)
language plpgsql stable security definer set search_path = public as $$
declare c consultations%rowtype;
begin
  select * into c from consultations where ref = p_ref;
  if not found or not (office_can(c.constituency_id, 'view_analytics', null) or is_admin()) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if c.status not in ('open','closed','reported') then raise exception 'no votes yet' using errcode = 'JK003', detail = 'not_open'; end if;
  return query
    select dense_rank() over (order by md5(v.user_id::text || c.ref))::int, v.statement_id, v.vote
    from statement_votes v join consultation_statements s on s.id = v.statement_id where s.consultation_id = c.id and s.status = 'approved'
    order by 1, 2;
end $$;
revoke all on function consultation_vote_matrix(text) from public, anon;
grant execute on function consultation_vote_matrix(text) to authenticated;

-- Office: store the generated aggregate (draft). Groups under the minimum size never reach the table. -----------------------------------------------
create or replace function save_consultation_report(p_ref text, p_participants integer, p_groups jsonb, p_agreement jsonb, p_ai_summary text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c consultations%rowtype; r consultation_reports%rowtype; kept jsonb; hidden integer; k constant integer := 5; shown boolean := coalesce(p_participants, 0) >= 5;
begin
  select * into c from consultations where ref = p_ref;
  if not found or not office_can(c.constituency_id, 'view', null) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if not office_can(c.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if c.status not in ('open','closed') then raise exception 'a report can be generated while open or after closing' using errcode = 'JK001'; end if;
  if exists (select 1 from consultation_reports where consultation_id = c.id and status = 'published') then raise exception 'already published' using errcode = 'JK003', detail = 'published'; end if;
  if jsonb_typeof(coalesce(p_groups, '[]')) <> 'array' or jsonb_typeof(coalesce(p_agreement, '[]')) <> 'array' then raise exception 'shape' using errcode = 'JK002', detail = 'groups'; end if;
  select coalesce(jsonb_agg(g), '[]') into kept from jsonb_array_elements(coalesce(p_groups, '[]')) g where coalesce((g ->> 'size')::int, 0) >= k;
  hidden := jsonb_array_length(coalesce(p_groups, '[]')) - jsonb_array_length(kept);
  insert into consultation_reports (consultation_id, participants, groups, agreement, hidden_groups, min_group_size, ai_summary, status, reviewed_by, reviewed_at, summary_bn, generated_at)
  values (c.id, greatest(coalesce(p_participants, 0), 0), case when shown then kept else '[]' end, case when shown then coalesce(p_agreement, '[]') else '[]' end, case when shown then hidden else 0 end, k,
          nullif(left(btrim(coalesce(p_ai_summary, '')), 2000), ''), 'draft', null, null, null, now())
  on conflict (consultation_id) do update set participants = excluded.participants, groups = excluded.groups, agreement = excluded.agreement, hidden_groups = excluded.hidden_groups,
    ai_summary = excluded.ai_summary, status = 'draft', reviewed_by = null, reviewed_at = null, summary_bn = null, generated_at = now()
  returning * into r;
  perform audit_write('consultation.report_generated', 'consultation', c.ref, null, jsonb_build_object('participants', r.participants, 'groups_shown', jsonb_array_length(r.groups), 'groups_hidden', r.hidden_groups, 'ai', p_ai_summary is not null));
  return jsonb_build_object('ref', c.ref, 'status', r.status, 'participants', r.participants, 'groups_shown', jsonb_array_length(r.groups), 'groups_hidden', r.hidden_groups, 'suppressed', not shown);
end $$;

-- Office: review (accept or edit the summary, add "you said, we did"), then publish. -------------------------------------------------------------
create or replace function review_consultation_report(p_ref text, p_summary text, p_you_said text, p_actions jsonb default '[]', p_publish boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c consultations%rowtype; r consultation_reports%rowtype; p record; n integer;
begin
  select * into c from consultations where ref = p_ref;
  if not found or not office_can(c.constituency_id, 'view', null) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  if not office_can(c.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from consultation_reports where consultation_id = c.id for update;
  if not found then raise exception 'generate the summary first' using errcode = 'JK003', detail = 'no_report'; end if;
  if r.status = 'published' then raise exception 'already published' using errcode = 'JK003', detail = 'published'; end if;
  if char_length(btrim(coalesce(p_summary, ''))) < 10 then raise exception 'the reviewed summary is required' using errcode = 'JK002', detail = 'summary'; end if;
  if jsonb_typeof(coalesce(p_actions, '[]')) <> 'array' or jsonb_array_length(coalesce(p_actions, '[]')) > 10 then raise exception 'actions' using errcode = 'JK002', detail = 'actions'; end if;
  if p_publish then
    if c.status <> 'closed' then raise exception 'close the consultation before publishing' using errcode = 'JK003', detail = 'not_closed'; end if;
    if char_length(btrim(coalesce(p_you_said, ''))) < 20 then raise exception 'the "you said, we did" text is required' using errcode = 'JK002', detail = 'you_said_we_did'; end if;
  end if;
  update consultation_reports set summary_bn = btrim(p_summary), you_said_we_did = nullif(btrim(coalesce(p_you_said, '')), ''), actions = coalesce(p_actions, '[]'),
    status = case when p_publish then 'published' else 'reviewed' end, reviewed_by = auth.uid(), reviewed_at = now(), published_at = case when p_publish then now() end where id = r.id;
  if p_publish then
    update consultations set status = 'reported' where id = c.id;
    n := 0;
    for p in select distinct x.user_id from (select v.user_id from statement_votes v join consultation_statements s on s.id = v.statement_id where s.consultation_id = c.id
                                              union select author_id from consultation_statements where consultation_id = c.id and author_id is not null) x loop
      if notify_user(p.user_id, 'consultation_report', 'আপনারা বললেন, যা করা হলো', 'নম্বর ' || c.ref,
          jsonb_build_object('ref', c.ref, 'en', jsonb_build_object('title', 'You said, we did: the consultation report is out', 'body', 'Reference ' || c.ref)), 'cons-rep:' || c.ref, c.ref) is not null then n := n + 1; end if;
    end loop;
    n := n + notify_area_followers(c.constituency_id, 'consultation_report', 'আপনারা বললেন, যা করা হলো', 'নম্বর ' || c.ref,
          jsonb_build_object('ref', c.ref, 'en', jsonb_build_object('title', 'You said, we did: the consultation report is out', 'body', 'Reference ' || c.ref)), 'cons-rep:' || c.ref, c.ref);
  end if;
  perform audit_write('consultation.report_' || case when p_publish then 'published' else 'reviewed' end, 'consultation', c.ref, jsonb_build_object('status', r.status), jsonb_build_object('status', case when p_publish then 'published' else 'reviewed' end));
  return jsonb_build_object('ref', c.ref, 'status', case when p_publish then 'published' else 'reviewed' end, 'notified', coalesce(n, 0));
end $$;

-- Office read of one consultation with its report draft and the statements waiting for moderation ------------------------------------------------
create or replace function consultation_office_view(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c consultations%rowtype; k integer;
begin
  select * into c from consultations where ref = p_ref;
  if not found or not (office_can(c.constituency_id, 'view', null) or is_admin()) then raise exception 'consultation not found' using errcode = 'JK404'; end if;
  select count(distinct v.user_id)::int into k from statement_votes v join consultation_statements s on s.id = v.statement_id where s.consultation_id = c.id;
  return jsonb_build_object('ref', c.ref, 'status', c.status, 'question', c.question, 'description', c.description, 'closes_at', c.closes_at, 'opened_at', c.opened_at,
    'participants', case when k >= 5 then k end, 'participants_suppressed', k < 5,
    'statements', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'text', s.body, 'kind', s.kind, 'status', s.status, 'reason', s.moderation_reason) order by s.created_at), '[]') from consultation_statements s where s.consultation_id = c.id),
    'report', (select jsonb_build_object('status', r.status, 'participants', r.participants, 'groups', r.groups, 'agreement', r.agreement, 'hidden_groups', r.hidden_groups, 'ai_summary', r.ai_summary, 'summary_bn', r.summary_bn,
               'you_said_we_did', r.you_said_we_did, 'actions', r.actions, 'generated_at', r.generated_at, 'published_at', r.published_at) from consultation_reports r where r.consultation_id = c.id));
end $$;

revoke all on function create_consultation(text, text, text, text[], timestamptz), open_consultation(text), decide_consultation(text, text, text), close_consultation(text),
  add_consultation_statement(text, text), moderate_consultation_statement(uuid, text, text), vote_consultation_statement(uuid, text),
  save_consultation_report(text, integer, jsonb, jsonb, text), review_consultation_report(text, text, text, jsonb, boolean), consultation_office_view(text) from public, anon;
grant execute on function create_consultation(text, text, text, text[], timestamptz), open_consultation(text), decide_consultation(text, text, text), close_consultation(text),
  add_consultation_statement(text, text), moderate_consultation_statement(uuid, text, text), vote_consultation_statement(uuid, text),
  save_consultation_report(text, integer, jsonb, jsonb, text), review_consultation_report(text, text, text, jsonb, boolean), consultation_office_view(text) to authenticated;

-- Office list (RLS decides what the caller sees) -- the table select policy above is enough; the API reads `consultations` directly.
