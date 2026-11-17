-- Phase 2.6-2.7 (masterplan §7.7, §7.8, §8.4): ideas with support and an office decision, and citizen questions with messages.
-- Writes go through SECURITY DEFINER functions (signed-in users hold no DELETE and no direct INSERT on these tables).
-- Public reads go through views that list only safe columns. Moderation (hide/restore) is in 0020.
-- Requires 0004-0015.

create sequence if not exists idea_ref_seq start 1000;
create sequence if not exists question_ref_seq start 1000;

-- "Verified account": active profile and a confirmed email or phone (one support per verified account).
create or replace function verified_account() returns boolean
language sql stable security definer set search_path = public as $$
  select app_role() is not null and exists (select 1 from auth.users u where u.id = auth.uid() and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) $$;
revoke all on function verified_account() from public, anon;
grant execute on function verified_account() to authenticated;

-- Ideas ---------------------------------------------------------------------------------------------------------------
create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('ID-' || to_char(now(), 'YYYY') || '-' || nextval('idea_ref_seq')),
  author_id uuid not null references profiles on delete cascade,
  constituency_id uuid not null references constituencies,
  category text check (category is null or category ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 5 and 120),
  body text not null check (char_length(body) between 10 and 2000),
  -- pending_review: waiting for a moderator; published: visible; under_consideration/planned/declined: the office decided; hidden: removed by moderation
  status text not null default 'pending_review' check (status in ('pending_review','published','under_consideration','planned','declined','hidden')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by uuid references profiles on delete set null,
  decided_at timestamptz,
  moderation_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_until timestamptz
);
create index if not exists ideas_constituency_idx on ideas (constituency_id, created_at desc);
create index if not exists ideas_author_idx on ideas (author_id);
create index if not exists ideas_trgm_idx on ideas using gin ((title || ' ' || body) gin_trgm_ops);

create table if not exists idea_supports (
  idea_id uuid not null references ideas on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
create index if not exists idea_supports_user_idx on idea_supports (user_id);

alter table ideas enable row level security;
alter table idea_supports enable row level security;
create or replace function idea_scope_can(p_constituency uuid, p_act text) returns boolean
language sql stable security definer set search_path = public as $$ select office_can(p_constituency, p_act, null) $$;
drop policy if exists ideas_select on ideas;
create policy ideas_select on ideas for select using (author_id = auth.uid() or idea_scope_can(constituency_id, 'view') or is_admin() or is_moderator());
drop policy if exists idea_supports_select on idea_supports;
create policy idea_supports_select on idea_supports for select using (user_id = auth.uid());
revoke all on ideas, idea_supports from anon, authenticated;
grant select on ideas, idea_supports to authenticated;

create or replace view public_ideas with (security_invoker = false) as
  select i.ref, c.key as constituency_key, i.category, i.title, i.body, i.status, i.decision_note, i.decided_at, i.created_at, i.is_demo,
         (select count(*)::int from idea_supports s where s.idea_id = i.id) as support_count
  from ideas i join constituencies c on c.id = i.constituency_id
  where i.status in ('published','under_consideration','planned','declined');
grant select on public_ideas to anon, authenticated;

-- Create: anti-spam is 5 ideas per user per day. Starts in pending_review (a moderator publishes it).
create or replace function create_idea(p_constituency text, p_category text, p_title text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c constituencies%rowtype; v ideas%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'unknown area' using errcode = 'JK002', detail = 'constituency'; end if;
  if p_category is not null and not exists (select 1 from issue_categories where slug = p_category and is_active) then
    raise exception 'unknown category' using errcode = 'JK002', detail = 'category';
  end if;
  if (select count(*) from ideas where author_id = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'daily idea limit reached' using errcode = 'JK003', detail = 'idea_limit';
  end if;
  if char_length(btrim(p_title)) not between 5 and 120 then raise exception 'title length' using errcode = 'JK002', detail = 'title'; end if;
  if char_length(btrim(p_body)) not between 10 and 2000 then raise exception 'body length' using errcode = 'JK002', detail = 'body'; end if;
  insert into ideas (author_id, constituency_id, category, title, body, is_demo) values (uid, c.id, p_category, btrim(p_title), btrim(p_body), c.is_demo) returning * into v;
  return jsonb_build_object('ref', v.ref, 'status', v.status);
end $$;

-- Support: one per verified account, not on your own idea, only on visible ideas. p_on false withdraws. Returns the public count.
create or replace function set_idea_support(p_ref text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v ideas%rowtype; n integer;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into v from ideas where ref = p_ref and status in ('published','under_consideration','planned');
  if not found then raise exception 'idea not found' using errcode = 'JK404'; end if;
  if p_on then
    if v.author_id = uid then raise exception 'your own idea' using errcode = 'JK003', detail = 'own_idea'; end if;
    insert into idea_supports (idea_id, user_id) values (v.id, uid) on conflict do nothing;
  else
    delete from idea_supports where idea_id = v.id and user_id = uid;
  end if;
  select count(*) into n from idea_supports where idea_id = v.id;
  return jsonb_build_object('ref', v.ref, 'supported', p_on, 'support_count', n);
end $$;

-- Office decision (needs the "decide" permission; a decline needs a note).
create or replace function decide_idea(p_ref text, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v ideas%rowtype; old_status text;
begin
  select * into v from ideas where ref = p_ref and status in ('published','under_consideration','planned','declined');
  if not found or not office_can(v.constituency_id, 'view', null) and not office_can(v.constituency_id, 'decide', null) then raise exception 'idea not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'decide', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_decision not in ('under_consideration','planned','declined') then raise exception 'invalid decision' using errcode = 'JK002', detail = 'decision'; end if;
  if p_decision = 'declined' and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a declined idea needs a reason' using errcode = 'JK002', detail = 'note'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'note too long' using errcode = 'JK002', detail = 'note'; end if;
  old_status := v.status;
  update ideas set status = p_decision, decision_note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now(), updated_at = now() where id = v.id;
  perform audit_write('idea.decision', 'idea', v.ref, jsonb_build_object('status', old_status), jsonb_build_object('status', p_decision), jsonb_build_object('note_given', p_note is not null));
  return jsonb_build_object('ref', v.ref, 'status', p_decision);
end $$;

-- Similar ideas in the same area (trigram similarity on title and body; works for Bangla and English text).
create or replace function similar_ideas(p_constituency text, p_text text, p_exclude text default null, p_limit integer default 5)
returns table (ref text, title text, support_count integer, score real)
language sql stable security definer set search_path = public as $$
  select i.ref, i.title, (select count(*)::int from idea_supports s where s.idea_id = i.id), similarity(i.title || ' ' || i.body, p_text)
  from ideas i join constituencies c on c.id = i.constituency_id
  where c.key = p_constituency and i.status in ('published','under_consideration','planned','declined')
    and i.ref is distinct from p_exclude and char_length(btrim(p_text)) between 5 and 2500
    and similarity(i.title || ' ' || i.body, p_text) >= 0.12
  order by 4 desc limit least(greatest(p_limit, 1), 10) $$;

revoke all on function create_idea(text, text, text, text), set_idea_support(text, boolean), decide_idea(text, text, text) from public, anon;
grant execute on function create_idea(text, text, text, text), set_idea_support(text, boolean), decide_idea(text, text, text) to authenticated;
revoke all on function similar_ideas(text, text, text, integer) from public;
grant execute on function similar_ideas(text, text, text, integer) to anon, authenticated;

-- Questions -----------------------------------------------------------------------------------------------------------
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('Q-' || to_char(now(), 'YYYY') || '-' || nextval('question_ref_seq')),
  asker_id uuid not null references profiles on delete cascade,
  constituency_id uuid not null references constituencies,
  visibility text not null check (visibility in ('private','public')),
  title text not null check (char_length(title) between 5 and 150),
  body text not null check (char_length(body) between 10 and 2000),
  -- pending_review: public question waiting for a moderator; open/answered/closed: normal flow; hidden: removed by moderation
  status text not null default 'open' check (status in ('pending_review','open','answered','closed','hidden')),
  assigned_to uuid references profiles on delete set null,
  moderation_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  retention_until timestamptz
);
create index if not exists questions_constituency_idx on questions (constituency_id, status, created_at desc);
create index if not exists questions_asker_idx on questions (asker_id, created_at desc);

create table if not exists question_messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions on delete cascade,
  author_id uuid references profiles on delete set null,
  author_kind text not null check (author_kind in ('citizen','office')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists question_messages_q_idx on question_messages (question_id, created_at);

create or replace function can_view_question(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from questions x where x.id = q and (x.asker_id = auth.uid() or office_can(x.constituency_id, 'view', x.assigned_to) or is_admin())) $$;

alter table questions enable row level security;
alter table question_messages enable row level security;
drop policy if exists questions_select on questions;
create policy questions_select on questions for select using (asker_id = auth.uid() or office_can(constituency_id, 'view', assigned_to) or is_admin());
drop policy if exists question_messages_select on question_messages;
create policy question_messages_select on question_messages for select using (can_view_question(question_id));
revoke all on questions, question_messages from anon, authenticated;
grant select on questions, question_messages to authenticated;

-- Public questions (moderated, so only once past review) and their thread. Private questions never appear here.
create or replace view public_questions with (security_invoker = false) as
  select q.ref, c.key as constituency_key, q.title, q.body, q.status, q.created_at, q.last_message_at, q.is_demo,
         (select count(*)::int from question_messages m where m.question_id = q.id) as message_count
  from questions q join constituencies c on c.id = q.constituency_id
  where q.visibility = 'public' and q.status in ('open','answered','closed');
create or replace view public_question_messages with (security_invoker = false) as
  select q.ref as question_ref, m.author_kind, m.body, m.created_at
  from question_messages m join questions q on q.id = m.question_id
  where q.visibility = 'public' and q.status in ('open','answered','closed');
grant select on public_questions, public_question_messages to anon, authenticated;

-- Ask: 3 per hour and 10 per day per user. Public questions wait for a moderator; private ones go straight to the office.
create or replace function ask_question(p_constituency text, p_visibility text, p_title text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c constituencies%rowtype; v questions%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'unknown area' using errcode = 'JK002', detail = 'constituency'; end if;
  if p_visibility not in ('private','public') then raise exception 'visibility' using errcode = 'JK002', detail = 'visibility'; end if;
  if char_length(btrim(p_title)) not between 5 and 150 then raise exception 'title length' using errcode = 'JK002', detail = 'title'; end if;
  if char_length(btrim(p_body)) not between 10 and 2000 then raise exception 'body length' using errcode = 'JK002', detail = 'body'; end if;
  if (select count(*) from questions where asker_id = uid and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from questions where asker_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'question limit reached' using errcode = 'JK003', detail = 'question_limit';
  end if;
  insert into questions (asker_id, constituency_id, visibility, title, body, status, is_demo)
  values (uid, c.id, p_visibility, btrim(p_title), btrim(p_body), case when p_visibility = 'public' then 'pending_review' else 'open' end, c.is_demo) returning * into v;
  return jsonb_build_object('ref', v.ref, 'status', v.status, 'visibility', v.visibility);
end $$;

-- Reply. The asker may write while the question is not closed or hidden (max 30 messages); the office needs the "update" permission.
create or replace function post_question_message(p_ref text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v questions%rowtype; kind text; b text := btrim(coalesce(p_body, ''));
begin
  select * into v from questions where ref = p_ref;
  if not found or not (v.asker_id = uid or office_can(v.constituency_id, 'view', v.assigned_to)) then raise exception 'question not found' using errcode = 'JK404'; end if;
  if char_length(b) not between 1 and 2000 then raise exception 'message length' using errcode = 'JK002', detail = 'body'; end if;
  if v.status in ('hidden','pending_review') then raise exception 'this question cannot take messages now' using errcode = 'JK003', detail = 'not_open'; end if;
  if v.asker_id = uid then
    if v.status = 'closed' then raise exception 'closed' using errcode = 'JK003', detail = 'closed'; end if;
    if (select count(*) from question_messages where question_id = v.id and author_kind = 'citizen') >= 30 then raise exception 'message limit' using errcode = 'JK003', detail = 'message_limit'; end if;
    if (select count(*) from question_messages where question_id = v.id and author_id = uid and created_at > now() - interval '10 minutes') >= 5 then
      raise exception 'slow down' using errcode = 'JK003', detail = 'message_rate';
    end if;
    kind := 'citizen';
  else
    if not office_can(v.constituency_id, 'update', v.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
    kind := 'office';
  end if;
  insert into question_messages (question_id, author_id, author_kind, body) values (v.id, uid, kind, b);
  update questions set last_message_at = now(), updated_at = now(), status = case when kind = 'office' then 'answered' else 'open' end where id = v.id;
  return jsonb_build_object('ref', v.ref, 'status', case when kind = 'office' then 'answered' else 'open' end);
end $$;

-- Assignment (office manager): the assignee must be an active member of the office. p_assignee null un-assigns.
create or replace function assign_question(p_ref text, p_assignee uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v questions%rowtype;
begin
  select * into v from questions where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', v.assigned_to) then raise exception 'question not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'assign', v.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_assignee is not null and not exists (select 1 from office_members m where m.user_id = p_assignee and m.constituency_id = v.constituency_id and m.status = 'active') then
    raise exception 'assignee is not an active member of this office' using errcode = 'JK002', detail = 'assignee';
  end if;
  update questions set assigned_to = p_assignee, updated_at = now() where id = v.id;
  perform audit_write('question.assign', 'question', v.ref, jsonb_build_object('assigned_to', v.assigned_to), jsonb_build_object('assigned_to', p_assignee));
  return jsonb_build_object('ref', v.ref, 'assigned_to', p_assignee);
end $$;

-- Close (the asker, or the office with the "update" permission).
create or replace function close_question(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v questions%rowtype;
begin
  select * into v from questions where ref = p_ref;
  if not found or not (v.asker_id = auth.uid() or office_can(v.constituency_id, 'view', v.assigned_to)) then raise exception 'question not found' using errcode = 'JK404'; end if;
  if v.asker_id is distinct from auth.uid() and not office_can(v.constituency_id, 'update', v.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status in ('hidden', 'pending_review') then raise exception 'cannot close now' using errcode = 'JK003', detail = 'not_open'; end if;
  update questions set status = 'closed', updated_at = now() where id = v.id;
  return jsonb_build_object('ref', v.ref, 'status', 'closed');
end $$;

revoke all on function ask_question(text, text, text, text), post_question_message(text, text), assign_question(text, uuid), close_question(text) from public, anon;
grant execute on function ask_question(text, text, text, text), post_question_message(text, text), assign_question(text, uuid), close_question(text) to authenticated;
