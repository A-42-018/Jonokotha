-- Phase 7 (B7.3, B7.5; masterplan §7.7, §7.16, §8.11, §15): for/against points on ideas, per-area support threshold with an office response time,
-- and citizen project check-ins. Requires 0070. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 7 status):
--   * Points are short (5 to 280 characters), one side each, no replies. They publish at once (post-moderation like idea comments) and can be
--     reported and hidden. "Helpful" is one mark per verified account per point, never on your own point.
--   * "Verified local supporters" = verified accounts that follow the area (local_verified_account, 0070). Support from others is still counted
--     publicly, but only local supporters count toward the threshold.
--   * Once an idea reaches the threshold the date is fixed: withdrawing supports later does not cancel the office's commitment.
--     The commitment shows as the office's own ("office commitment"), not a legal obligation. A reasoned response (at least 20 characters)
--     is needed for a decision on such an idea; a response after the due date is shown as "answered late", never hidden.
--   * Check-ins are reviewed BEFORE they are public (photos can show people), always labelled citizen-submitted, and have no path to the
--     project's official status: nothing in this file updates `projects`.

-- Moderation reports can now point at arguments and check-ins ---------------------------------------------------------------------------------
alter table moderation_reports drop constraint if exists moderation_reports_target_type_check;
alter table moderation_reports add constraint moderation_reports_target_type_check check (target_type in ('issue','idea','question','media','idea_comment','idea_argument','project_checkin'));

-- Idea arguments (for / against) -----------------------------------------------------------------------------------------------------------------
create table if not exists idea_arguments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas on delete cascade,
  author_id uuid references profiles on delete set null,
  side text not null check (side in ('for','against')),
  body text not null check (char_length(body) between 5 and 280),
  status text not null default 'published' check (status in ('published','hidden')),
  moderation_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idea_arguments_idea_idx on idea_arguments (idea_id, side, created_at);
create index if not exists idea_arguments_author_idx on idea_arguments (author_id, created_at desc);
create table if not exists idea_argument_votes (
  argument_id uuid not null references idea_arguments on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (argument_id, user_id)
);
alter table idea_arguments enable row level security;
alter table idea_argument_votes enable row level security;
drop policy if exists idea_arguments_select on idea_arguments;
create policy idea_arguments_select on idea_arguments for select
  using (author_id = auth.uid() or is_moderator() or is_admin()
         or exists (select 1 from ideas i where i.id = idea_id and idea_scope_can(i.constituency_id, 'view')));
drop policy if exists idea_argument_votes_select on idea_argument_votes;
create policy idea_argument_votes_select on idea_argument_votes for select using (user_id = auth.uid());
revoke all on idea_arguments, idea_argument_votes from anon, authenticated;
grant select on idea_arguments, idea_argument_votes to authenticated;

create or replace view public_idea_arguments with (security_invoker = false) as
  select a.id, i.ref as idea_ref, a.side, a.body, a.created_at, (select count(*)::int from idea_argument_votes v where v.argument_id = a.id) as helpful_count
  from idea_arguments a join ideas i on i.id = a.idea_id
  where a.status = 'published' and i.status in ('published','under_consideration','planned','declined');
grant select on public_idea_arguments to anon, authenticated;

create or replace function add_idea_argument(p_idea text, p_side text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); i ideas%rowtype; b text := btrim(coalesce(p_body, '')); v idea_arguments%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into i from ideas where ref = p_idea and status in ('published','under_consideration','planned','declined');
  if not found then raise exception 'idea not found' using errcode = 'JK404'; end if;
  if p_side not in ('for','against') then raise exception 'side' using errcode = 'JK002', detail = 'side'; end if;
  if char_length(b) not between 5 and 280 then raise exception 'point length' using errcode = 'JK002', detail = 'body'; end if;
  if (select count(*) from idea_arguments where idea_id = i.id and author_id = uid and status = 'published') >= 3 then raise exception 'at most 3 points per idea' using errcode = 'JK003', detail = 'argument_limit'; end if;
  if (select count(*) from idea_arguments where author_id = uid and created_at > now() - interval '1 day') >= 10 then raise exception 'daily limit reached' using errcode = 'JK003', detail = 'argument_daily_limit'; end if;
  insert into idea_arguments (idea_id, author_id, side, body) values (i.id, uid, p_side, b) returning * into v;
  return jsonb_build_object('id', v.id, 'idea', i.ref, 'side', v.side, 'status', v.status);
end $$;

create or replace function set_argument_helpful(p_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a idea_arguments%rowtype; n integer;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select a2.* into a from idea_arguments a2 join ideas i on i.id = a2.idea_id where a2.id = p_id and a2.status = 'published' and i.status in ('published','under_consideration','planned','declined');
  if not found then raise exception 'point not found' using errcode = 'JK404'; end if;
  if p_on then
    if a.author_id = uid then raise exception 'your own point' using errcode = 'JK003', detail = 'own_point'; end if;
    insert into idea_argument_votes (argument_id, user_id) values (a.id, uid) on conflict do nothing;
  else delete from idea_argument_votes where argument_id = a.id and user_id = uid; end if;
  select count(*) into n from idea_argument_votes where argument_id = a.id;
  return jsonb_build_object('id', a.id, 'helpful', p_on, 'helpful_count', n);
end $$;

-- Support threshold ---------------------------------------------------------------------------------------------------------------------------
create table if not exists idea_policies (
  constituency_id uuid primary key references constituencies on delete cascade,
  support_threshold integer not null check (support_threshold between 3 and 100000),
  response_days integer not null check (response_days between 3 and 90),
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table idea_policies enable row level security;
drop policy if exists idea_policies_select on idea_policies;
create policy idea_policies_select on idea_policies for select using (office_can(constituency_id, 'view', null) or is_admin());
revoke all on idea_policies from anon, authenticated;
grant select on idea_policies to authenticated;

alter table ideas add column if not exists threshold_reached_at timestamptz;
alter table ideas add column if not exists response_due_at timestamptz;
alter table ideas add column if not exists responded_at timestamptz;
alter table ideas add column if not exists due_reminder_sent_at timestamptz;
alter table ideas add column if not exists overdue_notice_sent_at timestamptz;

create or replace function idea_local_support(p_idea uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from idea_supports s join ideas i on i.id = s.idea_id
   where s.idea_id = p_idea
     and exists (select 1 from follows f where f.user_id = s.user_id and f.target_type = 'area' and f.constituency_id = i.constituency_id)
     and exists (select 1 from auth.users u where u.id = s.user_id and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) $$;
revoke all on function idea_local_support(uuid) from public, anon, authenticated;

-- Check one idea against its area's policy; when it reaches the threshold, fix the due date and alert the office (§8.11). Returns true when it just reached it.
create or replace function check_idea_threshold(p_idea uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare i ideas%rowtype; pol idea_policies%rowtype; n integer;
begin
  select * into i from ideas where id = p_idea;
  if not found or i.threshold_reached_at is not null or i.status not in ('published','under_consideration') then return false; end if;
  select * into pol from idea_policies where constituency_id = i.constituency_id;
  if not found then return false; end if;
  n := idea_local_support(i.id);
  if n < pol.support_threshold then return false; end if;
  update ideas set threshold_reached_at = now(), response_due_at = now() + make_interval(days => pol.response_days), updated_at = now() where id = i.id and threshold_reached_at is null;
  if not found then return false; end if;
  perform notify_office(i.constituency_id, 'decide', 'idea_threshold', 'একটি আইডিয়া সমর্থনের সীমায় পৌঁছেছে', 'নম্বর ' || i.ref,
    jsonb_build_object('ref', i.ref, 'en', jsonb_build_object('title', 'An idea reached the support threshold', 'body', 'Reference ' || i.ref)), 'idea-thr:' || i.ref, i.ref);
  perform notify_user(i.author_id, 'idea_update', 'আপনার আইডিয়া সমর্থনের সীমায় পৌঁছেছে', 'নম্বর ' || i.ref,
    jsonb_build_object('ref', i.ref, 'en', jsonb_build_object('title', 'Your idea reached the support threshold', 'body', 'Reference ' || i.ref)), 'idea-thr-au:' || i.ref, i.ref);
  perform audit_write('idea.threshold_reached', 'idea', i.ref, null, jsonb_build_object('local_supporters', n, 'threshold', pol.support_threshold, 'response_days', pol.response_days), '{}');
  return true;
end $$;
revoke all on function check_idea_threshold(uuid) from public, anon, authenticated;

create or replace function trg_idea_support_threshold() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform check_idea_threshold(new.idea_id);
  return new;
exception when others then return new;
end $$;
drop trigger if exists idea_support_threshold_trg on idea_supports;
create trigger idea_support_threshold_trg after insert on idea_supports for each row execute function trg_idea_support_threshold();

-- Following an area can also complete a threshold (a supporter who follows later becomes local).
create or replace function trg_follow_idea_threshold() returns trigger language plpgsql security definer set search_path = public as $$
declare x record;
begin
  if new.target_type = 'area' then
    for x in select s.idea_id from idea_supports s join ideas i on i.id = s.idea_id where s.user_id = new.user_id and i.constituency_id = new.constituency_id and i.threshold_reached_at is null loop
      perform check_idea_threshold(x.idea_id);
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists follow_idea_threshold_trg on follows;
create trigger follow_idea_threshold_trg after insert on follows for each row execute function trg_follow_idea_threshold();

create or replace function set_idea_policy(p_constituency text, p_threshold integer, p_days integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; x record; reached integer := 0;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'decide', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_threshold is null or p_threshold not between 3 and 100000 then raise exception 'threshold' using errcode = 'JK002', detail = 'support_threshold'; end if;
  if p_days is null or p_days not between 3 and 90 then raise exception 'days' using errcode = 'JK002', detail = 'response_days'; end if;
  insert into idea_policies (constituency_id, support_threshold, response_days, updated_by) values (c.id, p_threshold, p_days, auth.uid())
  on conflict (constituency_id) do update set support_threshold = excluded.support_threshold, response_days = excluded.response_days, updated_by = auth.uid(), updated_at = now();
  for x in select id from ideas where constituency_id = c.id and threshold_reached_at is null and status in ('published','under_consideration') loop
    if check_idea_threshold(x.id) then reached := reached + 1; end if;
  end loop;
  perform audit_write('idea_policy.set', 'constituency', c.key, null, jsonb_build_object('support_threshold', p_threshold, 'response_days', p_days));
  return jsonb_build_object('constituency', c.key, 'support_threshold', p_threshold, 'response_days', p_days, 'ideas_now_awaiting_response', reached);
end $$;

-- The decision is the response. On an idea that reached the threshold it must be reasoned (20+ characters) and it records when it was given.
create or replace function decide_idea(p_ref text, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v ideas%rowtype; old_status text;
begin
  select * into v from ideas where ref = p_ref and status in ('published','under_consideration','planned','declined');
  if not found or not office_can(v.constituency_id, 'view', null) and not office_can(v.constituency_id, 'decide', null) then raise exception 'idea not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'decide', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_decision not in ('under_consideration','planned','declined') then raise exception 'invalid decision' using errcode = 'JK002', detail = 'decision'; end if;
  if p_decision = 'declined' and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a declined idea needs a reason' using errcode = 'JK002', detail = 'note'; end if;
  if v.threshold_reached_at is not null and v.responded_at is null and char_length(btrim(coalesce(p_note, ''))) < 20 then
    raise exception 'an idea that reached the support threshold needs a reasoned response' using errcode = 'JK002', detail = 'note';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'note too long' using errcode = 'JK002', detail = 'note'; end if;
  old_status := v.status;
  update ideas set status = p_decision, decision_note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now(), updated_at = now(),
    responded_at = case when v.threshold_reached_at is not null and v.responded_at is null then now() else v.responded_at end where id = v.id;
  perform audit_write('idea.decision', 'idea', v.ref, jsonb_build_object('status', old_status), jsonb_build_object('status', p_decision), jsonb_build_object('note_given', p_note is not null));
  return jsonb_build_object('ref', v.ref, 'status', p_decision);
end $$;

-- Public view: the commitment and its state are public. "overdue" is computed, never stored, so it cannot be hidden.
create or replace view public_ideas with (security_invoker = false) as
  select i.ref, c.key as constituency_key, i.category, i.title, i.body, i.status, i.decision_note, i.decided_at, i.created_at, i.is_demo,
         (select count(*)::int from idea_supports s where s.idea_id = i.id) as support_count,
         i.threshold_reached_at, i.response_due_at, i.responded_at,
         case when i.threshold_reached_at is null then null
              when i.responded_at is not null and i.responded_at <= i.response_due_at then 'answered'
              when i.responded_at is not null then 'answered_late'
              when i.response_due_at < now() then 'overdue'
              else 'awaiting_response' end as response_state,
         (select p.support_threshold from idea_policies p where p.constituency_id = i.constituency_id) as support_threshold
  from ideas i join constituencies c on c.id = i.constituency_id
  where i.status in ('published','under_consideration','planned','declined');
grant select on public_ideas to anon, authenticated;

-- Reminders (job): the office hears 48 hours before the due date and once when it is missed. Returns how many notices were queued.
create or replace function idea_response_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare i record; n integer := 0;
begin
  for i in select * from ideas where threshold_reached_at is not null and responded_at is null and response_due_at between now() and now() + interval '48 hours' and due_reminder_sent_at is null loop
    perform notify_office(i.constituency_id, 'decide', 'idea_response_due', 'একটি আইডিয়ার উত্তরের সময় ঘনিয়ে আসছে', 'নম্বর ' || i.ref,
      jsonb_build_object('ref', i.ref, 'en', jsonb_build_object('title', 'An idea response is due soon', 'body', 'Reference ' || i.ref)), 'idea-due:' || i.ref, i.ref);
    update ideas set due_reminder_sent_at = now() where id = i.id; n := n + 1;
  end loop;
  for i in select * from ideas where threshold_reached_at is not null and responded_at is null and response_due_at < now() and overdue_notice_sent_at is null loop
    perform notify_office(i.constituency_id, 'decide', 'idea_response_due', 'একটি আইডিয়ার উত্তরের নির্ধারিত সময় পেরিয়ে গেছে', 'নম্বর ' || i.ref,
      jsonb_build_object('ref', i.ref, 'en', jsonb_build_object('title', 'An idea response is overdue', 'body', 'Reference ' || i.ref)), 'idea-over:' || i.ref, i.ref);
    update ideas set overdue_notice_sent_at = now() where id = i.id; n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function idea_response_reminders() from public, anon, authenticated;
grant execute on function idea_response_reminders() to service_role;

-- Project check-ins ---------------------------------------------------------------------------------------------------------------------------------
create table if not exists project_checkins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  author_id uuid references profiles on delete set null,
  note text not null check (char_length(note) between 5 and 500),
  visited_at date not null check (visited_at <= current_date + 1),
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  moderation_status text not null default 'pending_review' check (moderation_status in ('pending_review','approved','hidden')),
  moderation_reason text check (moderation_reason is null or char_length(moderation_reason) <= 300),
  moderated_by uuid references profiles on delete set null,
  moderated_at timestamptz,
  office_response text check (office_response is null or char_length(office_response) <= 500),
  responded_by uuid references profiles on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists project_checkins_project_idx on project_checkins (project_id, visited_at desc);
create index if not exists project_checkins_author_idx on project_checkins (author_id, created_at desc);
alter table project_checkins enable row level security;
drop policy if exists project_checkins_select on project_checkins;
create policy project_checkins_select on project_checkins for select
  using (author_id = auth.uid() or is_moderator() or is_admin()
         or exists (select 1 from projects p where p.id = project_id and office_can(p.constituency_id, 'view', null)));
revoke all on project_checkins from anon, authenticated;
grant select on project_checkins to authenticated;

create or replace view public_project_checkins with (security_invoker = false) as
  select k.id, p.ref as project_ref, k.note, k.visited_at, (k.photo_path is not null) as has_photo, k.office_response, k.responded_at, k.created_at,
         'citizen_submitted'::text as label
  from project_checkins k join projects p on p.id = k.project_id where k.moderation_status = 'approved';
grant select on public_project_checkins to anon, authenticated;

create or replace function create_project_checkin(p_project text, p_note text, p_visited date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p projects%rowtype; b text := btrim(coalesce(p_note, '')); d date := coalesce(p_visited, current_date); v project_checkins%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into p from projects where ref = p_project;
  if not found then raise exception 'project not found' using errcode = 'JK404'; end if;
  if char_length(b) not between 5 and 500 then raise exception 'note length' using errcode = 'JK002', detail = 'note'; end if;
  if d > current_date or d < current_date - 60 then raise exception 'visit date' using errcode = 'JK002', detail = 'visited_at'; end if;
  if (select count(*) from project_checkins where author_id = uid and project_id = p.id and created_at > now() - interval '1 day') >= 2 then raise exception 'daily limit for this project' using errcode = 'JK003', detail = 'checkin_limit'; end if;
  if (select count(*) from project_checkins where author_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'daily check-in limit' using errcode = 'JK003', detail = 'checkin_daily_limit'; end if;
  insert into project_checkins (project_id, author_id, note, visited_at) values (p.id, uid, b, d) returning * into v;
  return jsonb_build_object('id', v.id, 'project', p.ref, 'status', v.moderation_status, 'label', 'citizen_submitted');
end $$;

create or replace function moderate_project_checkin(p_id uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k project_checkins%rowtype; p projects%rowtype;
begin
  select * into k from project_checkins where id = p_id;
  if not found then raise exception 'check-in not found' using errcode = 'JK404'; end if;
  select * into p from projects where id = k.project_id;
  if not (office_can(p.constituency_id, 'publish', null) or is_moderator() or is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('approve','hide') then raise exception 'action' using errcode = 'JK002', detail = 'action'; end if;
  if p_action = 'hide' and char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is required' using errcode = 'JK002', detail = 'reason'; end if;
  update project_checkins set moderation_status = case when p_action = 'approve' then 'approved' else 'hidden' end, moderation_reason = nullif(btrim(coalesce(p_reason, '')), ''), moderated_by = auth.uid(), moderated_at = now() where id = k.id;
  perform audit_write('checkin.' || p_action, 'project_checkin', k.id::text, jsonb_build_object('status', k.moderation_status), jsonb_build_object('status', case when p_action = 'approve' then 'approved' else 'hidden' end), jsonb_build_object('project', p.ref));
  return jsonb_build_object('id', k.id, 'status', case when p_action = 'approve' then 'approved' else 'hidden' end);
end $$;

create or replace function respond_to_checkin(p_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k project_checkins%rowtype; p projects%rowtype; t text := btrim(coalesce(p_text, ''));
begin
  select * into k from project_checkins where id = p_id and moderation_status = 'approved';
  if not found then raise exception 'check-in not found' using errcode = 'JK404'; end if;
  select * into p from projects where id = k.project_id;
  if not office_can(p.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(t) not between 5 and 500 then raise exception 'response length' using errcode = 'JK002', detail = 'text'; end if;
  update project_checkins set office_response = t, responded_by = auth.uid(), responded_at = now() where id = k.id;
  perform audit_write('checkin.respond', 'project_checkin', k.id::text, null, null, jsonb_build_object('project', p.ref));
  perform notify_user(k.author_id, 'checkin_response', 'আপনার চেক-ইনে অফিসের উত্তর এসেছে', 'নম্বর ' || p.ref,
    jsonb_build_object('ref', p.ref, 'en', jsonb_build_object('title', 'The office responded to your check-in', 'body', 'Reference ' || p.ref)), 'checkin-resp:' || k.id, p.ref);
  return jsonb_build_object('id', k.id, 'responded', true);
end $$;

-- Reports, queue and moderation understand the two new content types. Same bodies as 0032 plus the new branches. ---------------------------------------
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
    when 'idea_argument' then exists (select 1 from public_idea_arguments a where a.id::text = p_ref)
    when 'project_checkin' then exists (select 1 from public_project_checkins k where k.id::text = p_ref)
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
             when 'idea_comment' then (select c.body from idea_comments c where c.id::text = r.target_ref)
             when 'idea_argument' then (select a.body from idea_arguments a where a.id::text = r.target_ref)
             when 'project_checkin' then (select k.note from project_checkins k where k.id::text = r.target_ref) end, 240),
           array_agg(distinct r.reason_code), count(*)::int, min(r.created_at)
    from moderation_reports r where r.status = 'open' group by r.target_type, r.target_ref
    union all
    select 'review', 'idea', x.ref, left(x.title || ': ' || x.body, 240), array[]::text[], 0, x.created_at from ideas x where x.status = 'pending_review'
    union all
    select 'review', 'question', q.ref, left(q.title || ': ' || q.body, 240), array[]::text[], 0, q.created_at from questions q where q.status = 'pending_review' and q.visibility = 'public'
    union all
    select 'review', 'project_checkin', k.id::text, left(k.note, 240), array[]::text[], 0, k.created_at from project_checkins k where k.moderation_status = 'pending_review'
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
    elsif p_type = 'idea_argument' then update idea_arguments set status = 'hidden', moderation_reason = btrim(p_reason) where id::text = p_ref and status = 'published';
    elsif p_type = 'project_checkin' then update project_checkins set moderation_status = 'hidden', moderation_reason = btrim(p_reason), moderated_by = auth.uid(), moderated_at = now() where id::text = p_ref and moderation_status <> 'hidden';
    end if;
    get diagnostics n = row_count;
  elsif p_action = 'restore' then
    if p_type = 'issue' then update issues set public_visibility = true where ref = p_ref and not public_visibility;
    elsif p_type = 'idea' then update ideas set status = 'published', moderation_reason = null, updated_at = now() where ref = p_ref and status = 'hidden';
    elsif p_type = 'question' then update questions set status = 'open', moderation_reason = null, updated_at = now() where ref = p_ref and visibility = 'public' and status = 'hidden';
    elsif p_type = 'idea_comment' then update idea_comments set status = 'published', moderation_reason = null where id::text = p_ref and status = 'hidden';
    elsif p_type = 'idea_argument' then update idea_arguments set status = 'published', moderation_reason = null where id::text = p_ref and status = 'hidden';
    elsif p_type = 'project_checkin' then update project_checkins set moderation_status = 'approved', moderation_reason = null, moderated_by = auth.uid(), moderated_at = now() where id::text = p_ref and moderation_status <> 'approved';
    end if;
    get diagnostics n = row_count;
  else n := 1; end if;
  if n = 0 then raise exception 'nothing to change' using errcode = 'JK404'; end if;
  update moderation_reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, handled_by = auth.uid(), handled_at = now(), decision = p_action, decision_reason = btrim(p_reason)
   where target_type = p_type and target_ref = p_ref and status = 'open';
  perform audit_write('moderation.' || p_action, p_type, p_ref, null, null, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('target_type', p_type, 'target_ref', p_ref, 'action', p_action);
end $$;

-- Private bucket for check-in photos (EXIF stripped by the API before storing; never public: served through the API only after approval).
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('project-checkins', 'project-checkins', false, 8388608, array['image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

revoke all on function add_idea_argument(text, text, text), set_argument_helpful(uuid, boolean), set_idea_policy(text, integer, integer), decide_idea(text, text, text),
  create_project_checkin(text, text, date), moderate_project_checkin(uuid, text, text), respond_to_checkin(uuid, text), report_content(text, text, text, text),
  moderation_queue(integer), moderate_item(text, text, text, text) from public, anon;
grant execute on function add_idea_argument(text, text, text), set_argument_helpful(uuid, boolean), set_idea_policy(text, integer, integer), decide_idea(text, text, text),
  create_project_checkin(text, text, date), moderate_project_checkin(uuid, text, text), respond_to_checkin(uuid, text), report_content(text, text, text, text),
  moderation_queue(integer), moderate_item(text, text, text, text) to authenticated;
