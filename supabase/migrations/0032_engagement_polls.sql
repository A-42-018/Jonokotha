-- Phase 5 (B5.5, B5.6; masterplan §4.2, §7.3, §7.4, §8.5, §12, §21.2): idea comments, polls, constituency snapshot, project feedback,
-- follows for projects and representatives, and the extra report fields (duration, who is affected, video).
-- Requires 0030, 0031. Safe to run twice.

-- Idea comments ---------------------------------------------------------------------------------------------------------------------
-- Comments publish at once (post-moderation): any verified account may comment on a PUBLIC idea, 10 a day; anyone with a verified account
-- may report a comment; moderators hide or restore it with a reason. Personal data is removed before storage (API layer).
create table if not exists idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas on delete cascade,
  author_id uuid not null references profiles on delete cascade,
  body text not null check (char_length(body) between 2 and 500),
  status text not null default 'published' check (status in ('published','hidden')),
  moderation_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idea_comments_idea_idx on idea_comments (idea_id, created_at);
create index if not exists idea_comments_author_idx on idea_comments (author_id, created_at desc);
alter table idea_comments enable row level security;
drop policy if exists idea_comments_select on idea_comments;
create policy idea_comments_select on idea_comments for select
  using (author_id = auth.uid() or is_moderator() or is_admin()
         or exists (select 1 from ideas i where i.id = idea_id and idea_scope_can(i.constituency_id, 'view')));
revoke all on idea_comments from anon, authenticated;
grant select on idea_comments to authenticated;

create or replace view public_idea_comments with (security_invoker = false) as
  select c.id, i.ref as idea_ref, c.body, c.created_at
  from idea_comments c join ideas i on i.id = c.idea_id
  where c.status = 'published' and i.status in ('published','under_consideration','planned','declined');
grant select on public_idea_comments to anon, authenticated;

create or replace function create_idea_comment(p_idea text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); i ideas%rowtype; v idea_comments%rowtype; b text := btrim(coalesce(p_body, ''));
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into i from ideas where ref = p_idea and status in ('published','under_consideration','planned','declined');
  if not found then raise exception 'idea not found' using errcode = 'JK404'; end if;
  if char_length(b) not between 2 and 500 then raise exception 'comment length' using errcode = 'JK002', detail = 'body'; end if;
  if (select count(*) from idea_comments where author_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily comment limit reached' using errcode = 'JK003', detail = 'comment_limit';
  end if;
  insert into idea_comments (idea_id, author_id, body) values (i.id, uid, b) returning * into v;
  return jsonb_build_object('id', v.id, 'idea', i.ref, 'status', v.status);
end $$;

-- Report and moderation: ideas' comments join the existing queue (target_type 'idea_comment', ref = comment id). -----------------------
alter table moderation_reports drop constraint if exists moderation_reports_target_type_check;
alter table moderation_reports add constraint moderation_reports_target_type_check check (target_type in ('issue','idea','question','media','idea_comment'));

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
    when 'idea_comment' then exists (select 1 from public_idea_comments c where c.id::text = p_ref)
    else false end;
  if not ok then raise exception 'content not found' using errcode = 'JK404'; end if;
  insert into moderation_reports (reporter_id, target_type, target_ref, reason_code, details) values (uid, p_type, p_ref, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (reporter_id, target_type, target_ref) do nothing returning * into v;
  if v.id is null then raise exception 'you already reported this' using errcode = 'JK003', detail = 'already_reported'; end if;
  return jsonb_build_object('id', v.id, 'status', 'open');
exception when check_violation then raise exception 'invalid reason' using errcode = 'JK002', detail = 'reason';
end $$;

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
             when 'media' then (select coalesce(m.caption, '(photo)') from issue_media m where m.id::text = r.target_ref and m.visibility = 'public')
             when 'idea_comment' then (select c.body from idea_comments c where c.id::text = r.target_ref) end, 240),
           array_agg(distinct r.reason_code), count(*)::int, min(r.created_at)
    from moderation_reports r where r.status = 'open' group by r.target_type, r.target_ref
    union all
    select 'review', 'idea', x.ref, left(x.title || ': ' || x.body, 240), array[]::text[], 0, x.created_at from ideas x where x.status = 'pending_review'
    union all
    select 'review', 'question', q.ref, left(q.title || ': ' || q.body, 240), array[]::text[], 0, q.created_at from questions q where q.status = 'pending_review' and q.visibility = 'public'
  ) u order by 7 limit least(greatest(p_limit, 1), 100);
end $$;

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
    elsif p_type = 'idea_comment' then update idea_comments set status = 'hidden', moderation_reason = btrim(p_reason) where id::text = p_ref and status = 'published';
    end if;
    get diagnostics n = row_count;
  elsif p_action = 'restore' then
    if p_type = 'issue' then update issues set public_visibility = true where ref = p_ref and not public_visibility;
    elsif p_type = 'idea' then update ideas set status = 'published', moderation_reason = null, updated_at = now() where ref = p_ref and status = 'hidden';
    elsif p_type = 'question' then update questions set status = 'open', moderation_reason = null, updated_at = now() where ref = p_ref and visibility = 'public' and status = 'hidden';
    elsif p_type = 'idea_comment' then update idea_comments set status = 'published', moderation_reason = null where id::text = p_ref and status = 'hidden';
    end if;
    get diagnostics n = row_count;
  else n := 1; end if;
  if n = 0 then raise exception 'nothing to change' using errcode = 'JK404'; end if;
  update moderation_reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, handled_by = auth.uid(), handled_at = now(), decision = p_action, decision_reason = btrim(p_reason)
   where target_type = p_type and target_ref = p_ref and status = 'open';
  perform audit_write('moderation.' || p_action, p_type, p_ref, null, null, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('target_type', p_type, 'target_ref', p_ref, 'action', p_action);
end $$;
revoke all on function create_idea_comment(text, text), report_content(text, text, text, text), moderation_queue(integer), moderate_item(text, text, text, text) from public, anon;
grant execute on function create_idea_comment(text, text), report_content(text, text, text, text), moderation_queue(integer), moderate_item(text, text, text, text) to authenticated;

-- Polls -------------------------------------------------------------------------------------------------------------------------------
-- An office (MP or office manager: the 'publish' permission) drafts, opens and closes a poll for its area. One vote per verified account.
-- Results are hidden until the poll closes unless the office chose results_visibility = 'always'; with fewer than 5 votes only the total is
-- shown to the public (small-group suppression).
create sequence if not exists poll_ref_seq start 1000;
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PL-' || to_char(now(), 'YYYY') || '-' || nextval('poll_ref_seq')),
  constituency_id uuid not null references constituencies,
  created_by uuid references profiles on delete set null,
  question text not null check (char_length(question) between 5 and 200),
  status text not null default 'draft' check (status in ('draft','open','closed','cancelled')),
  results_visibility text not null default 'after_close' check (results_visibility in ('after_close','always')),
  closes_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  reminder_sent_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  position integer not null check (position between 1 and 10),
  unique (poll_id, position)
);
create table if not exists poll_votes (
  poll_id uuid not null references polls on delete cascade,
  option_id uuid not null references poll_options on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index if not exists polls_constituency_idx on polls (constituency_id, status, created_at desc);
create index if not exists poll_votes_option_idx on poll_votes (option_id);
alter table polls enable row level security; alter table poll_options enable row level security; alter table poll_votes enable row level security;
drop policy if exists polls_select on polls;
create policy polls_select on polls for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists poll_options_select on poll_options;
create policy poll_options_select on poll_options for select using (exists (select 1 from polls p where p.id = poll_id and (office_can(p.constituency_id, 'view', null) or is_admin())));
drop policy if exists poll_votes_select on poll_votes;
create policy poll_votes_select on poll_votes for select using (user_id = auth.uid());
revoke all on polls, poll_options, poll_votes from anon, authenticated;
grant select on polls, poll_options, poll_votes to authenticated;

create or replace view public_polls with (security_invoker = false) as
  select p.ref, c.key as constituency_key, p.question, p.status, p.results_visibility, p.closes_at, p.opened_at, p.closed_at, p.is_demo
  from polls p join constituencies c on c.id = p.constituency_id where p.status in ('open','closed');
create or replace view public_poll_options with (security_invoker = false) as
  select p.ref as poll_ref, o.id, o.label, o.position from poll_options o join polls p on p.id = o.poll_id where p.status in ('open','closed');
grant select on public_polls, public_poll_options to anon, authenticated;

create or replace function create_poll(p_constituency text, p_question text, p_options text[], p_closes_at timestamptz default null, p_results text default 'after_close') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v polls%rowtype; i integer; opts text[];
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  select array_agg(btrim(x)) into opts from unnest(coalesce(p_options, '{}')) x where btrim(x) <> '';
  if coalesce(array_length(opts, 1), 0) not between 2 and 10 or (select count(distinct lower(x)) from unnest(opts) x) <> array_length(opts, 1) then
    raise exception 'a poll needs 2 to 10 different options' using errcode = 'JK002', detail = 'options';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'closing time must be in the future' using errcode = 'JK002', detail = 'closes_at'; end if;
  if p_results not in ('after_close','always') then raise exception 'results' using errcode = 'JK002', detail = 'results_visibility'; end if;
  insert into polls (constituency_id, created_by, question, closes_at, results_visibility, is_demo) values (c.id, auth.uid(), btrim(p_question), p_closes_at, p_results, c.is_demo) returning * into v;
  for i in 1 .. array_length(opts, 1) loop insert into poll_options (poll_id, label, position) values (v.id, opts[i], i); end loop;
  perform audit_write('poll.create', 'poll', v.ref, null, jsonb_build_object('options', array_length(opts, 1)), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation then raise exception 'invalid poll' using errcode = 'JK002', detail = 'question';
end $$;

create or replace function set_poll_status(p_ref text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v polls%rowtype;
begin
  select * into v from polls where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'poll not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not ((v.status = 'draft' and p_status in ('open','cancelled')) or (v.status = 'open' and p_status in ('closed','cancelled'))) then raise exception 'invalid status change' using errcode = 'JK001'; end if;
  if p_status = 'open' and v.closes_at is not null and v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  update polls set status = p_status, opened_at = case when p_status = 'open' then now() else opened_at end, closed_at = case when p_status = 'closed' then now() else closed_at end where id = v.id;
  perform audit_write('poll.' || p_status, 'poll', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ref', v.ref, 'status', p_status);
end $$;

create or replace function cast_poll_vote(p_ref text, p_option uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v polls%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into v from polls where ref = p_ref and status in ('open','closed');
  if not found then raise exception 'poll not found' using errcode = 'JK404'; end if;
  if v.status <> 'open' or (v.closes_at is not null and v.closes_at <= now()) then raise exception 'this poll is closed' using errcode = 'JK003', detail = 'poll_closed'; end if;
  if not exists (select 1 from poll_options where id = p_option and poll_id = v.id) then raise exception 'option' using errcode = 'JK002', detail = 'option_id'; end if;
  insert into poll_votes (poll_id, option_id, user_id) values (v.id, p_option, uid) on conflict (poll_id, user_id) do nothing;
  if not found then raise exception 'you already voted' using errcode = 'JK003', detail = 'already_voted'; end if;
  return jsonb_build_object('ref', v.ref, 'voted', true);
end $$;

-- Results: office and admin always; everyone else only when closed or the office chose 'always', and only with 5 or more votes.
create or replace function poll_results(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v polls%rowtype; total integer; staff boolean; show boolean; mine uuid;
begin
  select * into v from polls where ref = p_ref;
  staff := found and (office_can(v.constituency_id, 'view', null) or is_admin());
  if not found or (v.status not in ('open','closed') and not staff) then raise exception 'poll not found' using errcode = 'JK404'; end if;
  select count(*)::int into total from poll_votes where poll_id = v.id;
  select option_id into mine from poll_votes where poll_id = v.id and user_id = auth.uid();
  show := staff or ((v.status = 'closed' or v.results_visibility = 'always') and total >= 5);
  return jsonb_build_object('ref', v.ref, 'status', v.status, 'total_votes', total, 'my_option_id', mine, 'results_shown', show,
    'note', case when show then null when total < 5 and (v.status = 'closed' or v.results_visibility = 'always') then 'Results appear once at least 5 people have voted.' else 'Results are shown after the poll closes.' end,
    'options', case when show then (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'votes', (select count(*) from poll_votes pv where pv.option_id = o.id)) order by o.position) from poll_options o where o.poll_id = v.id) end);
end $$;
grant execute on function poll_results(text) to anon, authenticated;

create or replace function close_due_polls() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update polls set status = 'closed', closed_at = now() where status = 'open' and closes_at is not null and closes_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function close_due_polls() from public, anon, authenticated;
grant execute on function close_due_polls() to service_role;

-- Reminder (§15): followers of the area who have not voted hear once, within 24 hours of closing.
create or replace function poll_closing_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare p record; f record; n integer := 0;
begin
  for p in select * from polls where status = 'open' and closes_at is not null and closes_at between now() and now() + interval '24 hours' and reminder_sent_at is null loop
    for f in select distinct fo.user_id from follows fo where fo.target_type = 'area' and fo.constituency_id = p.constituency_id
              and not exists (select 1 from poll_votes v where v.poll_id = p.id and v.user_id = fo.user_id) loop
      if notify_user(f.user_id, 'poll_closing', 'একটি জনমত যাচাই শীঘ্রই শেষ হচ্ছে', p.question,
          jsonb_build_object('ref', p.ref, 'en', jsonb_build_object('title', 'A poll in your area closes soon', 'body', p.question)), 'poll-close:' || p.ref, p.ref) is not null then n := n + 1; end if;
    end loop;
    update polls set reminder_sent_at = now() where id = p.id;
  end loop;
  return n;
end $$;
revoke all on function poll_closing_reminders() from public, anon, authenticated;
grant execute on function poll_closing_reminders() to service_role;

revoke all on function create_poll(text, text, text[], timestamptz, text), set_poll_status(text, text), cast_poll_vote(text, uuid) from public, anon;
grant execute on function create_poll(text, text, text[], timestamptz, text), set_poll_status(text, text), cast_poll_vote(text, uuid) to authenticated;

-- Constituency snapshot for the home screen ----------------------------------------------------------------------------------------------
-- Counts of PUBLIC issues created in the date range, in three plain groups. A description of activity, not a ranking.
create or replace function constituency_snapshot(p_key text, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; d_from date := coalesce(p_from, current_date - 30); d_to date := coalesce(p_to, current_date); rep integer; prog integer; res integer; latest timestamptz;
begin
  select * into c from constituencies where key = p_key and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if d_to < d_from or d_to - d_from > 730 then raise exception 'date range' using errcode = 'JK002', detail = 'to'; end if;
  select count(*) filter (where status in ('submitted','under_review','needs_information','acknowledged','assigned','reopened')),
         count(*) filter (where status in ('referred_to_authority','in_progress')),
         count(*) filter (where status in ('resolved','closed')), max(updated_at)
    into rep, prog, res, latest
    from issues where constituency_id = c.id and public_visibility and created_at >= d_from and created_at < d_to + 1;
  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'from', d_from, 'to', d_to, 'reported', rep, 'in_progress', prog, 'resolved', res,
    'last_updated', latest, 'definition', 'Public issues created in this area between the dates. Reported = waiting for or at the start of handling; in progress = sent to an agency or being worked on; resolved = reported resolved or closed. Not a ranking.');
end $$;
revoke all on function constituency_snapshot(text, date, date) from public;
grant execute on function constituency_snapshot(text, date, date) to anon, authenticated;

-- Project feedback after completion ------------------------------------------------------------------------------------------------------
create table if not exists project_feedback (
  project_id uuid not null references projects on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table project_feedback enable row level security;
drop policy if exists project_feedback_select on project_feedback;
create policy project_feedback_select on project_feedback for select
  using (user_id = auth.uid() or exists (select 1 from projects p where p.id = project_id and (office_can(p.constituency_id, 'view', null) or is_admin())));
revoke all on project_feedback from anon, authenticated;
grant select on project_feedback to authenticated;

create or replace view public_project_feedback with (security_invoker = false) as
  select p.ref as project_ref, count(*)::int as feedback_count,
         case when count(*) >= 5 then round(avg(f.rating)::numeric, 1) end as average_rating
  from project_feedback f join projects p on p.id = f.project_id group by p.ref;
grant select on public_project_feedback to anon, authenticated;

create or replace function submit_project_feedback(p_ref text, p_rating integer, p_comment text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v projects%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into v from projects where ref = p_ref;
  if not found then raise exception 'project not found' using errcode = 'JK404'; end if;
  if v.status <> 'completed' then raise exception 'feedback opens when the project is completed' using errcode = 'JK003', detail = 'not_completed'; end if;
  if p_rating not between 1 and 5 then raise exception 'rating' using errcode = 'JK002', detail = 'rating'; end if;
  insert into project_feedback (project_id, user_id, rating, comment) values (v.id, uid, p_rating, nullif(btrim(coalesce(p_comment, '')), '')) on conflict do nothing;
  if not found then raise exception 'you already sent feedback' using errcode = 'JK003', detail = 'already_sent'; end if;
  return jsonb_build_object('project', v.ref, 'sent', true);
exception when check_violation then raise exception 'comment too long' using errcode = 'JK002', detail = 'comment';
end $$;
revoke all on function submit_project_feedback(text, integer, text) from public, anon;
grant execute on function submit_project_feedback(text, integer, text) to authenticated;

-- Project details (budget source, procurement) -----------------------------------------------------------------------------------------------
create or replace function set_project_details(p_ref text, p_budget_source text, p_budget_verified date, p_procurement_ref text, p_contractor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v projects%rowtype;
begin
  v := project_for_edit(p_ref);
  if p_budget_source is not null and p_budget_verified is null then raise exception 'a budget source needs the date it was verified' using errcode = 'JK002', detail = 'budget_verified_at'; end if;
  update projects set budget_source = coalesce(nullif(btrim(p_budget_source), ''), budget_source), budget_verified_at = coalesce(p_budget_verified, budget_verified_at),
    procurement_ref = coalesce(nullif(btrim(p_procurement_ref), ''), procurement_ref), contractor_name = coalesce(nullif(btrim(p_contractor), ''), contractor_name), updated_at = now() where id = v.id;
  perform audit_write('project.details', 'project', v.ref, null, jsonb_build_object('budget_source', p_budget_source is not null, 'procurement', p_procurement_ref is not null));
  return jsonb_build_object('ref', v.ref);
exception when check_violation then raise exception 'invalid project details' using errcode = 'JK002', detail = 'fields';
end $$;
revoke all on function set_project_details(text, text, date, text, text) from public, anon;
grant execute on function set_project_details(text, text, date, text, text) to authenticated;

create or replace view public_projects with (security_invoker = false) as
  select p.ref, c.key as constituency_key, p.title, p.description, p.status, p.budget_text, p.start_date, p.expected_end_date, p.source_url, p.source_checked_at, p.is_demo, p.updated_at,
         p.budget_source, p.budget_verified_at, p.procurement_ref, p.contractor_name, p.delay_explanation
  from projects p join constituencies c on c.id = p.constituency_id;
grant select on public_projects to anon, authenticated;

-- Follows for projects and representatives --------------------------------------------------------------------------------------------------
alter table follows add column if not exists project_id uuid references projects on delete cascade;
alter table follows add column if not exists representative_id uuid references representatives on delete cascade;
alter table follows drop constraint if exists follows_target_type_check;
alter table follows add constraint follows_target_type_check check (target_type in ('issue','area','category','project','representative'));
alter table follows drop constraint if exists follows_check;   -- the original unnamed shape check from 0014
alter table follows drop constraint if exists follows_target_shape;
alter table follows add constraint follows_target_shape check (
  (target_type = 'issue' and issue_id is not null and constituency_id is null and category is null and project_id is null and representative_id is null)
  or (target_type = 'area' and constituency_id is not null and issue_id is null and category is null and project_id is null and representative_id is null)
  or (target_type = 'category' and category is not null and issue_id is null and constituency_id is null and project_id is null and representative_id is null)
  or (target_type = 'project' and project_id is not null and issue_id is null and constituency_id is null and category is null and representative_id is null)
  or (target_type = 'representative' and representative_id is not null and issue_id is null and constituency_id is null and category is null and project_id is null));
drop index if exists follows_unique;
create unique index if not exists follows_unique on follows (user_id, target_type, coalesce(issue_id, '00000000-0000-0000-0000-000000000000'), coalesce(constituency_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(category, ''), coalesce(project_id, '00000000-0000-0000-0000-000000000000'), coalesce(representative_id, '00000000-0000-0000-0000-000000000000'));

create or replace function add_follow(p_type text, p_target text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_issue uuid; v_area uuid; v_cat text; v_proj uuid; v_rep uuid; v_id uuid;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if (select count(*) from follows where user_id = uid) >= 200 then
    raise exception 'follow limit reached' using errcode = 'JK003', detail = 'follow_limit';
  end if;
  if p_type = 'issue' then
    select id into v_issue from issues where ref = p_target and public_visibility;
    if v_issue is null then raise exception 'issue not found' using errcode = 'JK404'; end if;
  elsif p_type = 'area' then
    select id into v_area from constituencies where key = p_target and is_active;
    if v_area is null then raise exception 'unknown area' using errcode = 'JK002', detail = 'target'; end if;
  elsif p_type = 'category' then
    select slug into v_cat from issue_categories where slug = p_target and is_active;
    if v_cat is null then raise exception 'unknown category' using errcode = 'JK002', detail = 'target'; end if;
  elsif p_type = 'project' then
    select id into v_proj from projects where ref = p_target;
    if v_proj is null then raise exception 'project not found' using errcode = 'JK404'; end if;
  elsif p_type = 'representative' then
    select id into v_rep from representatives where id::text = p_target and verification_status = 'verified';
    if v_rep is null then raise exception 'representative not found' using errcode = 'JK404'; end if;
  else
    raise exception 'unknown follow type' using errcode = 'JK002', detail = 'type';
  end if;
  insert into follows (user_id, target_type, issue_id, constituency_id, category, project_id, representative_id) values (uid, p_type, v_issue, v_area, v_cat, v_proj, v_rep)
    on conflict do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from follows where user_id = uid and target_type = p_type and issue_id is not distinct from v_issue
      and constituency_id is not distinct from v_area and category is not distinct from v_cat and project_id is not distinct from v_proj and representative_id is not distinct from v_rep;
  end if;
  return jsonb_build_object('id', v_id, 'type', p_type, 'target', p_target);
end $$;

-- Report fields: duration, who or what is affected (office-only), and video evidence -----------------------------------------------------------
alter table issues add column if not exists duration_text text check (duration_text is null or char_length(duration_text) <= 100);
alter table issues add column if not exists affected_who text check (affected_who is null or char_length(affected_who) <= 200);

alter table issue_media add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 180);
alter table issue_media add column if not exists poster_path text;
alter table issue_media add column if not exists upload_status text not null default 'ready' check (upload_status in ('awaiting_upload','ready','rejected'));

create or replace function issue_media_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim integer := coalesce((select (value #>> '{}')::integer from app_settings where key = 'max_media_per_issue'), 5);
begin
  if new.media_type = 'video' and exists (select 1 from issue_media where issue_id = new.issue_id and media_type = 'video' and upload_status <> 'rejected') then
    raise exception 'only one video per issue' using errcode = 'JK003', detail = 'video_limit';
  end if;
  if (select count(*) from issue_media where issue_id = new.issue_id and media_type = 'image') >= lim and new.media_type = 'image' then
    raise exception 'too many photos on this issue' using errcode = 'JK003', detail = 'media_limit';
  end if;
  return new;
end $$;

-- Private bucket for video originals: stored as sent, never transcoded; 20 MB.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('issue-video', 'issue-video', false, 20000000, array['video/mp4','video/webm','video/quicktime'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
