-- Phase 2.9-2.10 (masterplan §15, §7.3): in-app notifications with preferences, quiet hours, dedupe and a delivery queue
-- (Web Push and email, retried with backoff, dead-lettered after 5 tries), and the personalised feed.
-- Notification text is deliberately generic: a reference number and a short Bangla/English label, never the issue's content.
-- Requires 0004-0017.

alter table user_preferences add column if not exists channels jsonb not null default '{"in_app": true, "push": false, "email": false}';
alter table user_preferences add column if not exists muted_types text[] not null default '{}';
alter table user_preferences add column if not exists timezone text not null default 'Asia/Dhaka';

-- Only "read" may be changed by the user on their own notifications.
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
alter table notifications add column if not exists ref text;   -- the thing it is about (issue, question, idea...), for deep links

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'dead', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index if not exists notification_deliveries_due_idx on notification_deliveries (next_attempt_at) where status in ('pending', 'failed', 'sending');
alter table notification_deliveries enable row level security;
drop policy if exists notification_deliveries_own on notification_deliveries;
create policy notification_deliveries_own on notification_deliveries for select using (user_id = auth.uid());
revoke all on notification_deliveries from anon, authenticated;
grant select on notification_deliveries to authenticated;   -- delivery status is visible to the person it concerns

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text, auth text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failures integer not null default 0
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions for select using (user_id = auth.uid());
revoke all on push_subscriptions from anon, authenticated;
grant select (id, user_id, created_at, last_success_at) on push_subscriptions to authenticated;

create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'endpoint' using errcode = 'JK002', detail = 'endpoint'; end if;
  if (select count(*) from push_subscriptions where user_id = auth.uid()) >= 10 and not exists (select 1 from push_subscriptions where endpoint = p_endpoint) then
    raise exception 'too many devices' using errcode = 'JK003', detail = 'device_limit';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, left(p_p256dh, 200), left(p_auth, 100))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, failures = 0;
end $$;
create or replace function remove_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $$;
revoke all on function save_push_subscription(text, text, text), remove_push_subscription(text) from public, anon;
grant execute on function save_push_subscription(text, text, text), remove_push_subscription(text) to authenticated;

-- Quiet hours: when push/email may next be sent for this user (now if outside quiet hours). In-app is never delayed.
create or replace function quiet_until(p_user uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare q jsonb; tz text; s time; e time; local_now timestamp; t time;
begin
  select quiet_hours, timezone into q, tz from user_preferences where user_id = p_user;
  if q is null or q ->> 'start' is null or q ->> 'end' is null then return now(); end if;
  s := (q ->> 'start')::time; e := (q ->> 'end')::time;
  if s = e then return now(); end if;
  local_now := now() at time zone coalesce(tz, 'Asia/Dhaka'); t := local_now::time;
  if s < e and t >= s and t < e then return (date_trunc('day', local_now) + e) at time zone tz; end if;
  if s > e and t >= s then return (date_trunc('day', local_now) + interval '1 day' + e) at time zone tz; end if;
  if s > e and t < e then return (date_trunc('day', local_now) + e) at time zone tz; end if;
  return now();
exception when others then return now();
end $$;
revoke all on function quiet_until(uuid) from public, anon, authenticated;

-- The one producer of notifications (triggers and server jobs only). Respects mute lists; dedupes per user and key; queues
-- push and email deliveries only for channels the user turned on (push also needs a registered device).
create or replace function notify_user(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb, p_dedupe text, p_ref text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare pref user_preferences%rowtype; nid uuid; due timestamptz;
begin
  if p_user is null or not exists (select 1 from profiles where id = p_user and account_status = 'active') then return null; end if;
  select * into pref from user_preferences where user_id = p_user;
  if found and p_type = any (pref.muted_types) then return null; end if;
  insert into notifications (user_id, type, title, body, data, dedupe_key, ref, retention_until)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'), p_dedupe, p_ref, now() + interval '180 days')
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing returning id into nid;
  if nid is null then return null; end if;
  due := quiet_until(p_user);
  if found and coalesce((pref.channels ->> 'push')::boolean, false) and exists (select 1 from push_subscriptions where user_id = p_user) then
    insert into notification_deliveries (notification_id, user_id, channel, next_attempt_at) values (nid, p_user, 'push', due) on conflict do nothing;
  end if;
  if found and coalesce((pref.channels ->> 'email')::boolean, false) then
    insert into notification_deliveries (notification_id, user_id, channel, next_attempt_at) values (nid, p_user, 'email', due) on conflict do nothing;
  end if;
  return nid;
end $$;
revoke all on function notify_user(uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;

-- Delivery queue (service role only: the worker route) ----------------------------------------------------------------
create or replace function claim_deliveries(p_limit integer default 25) returns table (id uuid, channel text, attempts integer, user_id uuid, ref text, title text, body text, data jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select d.id from notification_deliveries d
    where d.status in ('pending', 'failed', 'sending') and d.next_attempt_at <= now()
    order by d.next_attempt_at limit least(greatest(p_limit, 1), 100) for update skip locked),
  upd as (
    update notification_deliveries d set status = 'sending', next_attempt_at = now() + interval '5 minutes'   -- a crashed worker's claim expires
    from due where d.id = due.id returning d.id, d.channel, d.attempts, d.user_id, d.notification_id)
  select u.id, u.channel, u.attempts, u.user_id, n.ref, n.title, n.body, n.data from upd u join notifications n on n.id = u.notification_id;
end $$;

create or replace function finish_delivery(p_id uuid, p_ok boolean, p_error text default null, p_skip boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare d notification_deliveries%rowtype; st text;
begin
  select * into d from notification_deliveries where id = p_id;
  if not found then return null; end if;
  if p_skip then st := 'skipped';
  elsif p_ok then st := 'sent';
  elsif d.attempts + 1 >= 5 then st := 'dead';           -- dead-letter: kept for review, never retried
  else st := 'failed'; end if;
  update notification_deliveries set status = st, attempts = attempts + (case when p_ok or p_skip then 0 else 1 end), last_error = left(p_error, 200),
    sent_at = case when st = 'sent' then now() end,
    next_attempt_at = case when st = 'failed' then now() + make_interval(mins => power(2, d.attempts)::int) else next_attempt_at end where id = p_id;
  return st;
end $$;
revoke all on function claim_deliveries(integer), finish_delivery(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function claim_deliveries(integer), finish_delivery(uuid, boolean, text, boolean) to service_role;

-- Events (masterplan §15). Every trigger swallows its own errors: a failed notification must never fail the user's action. ---
create or replace function notif_label(p_status text) returns text language sql immutable as $$
  select case p_status
    when 'needs_information' then 'অফিস আরও তথ্য চেয়েছে' when 'acknowledged' then 'অফিস আপনার সমস্যাটি দেখেছে' when 'assigned' then 'সমস্যাটি একজনকে দেওয়া হয়েছে'
    when 'referred_to_authority' then 'সমস্যাটি সংশ্লিষ্ট সংস্থায় পাঠানো হয়েছে' when 'in_progress' then 'কাজ চলছে' when 'resolved' then 'সমস্যাটি সমাধান হয়েছে বলে জানানো হয়েছে'
    when 'closed' then 'সমস্যাটি বন্ধ হয়েছে' when 'rejected' then 'সমস্যাটি গ্রহণ করা হয়নি' when 'duplicate' then 'সমস্যাটি অন্য একটির সাথে মেলানো হয়েছে'
    when 'out_of_jurisdiction' then 'সমস্যাটি এই অফিসের আওতার বাইরে' when 'reopened' then 'সমস্যাটি আবার খোলা হয়েছে' else 'সমস্যার অবস্থা বদলেছে' end $$;
create or replace function notif_label_en(p_status text) returns text language sql immutable as $$
  select case p_status
    when 'needs_information' then 'The office asked for more information' when 'acknowledged' then 'The office has seen your issue' when 'assigned' then 'Your issue was given to someone'
    when 'referred_to_authority' then 'Your issue was sent to the responsible agency' when 'in_progress' then 'Work is in progress' when 'resolved' then 'Your issue was reported resolved'
    when 'closed' then 'Your issue was closed' when 'rejected' then 'Your issue was not accepted' when 'duplicate' then 'Your issue was matched with another one'
    when 'out_of_jurisdiction' then 'Your issue is outside this office''s area' when 'reopened' then 'Your issue was reopened' else 'Your issue status changed' end $$;

create or replace function trg_notify_issue_event() returns trigger language plpgsql security definer set search_path = public as $$
declare i issues%rowtype; f record;
begin
  if new.event_type <> 'status_change' or new.to_status is null then return new; end if;
  select * into i from issues where id = new.issue_id;
  if i.reporter_id is distinct from new.actor_id then
    perform notify_user(i.reporter_id, 'issue_status', notif_label(new.to_status::text), 'নম্বর ' || i.ref, jsonb_build_object('ref', i.ref, 'status', new.to_status, 'en', jsonb_build_object('title', notif_label_en(new.to_status::text), 'body', 'Reference ' || i.ref)), 'ev:' || new.id, i.ref);
  end if;
  for f in select user_id from follows where target_type = 'issue' and issue_id = i.id and user_id is distinct from i.reporter_id and user_id is distinct from new.actor_id loop
    perform notify_user(f.user_id, 'issue_status', notif_label(new.to_status::text), 'নম্বর ' || i.ref, jsonb_build_object('ref', i.ref, 'status', new.to_status, 'en', jsonb_build_object('title', notif_label_en(new.to_status::text), 'body', 'Reference ' || i.ref)), 'ev:' || new.id, i.ref);
  end loop;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_issue_event_trg on issue_events;
create trigger notify_issue_event_trg after insert on issue_events for each row execute function trg_notify_issue_event();

-- New issue in an area or category someone follows: at most one notification per user, area and day.
create or replace function trg_notify_new_issue() returns trigger language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if not new.public_visibility then return new; end if;
  for f in select distinct user_id, constituency_id from follows where user_id <> new.reporter_id and
           ((target_type = 'area' and constituency_id = new.constituency_id) or (target_type = 'category' and category = new.category)) loop
    perform notify_user(f.user_id, 'new_in_area', 'আপনার অনুসরণ করা এলাকায় নতুন সমস্যা', 'নতুন সমস্যা জমা পড়েছে', jsonb_build_object('constituency', new.constituency_key, 'en', jsonb_build_object('title', 'New issue in an area you follow', 'body', 'A new issue was reported')),
      'new:' || new.constituency_key || ':' || current_date, null);
  end loop;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_new_issue_trg on issues;
create trigger notify_new_issue_trg after insert on issues for each row execute function trg_notify_new_issue();

create or replace function trg_notify_question_message() returns trigger language plpgsql security definer set search_path = public as $$
declare q questions%rowtype;
begin
  select * into q from questions where id = new.question_id;
  if new.author_kind = 'office' then
    perform notify_user(q.asker_id, 'question_reply', 'আপনার প্রশ্নের উত্তর এসেছে', 'নম্বর ' || q.ref, jsonb_build_object('ref', q.ref, 'en', jsonb_build_object('title', 'Your question has a reply', 'body', 'Reference ' || q.ref)), 'qm:' || new.id, q.ref);
  elsif q.assigned_to is not null then
    perform notify_user(q.assigned_to, 'question_message', 'প্রশ্নে নতুন বার্তা', 'নম্বর ' || q.ref, jsonb_build_object('ref', q.ref, 'en', jsonb_build_object('title', 'New message on a question', 'body', 'Reference ' || q.ref)), 'qm:' || new.id, q.ref);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_question_message_trg on question_messages;
create trigger notify_question_message_trg after insert on question_messages for each row execute function trg_notify_question_message();

create or replace function trg_notify_idea() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('under_consideration', 'planned', 'declined') and new.status is distinct from old.status then
    perform notify_user(new.author_id, 'idea_decision', 'আপনার আইডিয়া নিয়ে অফিসের সিদ্ধান্ত এসেছে', 'নম্বর ' || new.ref, jsonb_build_object('ref', new.ref, 'status', new.status, 'en', jsonb_build_object('title', 'The office decided on your idea', 'body', 'Reference ' || new.ref)), 'idea:' || new.ref || ':' || new.status, new.ref);
  elsif new.status = 'published' and old.status = 'pending_review' then
    perform notify_user(new.author_id, 'idea_decision', 'আপনার আইডিয়া প্রকাশিত হয়েছে', 'নম্বর ' || new.ref, jsonb_build_object('ref', new.ref, 'status', 'published', 'en', jsonb_build_object('title', 'Your idea is now public', 'body', 'Reference ' || new.ref)), 'idea:' || new.ref || ':published', new.ref);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_idea_trg on ideas;
create trigger notify_idea_trg after update of status on ideas for each row execute function trg_notify_idea();

create or replace function trg_notify_announcement() returns trigger language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    for f in select user_id from follows where target_type = 'area' and constituency_id = new.constituency_id loop
      perform notify_user(f.user_id, 'announcement', 'আপনার এলাকার জন্য নতুন ঘোষণা', 'নম্বর ' || new.ref, jsonb_build_object('ref', new.ref, 'en', jsonb_build_object('title', 'New announcement for your area', 'body', 'Reference ' || new.ref)), 'ann:' || new.ref, new.ref);
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_announcement_trg on announcements;
create trigger notify_announcement_trg after insert or update of status on announcements for each row execute function trg_notify_announcement();

-- Feed ------------------------------------------------------------------------------------------------------------------
-- Public issues, newest first. With personalisation on, issues that match what the user EXPLICITLY follows (the issue, its area or
-- its category) come first, newest first inside each group. Nothing is ranked by engagement (support or view counts), and nothing
-- is inferred about the person. `why` says which follow matched, so the reason is always visible.
create or replace function me_feed(p_personalized boolean, p_limit integer, p_after_tier integer default null, p_after_ts timestamptz default null, p_after_ref text default null)
returns table (ref text, tier integer, why text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); use_follows boolean;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  use_follows := p_personalized and coalesce((select personalization_enabled from user_preferences where user_id = uid), true);
  return query
  select r.ref, r.tier, r.why, r.created_at from (
    select i.ref, i.created_at,
      case when not use_follows then 1
           when exists (select 1 from follows f where f.user_id = uid and f.target_type = 'issue' and f.issue_id = i.id) then 0
           when exists (select 1 from follows f where f.user_id = uid and f.target_type = 'area' and f.constituency_id = i.constituency_id) then 0
           when exists (select 1 from follows f where f.user_id = uid and f.target_type = 'category' and f.category = i.category) then 0
           else 1 end as tier,
      case when not use_follows then null
           when exists (select 1 from follows f where f.user_id = uid and f.target_type = 'issue' and f.issue_id = i.id) then 'issue'
           when exists (select 1 from follows f where f.user_id = uid and f.target_type = 'area' and f.constituency_id = i.constituency_id) then 'area'
           when exists (select 1 from follows f where f.user_id = uid and f.target_type = 'category' and f.category = i.category) then 'category' end as why
    from issues i where i.public_visibility) r
  where p_after_tier is null or r.tier > p_after_tier
     or (r.tier = p_after_tier and (r.created_at < p_after_ts or (r.created_at = p_after_ts and r.ref < p_after_ref)))
  order by r.tier, r.created_at desc, r.ref desc
  limit least(greatest(p_limit, 1), 51);
end $$;
revoke all on function me_feed(boolean, integer, integer, timestamptz, text) from public, anon;
grant execute on function me_feed(boolean, integer, integer, timestamptz, text) to authenticated;

-- Preferences the user may change on their own row.
grant update (channels, muted_types, timezone) on user_preferences to authenticated;
alter table user_preferences drop constraint if exists user_preferences_quiet_hours_shape;
alter table user_preferences add constraint user_preferences_quiet_hours_shape check (quiet_hours is null or (quiet_hours ? 'start' and quiet_hours ? 'end'));
