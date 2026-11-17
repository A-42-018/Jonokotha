-- Phase 7 (B7.6, B7.7, B7.8; masterplan §4.3, §3.3): surveys and satisfaction summaries, the commitment tracker, and community priority ranking.
-- Requires 0070, 0071. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 7 status):
--   * Polls from B5.5 already accept any verified account, so "opened to citizens" is met there; this file adds multi-question SURVEYS (rating and
--     fixed-choice questions only: no free text, so nothing to moderate and no personal data) and a PUBLIC satisfaction summary built from the
--     existing after-closure ratings (issue_feedback). Every public figure needs 5 or more people.
--   * A commitment is the office's own promise. Where an area requires MP approval and an MP is active, publishing waits for the MP (B5.1 rule).
--     Status changes are an append-only history; "delivered" needs evidence, "delayed" and "dropped" need a public reason.
--   * Community priorities are NON-BINDING and say so in every response. One ranking per verified local account (verified and following the
--     area) per round, 1 to 5 needs in order, replaceable until the round closes. Only aggregate points are returned, only with 5+ participants.

-- Surveys ---------------------------------------------------------------------------------------------------------------------------------------------
create sequence if not exists survey_ref_seq start 1000;
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('SV-' || to_char(now(), 'YYYY') || '-' || nextval('survey_ref_seq')),
  constituency_id uuid not null references constituencies,
  created_by uuid references profiles on delete set null,
  title text not null check (char_length(title) between 5 and 150),
  description text check (description is null or char_length(description) <= 600),
  status text not null default 'draft' check (status in ('draft','open','closed','cancelled')),
  closes_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys on delete cascade,
  position integer not null check (position between 1 and 8),
  kind text not null check (kind in ('rating','choice')),
  prompt text not null check (char_length(prompt) between 5 and 200),
  options text[] not null default '{}',
  unique (survey_id, position),
  check ((kind = 'rating' and cardinality(options) = 0) or (kind = 'choice' and cardinality(options) between 2 and 8))
);
create table if not exists survey_responses (
  survey_id uuid not null references surveys on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (survey_id, user_id)
);
create index if not exists surveys_scope_idx on surveys (constituency_id, status, created_at desc);
alter table surveys enable row level security;
alter table survey_questions enable row level security;
alter table survey_responses enable row level security;
drop policy if exists surveys_select on surveys;
create policy surveys_select on surveys for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists survey_questions_select on survey_questions;
create policy survey_questions_select on survey_questions for select using (exists (select 1 from surveys s where s.id = survey_id and (office_can(s.constituency_id, 'view', null) or is_admin())));
drop policy if exists survey_responses_select on survey_responses;
create policy survey_responses_select on survey_responses for select using (user_id = auth.uid());
revoke all on surveys, survey_questions, survey_responses from anon, authenticated;
grant select on surveys, survey_questions, survey_responses to authenticated;

create or replace view public_surveys with (security_invoker = false) as
  select s.ref, c.key as constituency_key, s.title, s.description, s.status, s.closes_at, s.opened_at, s.closed_at, s.is_demo
  from surveys s join constituencies c on c.id = s.constituency_id where s.status in ('open','closed');
create or replace view public_survey_questions with (security_invoker = false) as
  select s.ref as survey_ref, q.id, q.position, q.kind, q.prompt, q.options
  from survey_questions q join surveys s on s.id = q.survey_id where s.status in ('open','closed');
grant select on public_surveys, public_survey_questions to anon, authenticated;

-- p_questions: [{"kind":"rating","prompt":"..."},{"kind":"choice","prompt":"...","options":["a","b"]}]
create or replace function create_survey(p_constituency text, p_title text, p_description text, p_questions jsonb, p_closes_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v surveys%rowtype; q jsonb; i integer := 0; opts text[];
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 8 then raise exception 'a survey needs 1 to 8 questions' using errcode = 'JK002', detail = 'questions'; end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'closing time must be in the future' using errcode = 'JK002', detail = 'closes_at'; end if;
  insert into surveys (constituency_id, created_by, title, description, closes_at, is_demo) values (c.id, auth.uid(), btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_closes_at, c.is_demo) returning * into v;
  for q in select * from jsonb_array_elements(p_questions) loop
    i := i + 1;
    select coalesce(array_agg(btrim(x)), '{}') into opts from jsonb_array_elements_text(coalesce(q -> 'options', '[]')) x;
    insert into survey_questions (survey_id, position, kind, prompt, options) values (v.id, i, q ->> 'kind', btrim(q ->> 'prompt'), case when q ->> 'kind' = 'choice' then opts else '{}' end);
  end loop;
  perform audit_write('survey.create', 'survey', v.ref, null, jsonb_build_object('questions', i), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation or not_null_violation then raise exception 'invalid survey' using errcode = 'JK002', detail = 'questions';
end $$;

create or replace function set_survey_status(p_ref text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v surveys%rowtype;
begin
  select * into v from surveys where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'survey not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not ((v.status = 'draft' and p_status in ('open','cancelled')) or (v.status = 'open' and p_status in ('closed','cancelled'))) then raise exception 'invalid status change' using errcode = 'JK001'; end if;
  if p_status = 'open' and v.closes_at is not null and v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  update surveys set status = p_status, opened_at = case when p_status = 'open' then now() else opened_at end, closed_at = case when p_status = 'closed' then now() else closed_at end where id = v.id;
  perform audit_write('survey.' || p_status, 'survey', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ref', v.ref, 'status', p_status);
end $$;

-- p_answers: {"<question id>": 4, "<question id>": "option text"}; every question must be answered.
create or replace function submit_survey_response(p_ref text, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v surveys%rowtype; q survey_questions%rowtype; a jsonb;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into v from surveys where ref = p_ref and status in ('open','closed');
  if not found then raise exception 'survey not found' using errcode = 'JK404'; end if;
  if v.status <> 'open' or (v.closes_at is not null and v.closes_at <= now()) then raise exception 'this survey is closed' using errcode = 'JK003', detail = 'survey_closed'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'answers' using errcode = 'JK002', detail = 'answers'; end if;
  for q in select * from survey_questions where survey_id = v.id order by position loop
    a := p_answers -> q.id::text;
    if a is null then raise exception 'every question needs an answer' using errcode = 'JK002', detail = 'answers'; end if;
    if q.kind = 'rating' and not (jsonb_typeof(a) = 'number' and (a #>> '{}') ~ '^[1-5]$') then raise exception 'rating 1 to 5' using errcode = 'JK002', detail = 'answers'; end if;
    if q.kind = 'choice' and not (jsonb_typeof(a) = 'string' and (a #>> '{}') = any (q.options)) then raise exception 'choose one of the options' using errcode = 'JK002', detail = 'answers'; end if;
  end loop;
  if (select count(*) from jsonb_object_keys(p_answers)) <> (select count(*) from survey_questions where survey_id = v.id) then raise exception 'unknown question' using errcode = 'JK002', detail = 'answers'; end if;
  insert into survey_responses (survey_id, user_id, answers) values (v.id, uid, p_answers) on conflict (survey_id, user_id) do nothing;
  if not found then raise exception 'you already answered' using errcode = 'JK003', detail = 'already_answered'; end if;
  return jsonb_build_object('ref', v.ref, 'submitted', true);
end $$;

-- Results: office and admin always; everyone else only after the survey closes and with at least 5 respondents.
create or replace function survey_results(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v surveys%rowtype; staff boolean; total integer; show boolean;
begin
  select * into v from surveys where ref = p_ref;
  staff := found and (office_can(v.constituency_id, 'view', null) or is_admin());
  if not found or (v.status not in ('open','closed') and not staff) then raise exception 'survey not found' using errcode = 'JK404'; end if;
  select count(*)::int into total from survey_responses where survey_id = v.id;
  show := staff or (v.status = 'closed' and total >= 5);
  return jsonb_build_object('ref', v.ref, 'status', v.status, 'respondents', case when show or total >= 5 then total end, 'results_shown', show,
    'note', case when show then null when v.status <> 'closed' then 'Results are shown after the survey closes.' else 'Results appear once at least 5 people have answered.' end,
    'questions', case when show then (select jsonb_agg(jsonb_build_object('id', q.id, 'position', q.position, 'kind', q.kind, 'prompt', q.prompt,
        'average', case when q.kind = 'rating' then (select round(avg((r.answers ->> q.id::text)::int)::numeric, 2) from survey_responses r where r.survey_id = v.id) end,
        'counts', (select coalesce(jsonb_object_agg(k, n), '{}') from (select r.answers ->> q.id::text as k, count(*)::int n from survey_responses r where r.survey_id = v.id group by 1) z)) order by q.position)
      from survey_questions q where q.survey_id = v.id) end);
end $$;
grant execute on function survey_results(text) to anon, authenticated;

create or replace function close_due_surveys() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update surveys set status = 'closed', closed_at = now() where status = 'open' and closes_at is not null and closes_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function close_due_surveys() from public, anon, authenticated;
grant execute on function close_due_surveys() to service_role;

-- Satisfaction after closure: public aggregate of the existing ratings (issue_feedback). Fewer than 5 ratings -> nothing but the fact. -----------------------
create or replace function satisfaction_summary(p_constituency text, p_days integer default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; n integer; avg_r numeric; dist jsonb;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if p_days not between 1 and 730 then raise exception 'days' using errcode = 'JK002', detail = 'days'; end if;
  select count(*)::int, avg(f.rating) into n, avg_r from issue_feedback f join issues i on i.id = f.issue_id where i.constituency_id = c.id and f.created_at >= now() - make_interval(days => p_days);
  select coalesce(jsonb_object_agg(r, k), '{}') into dist from (select f.rating r, count(*)::int k from issue_feedback f join issues i on i.id = f.issue_id
    where i.constituency_id = c.id and f.created_at >= now() - make_interval(days => p_days) group by 1) z;
  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'days', p_days, 'ratings', case when n >= 5 then n end, 'suppressed', n < 5,
    'average', case when n >= 5 then round(avg_r, 2) end, 'distribution', case when n >= 5 then dist end, 'last_updated', now(),
    'definition', 'Ratings (1 to 5) given by reporters after their case was resolved, for cases in this area, in the period. Shown only with 5 or more ratings. Not a ranking.');
end $$;
revoke all on function satisfaction_summary(text, integer) from public;
grant execute on function satisfaction_summary(text, integer) to anon, authenticated;

-- Commitments --------------------------------------------------------------------------------------------------------------------------------------
create sequence if not exists commitment_ref_seq start 1000;
create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('CM-' || to_char(now(), 'YYYY') || '-' || nextval('commitment_ref_seq')),
  constituency_id uuid not null references constituencies,
  title text not null check (char_length(title) between 5 and 150),
  description text check (description is null or char_length(description) <= 1500),
  status text not null default 'draft' check (status in ('draft','pending_approval','planned','in_progress','delivered','delayed','dropped')),
  due_date date,
  announcement_id uuid references announcements on delete set null,
  project_id uuid references projects on delete set null,
  idea_id uuid references ideas on delete set null,
  created_by uuid references profiles on delete set null,
  published_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists commitment_events (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references commitments on delete cascade,
  from_status text,
  to_status text not null,
  note text check (note is null or char_length(note) <= 500),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://' and char_length(evidence_url) <= 500),
  evidence_text text check (evidence_text is null or char_length(evidence_text) <= 500),
  actor_id uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists commitments_scope_idx on commitments (constituency_id, status, created_at desc);
create index if not exists commitment_events_idx on commitment_events (commitment_id, created_at);
alter table commitments enable row level security;
alter table commitment_events enable row level security;
drop policy if exists commitments_select on commitments;
create policy commitments_select on commitments for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists commitment_events_select on commitment_events;
create policy commitment_events_select on commitment_events for select using (exists (select 1 from commitments c where c.id = commitment_id and (office_can(c.constituency_id, 'view', null) or is_admin())));
revoke all on commitments, commitment_events from anon, authenticated;
grant select on commitments, commitment_events to authenticated;
-- The history cannot be edited or erased by anyone, including the owner role through the API. Only a cascade from deleting the whole commitment
-- (trigger depth above 1; users hold no delete right on commitments) may remove rows, so test and administrative cleanup of an area still works.
create or replace function commitment_events_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'commitment history is append-only' using errcode = '42501';
end $$;
drop trigger if exists commitment_events_immutable_trg on commitment_events;
create trigger commitment_events_immutable_trg before update or delete on commitment_events for each row execute function commitment_events_immutable();

create or replace view public_commitments with (security_invoker = false) as
  select m.ref, c.key as constituency_key, m.title, m.description, m.status, m.due_date, m.published_at, m.updated_at, m.is_demo,
         a.ref as announcement_ref, p.ref as project_ref, i.ref as idea_ref,
         'office_commitment'::text as label
  from commitments m join constituencies c on c.id = m.constituency_id
  left join announcements a on a.id = m.announcement_id and a.status = 'published'
  left join projects p on p.id = m.project_id
  left join ideas i on i.id = m.idea_id and i.status in ('published','under_consideration','planned','declined')
  where m.status in ('planned','in_progress','delivered','delayed','dropped');
create or replace view public_commitment_events with (security_invoker = false) as
  select m.ref as commitment_ref, e.from_status, e.to_status, e.note, e.evidence_url, e.evidence_text, e.created_at
  from commitment_events e join commitments m on m.id = e.commitment_id where m.status in ('planned','in_progress','delivered','delayed','dropped') and e.to_status <> 'pending_approval';
grant select on public_commitments, public_commitment_events to anon, authenticated;

create or replace function create_commitment(p_constituency text, p_title text, p_description text, p_due date, p_announcement text default null, p_project text default null, p_idea text default null, p_publish boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v commitments%rowtype; aid uuid; pid uuid; iid uuid; st text; wait boolean;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_announcement is not null then select id into aid from announcements where ref = p_announcement and constituency_id = c.id; if aid is null then raise exception 'announcement' using errcode = 'JK002', detail = 'announcement'; end if; end if;
  if p_project is not null then select id into pid from projects where ref = p_project and constituency_id = c.id; if pid is null then raise exception 'project' using errcode = 'JK002', detail = 'project'; end if; end if;
  if p_idea is not null then select id into iid from ideas where ref = p_idea and constituency_id = c.id; if iid is null then raise exception 'idea' using errcode = 'JK002', detail = 'idea'; end if; end if;
  wait := p_publish and approval_needed(c.id);
  st := case when not p_publish then 'draft' when wait then 'pending_approval' else 'planned' end;
  insert into commitments (constituency_id, title, description, status, due_date, announcement_id, project_id, idea_id, created_by, published_at, is_demo)
  values (c.id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), st, p_due, aid, pid, iid, auth.uid(), case when st = 'planned' then now() end, c.is_demo) returning * into v;
  insert into commitment_events (commitment_id, from_status, to_status, note, actor_id) values (v.id, null, st, 'created', auth.uid());
  if wait then perform notify_office(c.id, 'approve', 'approval_decision', 'একটি প্রতিশ্রুতি অনুমোদনের অপেক্ষায়', 'নম্বর ' || v.ref,
    jsonb_build_object('ref', v.ref, 'en', jsonb_build_object('title', 'A commitment waits for your approval', 'body', 'Reference ' || v.ref)), 'cm-wait:' || v.ref, v.ref); end if;
  perform audit_write('commitment.' || case when wait then 'request_approval' when p_publish then 'publish' else 'draft' end, 'commitment', v.ref, null, jsonb_build_object('status', st), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', st);
exception when check_violation then raise exception 'invalid commitment' using errcode = 'JK002', detail = 'title';
end $$;

create or replace function decide_commitment(p_ref text, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v commitments%rowtype; ok boolean := (p_decision = 'approve');
begin
  select * into v from commitments where ref = p_ref for update;
  if not found or not (office_can(v.constituency_id, 'view', null) or is_admin()) then raise exception 'commitment not found' using errcode = 'JK404'; end if;
  if not (office_can(v.constituency_id, 'approve', null) or is_admin()) then raise exception 'only the MP or an administrator can decide' using errcode = '42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if v.status <> 'pending_approval' then raise exception 'nothing waits for approval' using errcode = 'JK001'; end if;
  if not ok and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is required to reject' using errcode = 'JK002', detail = 'note'; end if;
  update commitments set status = case when ok then 'planned' else 'draft' end, published_at = case when ok then now() end, updated_at = now() where id = v.id;
  insert into commitment_events (commitment_id, from_status, to_status, note, actor_id) values (v.id, 'pending_approval', case when ok then 'planned' else 'draft' end, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  perform audit_write('commitment.' || p_decision, 'commitment', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', case when ok then 'planned' else 'draft' end));
  perform notify_user(v.created_by, 'approval_decision', case when ok then 'আপনার অনুরোধ অনুমোদিত হয়েছে' else 'আপনার অনুরোধ অনুমোদিত হয়নি' end, 'নম্বর ' || v.ref,
    jsonb_build_object('ref', v.ref, 'en', jsonb_build_object('title', case when ok then 'Your request was approved' else 'Your request was not approved' end, 'body', 'Reference ' || v.ref)), 'cm-appr:' || v.ref, v.ref);
  return jsonb_build_object('ref', v.ref, 'status', case when ok then 'planned' else 'draft' end);
end $$;

create or replace function update_commitment_status(p_ref text, p_status text, p_note text default null, p_evidence_url text default null, p_evidence_text text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v commitments%rowtype; n text := nullif(btrim(coalesce(p_note, '')), ''); et text := nullif(btrim(coalesce(p_evidence_text, '')), '');
begin
  select * into v from commitments where ref = p_ref for update;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'commitment not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status not in ('planned','in_progress','delayed') then raise exception 'this commitment cannot change status from here' using errcode = 'JK001'; end if;
  if p_status not in ('in_progress','delivered','delayed','dropped') or p_status = v.status then raise exception 'invalid status change' using errcode = 'JK001'; end if;
  if p_status = 'delivered' and p_evidence_url is null and char_length(coalesce(et, '')) < 10 then raise exception 'evidence is required' using errcode = 'JK002', detail = 'evidence'; end if;
  if p_status in ('delayed','dropped') and char_length(coalesce(n, '')) < 10 then raise exception 'a public reason is required' using errcode = 'JK002', detail = 'note'; end if;
  update commitments set status = p_status, updated_at = now() where id = v.id;
  insert into commitment_events (commitment_id, from_status, to_status, note, evidence_url, evidence_text, actor_id) values (v.id, v.status, p_status, n, nullif(btrim(coalesce(p_evidence_url, '')), ''), et, auth.uid());
  perform audit_write('commitment.status', 'commitment', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ref', v.ref, 'status', p_status);
exception when check_violation then raise exception 'invalid evidence' using errcode = 'JK002', detail = 'evidence';
end $$;

-- Community priority ranking ------------------------------------------------------------------------------------------------------------------------
create sequence if not exists priority_ref_seq start 1000;
create table if not exists priority_rounds (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PY-' || to_char(now(), 'YYYY') || '-' || nextval('priority_ref_seq')),
  constituency_id uuid not null references constituencies,
  created_by uuid references profiles on delete set null,
  title text not null check (char_length(title) between 5 and 150),
  description text check (description is null or char_length(description) <= 600),
  status text not null default 'draft' check (status in ('draft','open','closed','cancelled')),
  closes_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists priority_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references priority_rounds on delete cascade,
  position integer not null check (position between 1 and 12),
  label text not null check (char_length(label) between 3 and 100),
  unique (round_id, position)
);
create table if not exists priority_ranks (
  round_id uuid not null references priority_rounds on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  item_id uuid not null references priority_items on delete cascade,
  rank integer not null check (rank between 1 and 5),
  ranked_at timestamptz not null default now(),
  primary key (round_id, user_id, rank),
  unique (round_id, user_id, item_id)
);
alter table priority_rounds enable row level security;
alter table priority_items enable row level security;
alter table priority_ranks enable row level security;
drop policy if exists priority_rounds_select on priority_rounds;
create policy priority_rounds_select on priority_rounds for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists priority_items_select on priority_items;
create policy priority_items_select on priority_items for select using (exists (select 1 from priority_rounds r where r.id = round_id and (office_can(r.constituency_id, 'view', null) or is_admin())));
drop policy if exists priority_ranks_select on priority_ranks;
create policy priority_ranks_select on priority_ranks for select using (user_id = auth.uid());
revoke all on priority_rounds, priority_items, priority_ranks from anon, authenticated;
grant select on priority_rounds, priority_items, priority_ranks to authenticated;

create or replace view public_priority_rounds with (security_invoker = false) as
  select r.ref, c.key as constituency_key, r.title, r.description, r.status, r.closes_at, r.opened_at, r.closed_at, r.is_demo, 'non_binding'::text as label
  from priority_rounds r join constituencies c on c.id = r.constituency_id where r.status in ('open','closed');
create or replace view public_priority_items with (security_invoker = false) as
  select r.ref as round_ref, i.id, i.position, i.label from priority_items i join priority_rounds r on r.id = i.round_id where r.status in ('open','closed');
grant select on public_priority_rounds, public_priority_items to anon, authenticated;

create or replace function create_priority_round(p_constituency text, p_title text, p_description text, p_items text[], p_closes_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v priority_rounds%rowtype; opts text[]; i integer;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  select array_agg(btrim(x)) into opts from unnest(coalesce(p_items, '{}')) x where btrim(x) <> '';
  if coalesce(array_length(opts, 1), 0) not between 3 and 12 or (select count(distinct lower(x)) from unnest(opts) x) <> array_length(opts, 1) then raise exception 'a round needs 3 to 12 different needs' using errcode = 'JK002', detail = 'items'; end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'closing time must be in the future' using errcode = 'JK002', detail = 'closes_at'; end if;
  insert into priority_rounds (constituency_id, created_by, title, description, closes_at, is_demo) values (c.id, auth.uid(), btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_closes_at, c.is_demo) returning * into v;
  for i in 1 .. array_length(opts, 1) loop insert into priority_items (round_id, position, label) values (v.id, i, opts[i]); end loop;
  perform audit_write('priority_round.create', 'priority_round', v.ref, null, jsonb_build_object('items', array_length(opts, 1)), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status, 'label', 'non_binding');
exception when check_violation then raise exception 'invalid round' using errcode = 'JK002', detail = 'title';
end $$;

create or replace function set_priority_status(p_ref text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v priority_rounds%rowtype;
begin
  select * into v from priority_rounds where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'round not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not ((v.status = 'draft' and p_status in ('open','cancelled')) or (v.status = 'open' and p_status in ('closed','cancelled'))) then raise exception 'invalid status change' using errcode = 'JK001'; end if;
  if p_status = 'open' and v.closes_at is not null and v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  update priority_rounds set status = p_status, opened_at = case when p_status = 'open' then now() else opened_at end, closed_at = case when p_status = 'closed' then now() else closed_at end where id = v.id;
  perform audit_write('priority_round.' || p_status, 'priority_round', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ref', v.ref, 'status', p_status);
end $$;

create or replace function submit_priority_ranking(p_ref text, p_items uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v priority_rounds%rowtype; i integer;
begin
  select * into v from priority_rounds where ref = p_ref and status in ('open','closed');
  if not found then raise exception 'round not found' using errcode = 'JK404'; end if;
  if uid is null or not local_verified_account(v.constituency_id) then raise exception 'a verified account that follows this area is needed' using errcode = '42501'; end if;
  if v.status <> 'open' or (v.closes_at is not null and v.closes_at <= now()) then raise exception 'this round is closed' using errcode = 'JK003', detail = 'round_closed'; end if;
  if coalesce(array_length(p_items, 1), 0) not between 1 and 5 or (select count(distinct x) from unnest(p_items) x) <> array_length(p_items, 1) then raise exception 'rank 1 to 5 different needs' using errcode = 'JK002', detail = 'items'; end if;
  if (select count(*) from priority_items where round_id = v.id and id = any (p_items)) <> array_length(p_items, 1) then raise exception 'unknown need' using errcode = 'JK002', detail = 'items'; end if;
  delete from priority_ranks where round_id = v.id and user_id = uid;
  for i in 1 .. array_length(p_items, 1) loop insert into priority_ranks (round_id, user_id, item_id, rank) values (v.id, uid, p_items[i], i); end loop;
  return jsonb_build_object('ref', v.ref, 'ranked', array_length(p_items, 1), 'label', 'non_binding');
end $$;

-- Aggregate points (rank 1 = 5 points ... rank 5 = 1 point). Office and admin always; everyone else after the round closes, with 5+ participants.
create or replace function priority_results(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v priority_rounds%rowtype; staff boolean; total integer; show boolean;
begin
  select * into v from priority_rounds where ref = p_ref;
  staff := found and (office_can(v.constituency_id, 'view', null) or is_admin());
  if not found or (v.status not in ('open','closed') and not staff) then raise exception 'round not found' using errcode = 'JK404'; end if;
  select count(distinct user_id)::int into total from priority_ranks where round_id = v.id;
  show := staff or (v.status = 'closed' and total >= 5);
  return jsonb_build_object('ref', v.ref, 'status', v.status, 'label', 'non_binding', 'participants', case when show or total >= 5 then total end, 'results_shown', show,
    'note', 'Non-binding: this shows what participants said matters to them. It is not a decision, a vote on spending or a promise.' || case when show then '' when v.status <> 'closed' then ' Results are shown after the round closes.' else ' Results appear once at least 5 people have ranked.' end,
    'items', case when show then (select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.label, 'points', x.pts, 'first_choice', x.firsts) order by x.pts desc, x.position)
      from (select i.id, i.label, i.position, coalesce(sum(6 - k.rank), 0)::int pts, count(*) filter (where k.rank = 1)::int firsts from priority_items i left join priority_ranks k on k.item_id = i.id where i.round_id = v.id group by i.id) x) end);
end $$;
grant execute on function priority_results(text) to anon, authenticated;

create or replace function close_due_priority_rounds() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update priority_rounds set status = 'closed', closed_at = now() where status = 'open' and closes_at is not null and closes_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function close_due_priority_rounds() from public, anon, authenticated;
grant execute on function close_due_priority_rounds() to service_role;

revoke all on function create_survey(text, text, text, jsonb, timestamptz), set_survey_status(text, text), submit_survey_response(text, jsonb),
  create_commitment(text, text, text, date, text, text, text, boolean), decide_commitment(text, text, text), update_commitment_status(text, text, text, text, text),
  create_priority_round(text, text, text, text[], timestamptz), set_priority_status(text, text), submit_priority_ranking(text, uuid[]) from public, anon;
grant execute on function create_survey(text, text, text, jsonb, timestamptz), set_survey_status(text, text), submit_survey_response(text, jsonb),
  create_commitment(text, text, text, date, text, text, text, boolean), decide_commitment(text, text, text), update_commitment_status(text, text, text, text, text),
  create_priority_round(text, text, text, text[], timestamptz), set_priority_status(text, text), submit_priority_ranking(text, uuid[]) to authenticated;
