-- Phase 5 (B5.9, B5.10, B5.11; masterplan §15, §17.2, §17.4, §19.1): notification events that were still missing, announcement opt-in,
-- essential versus non-essential types, personalization controls, Banglish search, and the Insight Agent's links to cases.
-- Requires 0030-0034. Safe to run twice.

-- Essential and non-essential notification types --------------------------------------------------------------------------------------------
-- Essential types cannot be muted or unsubscribed (they carry the status of the person's own report, question, appeal, approval or task).
create or replace function notification_is_essential(p_type text) returns boolean language sql immutable as $$
  select p_type in ('issue_status','report_submitted','question_reply','appeal_answered','approval_decision','task_assigned','case_assigned','feedback_request') $$;
grant execute on function notification_is_essential(text) to anon, authenticated, service_role;

alter table user_preferences add column if not exists announcement_opt_in boolean not null default false;
alter table user_preferences add column if not exists numeral_style text not null default 'bn' check (numeral_style in ('bn','en'));

-- Events from §15 that had no producer yet ---------------------------------------------------------------------------------------------------
-- Report submitted (to the reporter) and case assigned (to the assignee).
create or replace function trg_notify_submitted_assigned() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_user(new.reporter_id, 'report_submitted', 'আপনার সমস্যা জমা হয়েছে', 'নম্বর ' || new.ref,
      jsonb_build_object('ref', new.ref, 'en', jsonb_build_object('title', 'Your report was submitted', 'body', 'Reference ' || new.ref)), 'sub:' || new.id, new.ref);
  elsif new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to and new.assigned_to is distinct from auth.uid() then
    perform notify_user(new.assigned_to, 'case_assigned', 'আপনাকে একটি কেস দেওয়া হয়েছে', 'নম্বর ' || new.ref,
      jsonb_build_object('ref', new.ref, 'en', jsonb_build_object('title', 'A case was assigned to you', 'body', 'Reference ' || new.ref)), 'asg:' || new.id || ':' || new.assigned_to, new.ref);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_submitted_assigned_trg on issues;
create trigger notify_submitted_assigned_trg after insert or update of assigned_to on issues for each row execute function trg_notify_submitted_assigned();

-- Satisfaction rating request after resolution; appeal answered (a rejected report was reopened as an appeal and has now moved on).
create or replace function trg_notify_feedback_appeal() returns trigger language plpgsql security definer set search_path = public as $$
declare i issues%rowtype;
begin
  if new.event_type <> 'status_change' or new.to_status is null then return new; end if;
  select * into i from issues where id = new.issue_id;
  if new.to_status = 'resolved' and i.reporter_id is distinct from new.actor_id then
    perform notify_user(i.reporter_id, 'feedback_request', 'সমস্যাটি কি সত্যিই সমাধান হয়েছে?', 'নম্বর ' || i.ref || ' — আপনার মতামত জানান',
      jsonb_build_object('ref', i.ref, 'en', jsonb_build_object('title', 'Was your issue really solved?', 'body', 'Reference ' || i.ref || ' - tell us what you think')), 'fb:' || i.id, i.ref);
  end if;
  if new.from_status = 'reopened' and new.to_status <> 'reopened'
     and exists (select 1 from issue_events e where e.issue_id = new.issue_id and e.from_status = 'rejected' and e.to_status = 'reopened' and e.created_at < new.created_at) then
    perform notify_user(i.reporter_id, 'appeal_answered', 'আপনার আপিলের উত্তর এসেছে', 'নম্বর ' || i.ref,
      jsonb_build_object('ref', i.ref, 'status', new.to_status, 'en', jsonb_build_object('title', 'Your appeal was answered', 'body', 'Reference ' || i.ref)), 'appeal:' || new.id, i.ref);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_feedback_appeal_trg on issue_events;
create trigger notify_feedback_appeal_trg after insert on issue_events for each row execute function trg_notify_feedback_appeal();

-- "Someone else reported the same problem on your issue": the count only, once a day, no identity.
create or replace function trg_notify_affected() returns trigger language plpgsql security definer set search_path = public as $$
declare i issues%rowtype; n integer;
begin
  select * into i from issues where id = new.issue_id;
  select count(*)::int into n from issue_affected where issue_id = new.issue_id;
  perform notify_user(i.reporter_id, 'affected_count', 'আরও কেউ একই সমস্যার কথা জানিয়েছেন', 'নম্বর ' || i.ref || ': এখন ' || n || ' জন',
    jsonb_build_object('ref', i.ref, 'count', n, 'en', jsonb_build_object('title', 'Others have the same problem', 'body', 'Reference ' || i.ref || ': now ' || n || ' people')), 'aff:' || i.id || ':' || current_date, i.ref);
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_affected_trg on issue_affected;
create trigger notify_affected_trg after insert on issue_affected for each row execute function trg_notify_affected();

-- Followed project changed; supporters of an idea hear the decision.
create or replace function trg_notify_project() returns trigger language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if new.status is distinct from old.status or new.expected_end_date is distinct from old.expected_end_date then
    for f in select distinct user_id from follows where target_type = 'project' and project_id = new.id loop
      perform notify_user(f.user_id, 'project_update', 'আপনার অনুসরণ করা প্রকল্পে হালনাগাদ', 'নম্বর ' || new.ref,
        jsonb_build_object('ref', new.ref, 'status', new.status, 'en', jsonb_build_object('title', 'A project you follow was updated', 'body', 'Reference ' || new.ref)), 'proj:' || new.ref || ':' || new.status || ':' || coalesce(new.expected_end_date::text, ''), new.ref);
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_project_trg on projects;
create trigger notify_project_trg after update of status, expected_end_date on projects for each row execute function trg_notify_project();

create or replace function trg_notify_idea_supporters() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if new.status in ('under_consideration','planned','declined') and new.status is distinct from old.status then
    for s in select user_id from idea_supports where idea_id = new.id and user_id <> new.author_id loop
      perform notify_user(s.user_id, 'idea_update', 'আপনার সমর্থন করা আইডিয়ার সিদ্ধান্ত এসেছে', 'নম্বর ' || new.ref,
        jsonb_build_object('ref', new.ref, 'status', new.status, 'en', jsonb_build_object('title', 'An idea you supported has a decision', 'body', 'Reference ' || new.ref)), 'ideasup:' || new.ref || ':' || new.status, new.ref);
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_idea_supporters_trg on ideas;
create trigger notify_idea_supporters_trg after update of status on ideas for each row execute function trg_notify_idea_supporters();

-- Announcements are opt-in: only people who switched them on, and who follow the area or the representative, hear about them.
create or replace function trg_notify_announcement() returns trigger language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    for f in select distinct fo.user_id from follows fo join user_preferences up on up.user_id = fo.user_id and up.announcement_opt_in
             where (fo.target_type = 'area' and fo.constituency_id = new.constituency_id)
                or (fo.target_type = 'representative' and fo.representative_id in (select representative_id from representative_constituencies where constituency_id = new.constituency_id)) loop
      perform notify_user(f.user_id, 'announcement', 'আপনার এলাকার জন্য নতুন ঘোষণা', 'নম্বর ' || new.ref, jsonb_build_object('ref', new.ref, 'en', jsonb_build_object('title', 'New announcement for your area', 'body', 'Reference ' || new.ref)), 'ann:' || new.ref, new.ref);
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;

-- Personalization: view, switch off, reset ------------------------------------------------------------------------------------------------------
create or replace function update_my_personalization(p_simple boolean default null, p_voice boolean default null, p_numeral text default null, p_enabled boolean default null, p_announcements boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r user_preferences%rowtype;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_numeral is not null and p_numeral not in ('bn','en') then raise exception 'numeral' using errcode = 'JK002', detail = 'numeral_style'; end if;
  insert into user_preferences (user_id) values (uid) on conflict do nothing;
  update user_preferences set simple_language_mode = coalesce(p_simple, simple_language_mode), voice_first = coalesce(p_voice, voice_first), numeral_style = coalesce(p_numeral, numeral_style),
    personalization_enabled = coalesce(p_enabled, personalization_enabled), announcement_opt_in = coalesce(p_announcements, announcement_opt_in), updated_at = now() where user_id = uid returning * into r;
  return jsonb_build_object('simple_language_mode', r.simple_language_mode, 'voice_first', r.voice_first, 'numeral_style', r.numeral_style, 'personalization_enabled', r.personalization_enabled, 'announcement_opt_in', r.announcement_opt_in);
end $$;

-- Reset: forget everything personalization uses (follows and the preference switches), keep notification channels and quiet hours.
create or replace function reset_my_personalization() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  delete from follows where user_id = uid;
  get diagnostics n = row_count;
  update user_preferences set followed_areas = '{}', followed_categories = '{}', simple_language_mode = false, voice_first = false, personalization_enabled = true, numeral_style = 'bn', announcement_opt_in = false, updated_at = now() where user_id = uid;
  perform audit_write('privacy.personalization_reset', 'profile', uid::text, null, jsonb_build_object('follows_removed', n));
  return jsonb_build_object('reset', true, 'follows_removed', n);
end $$;
revoke all on function update_my_personalization(boolean, boolean, text, boolean, boolean), reset_my_personalization() from public, anon;
grant execute on function update_my_personalization(boolean, boolean, text, boolean, boolean), reset_my_personalization() to authenticated;

-- Banglish search ----------------------------------------------------------------------------------------------------------------------------------
-- "rasta bhanga" must find "রাস্তা ভাঙা". Both spellings are reduced to the same consonant skeleton: Bangla letters are romanised, then every
-- text drops vowels and the letter h, merges look-alike letters (v/w -> b, f -> p, z -> j, q/x -> k, y removed) and collapses doubled letters.
create or replace function bn_to_latin(t text) returns text language plpgsql immutable as $$
declare out text := ''; ch text; m text; i integer;
  map jsonb := '{"ক":"k","খ":"kh","গ":"g","ঘ":"gh","ঙ":"ng","চ":"ch","ছ":"chh","জ":"j","ঝ":"jh","ঞ":"n","ট":"t","ঠ":"th","ড":"d","ঢ":"dh","ণ":"n","ত":"t","থ":"th","দ":"d","ধ":"dh","ন":"n","প":"p","ফ":"ph","ব":"b","ভ":"bh","ম":"m","য":"j","র":"r","ল":"l","শ":"sh","ষ":"sh","স":"s","হ":"h","ড়":"r","ঢ়":"rh","য়":"y","ৎ":"t","ং":"ng","ঃ":"h","ঁ":"","অ":"a","আ":"a","ই":"i","ঈ":"i","উ":"u","ঊ":"u","ঋ":"ri","এ":"e","ঐ":"oi","ও":"o","ঔ":"ou","া":"a","ি":"i","ী":"i","ু":"u","ূ":"u","ৃ":"ri","ে":"e","ৈ":"oi","ো":"o","ৌ":"ou","্":"a","০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9"}';
begin
  if t is null then return ''; end if;
  for i in 1 .. char_length(t) loop
    ch := substr(t, i, 1);
    m := map ->> ch;
    out := out || coalesce(m, ch);
  end loop;
  return out;
end $$;

create or replace function latin_skeleton(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    translate(lower(coalesce(t, '')), 'vwfzqxy', 'bbpjkks'),
    'h', '', 'g'),                      -- bh kh gh th dh ph sh ch -> b k g t d p s c
    '[aeiou]', '', 'g'),                -- vowels
    '(.)\1+', '\1', 'g'),               -- doubled letters
    '[^a-z0-9 ]+', ' ', 'g'),
    '\s+', ' ', 'g')) $$;

create or replace function search_skeleton(t text) returns text language sql immutable as $$ select latin_skeleton(bn_to_latin(t)) $$;
grant execute on function bn_to_latin(text), latin_skeleton(text), search_skeleton(text) to anon, authenticated, service_role;

alter table issues add column if not exists search_key text;
alter table ideas add column if not exists search_key text;
create or replace function set_search_key() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'issues' then new.search_key := search_skeleton(new.title || ' ' || new.description || ' ' || coalesce(new.area, ''));
  else new.search_key := search_skeleton(new.title || ' ' || new.body); end if;
  return new;
end $$;
drop trigger if exists issues_search_key_trg on issues;
create trigger issues_search_key_trg before insert on issues for each row execute function set_search_key();
drop trigger if exists ideas_search_key_trg on ideas;
create trigger ideas_search_key_trg before insert on ideas for each row execute function set_search_key();
update issues set search_key = search_skeleton(title || ' ' || description || ' ' || coalesce(area, '')) where search_key is null;
update ideas set search_key = search_skeleton(title || ' ' || body) where search_key is null;
create index if not exists issues_search_key_idx on issues using gin (search_key gin_trgm_ops) where public_visibility;
create index if not exists ideas_search_key_idx on ideas using gin (search_key gin_trgm_ops);

-- Every query token (as a skeleton) must occur in the item's key. PUBLIC items only.
create or replace function search_public(p_q text, p_constituency text default null, p_limit integer default 20)
returns table (kind text, ref text, title text, constituency_key text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare toks text[]; q text := btrim(coalesce(p_q, ''));
begin
  if char_length(q) not between 2 and 100 then raise exception 'query' using errcode = 'JK002', detail = 'q'; end if;
  toks := array(select t from unnest(string_to_array(search_skeleton(q), ' ')) t where t <> '');
  if coalesce(array_length(toks, 1), 0) = 0 then return; end if;
  return query
  select * from (
    select 'issue'::text k, i.ref, i.title, i.constituency_key, i.created_at from issues i
     where i.public_visibility and (p_constituency is null or i.constituency_key = p_constituency)
       and not exists (select 1 from unnest(toks) t where i.search_key not like '%' || t || '%')
    union all
    select 'idea', d.ref, d.title, c.key, d.created_at from ideas d join constituencies c on c.id = d.constituency_id
     where d.status in ('published','under_consideration','planned','declined') and (p_constituency is null or c.key = p_constituency)
       and not exists (select 1 from unnest(toks) t where d.search_key not like '%' || t || '%')
  ) r order by r.created_at desc limit least(greatest(p_limit, 1), 50);
end $$;
revoke all on function search_public(text, text, integer) from public;
grant execute on function search_public(text, text, integer) to anon, authenticated;

-- Bangla and Latin digits, one place ---------------------------------------------------------------------------------------------------------------
create or replace function normalize_digits(t text) returns text language sql immutable as $$ select translate(coalesce(t, ''), '০১২৩৪৫৬৭৮৯٠١٢٣٤٥٦٧٨٩', '01234567890123456789') $$;
grant execute on function normalize_digits(text) to anon, authenticated, service_role;

create or replace function analytics_overview(p_constituency text, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; since timestamptz; k constant integer := 5;
        total integer; resolved integer; med numeric; by_status jsonb; by_cat jsonb; trend jsonb; hot jsonb; agencies_j jsonb; clusters jsonb; links jsonb; prev integer;
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

  -- Phase 5 (Insight Agent): links from each large category to recent PUBLIC cases, and the previous period for a trend statement.
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', n, 'case_refs', refs) order by n desc), '[]') into links
    from (select category, count(*)::int n, (array_agg(ref order by created_at desc))[1:3] refs
          from issues where constituency_id = c.id and created_at >= since and public_visibility group by category having count(*) >= k order by count(*) desc limit 5) x;
  select count(*)::int into prev from issues where constituency_id = c.id and created_at >= since - make_interval(days => p_days) and created_at < since;

  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'period_days', p_days, 'generated_at', now(),
    'received', case when total >= k then total end, 'received_suppressed', total < k, 'resolved', case when resolved >= k then resolved end,
    'median_hours_to_resolution', case when resolved >= k then med end,
    'by_status', by_status, 'by_category', by_cat, 'weekly_trend', trend, 'hotspots', hot, 'top_agencies', agencies_j, 'duplicate_clusters', clusters, 'case_links', links, 'previous_period_received', case when prev >= k then prev end,
    'privacy', jsonb_build_object('min_group_size', k, 'note', 'Groups smaller than the minimum are hidden. Locations are approximate grid cells.'));
end $$;
revoke all on function analytics_overview(text, integer) from public, anon;
grant execute on function analytics_overview(text, integer) to authenticated;

revoke all on function analytics_overview(text, integer) from public, anon;
grant execute on function analytics_overview(text, integer) to authenticated;

-- The delivery worker needs the notification type to decide whether an email carries an unsubscribe link.
drop function if exists claim_deliveries(integer);
create or replace function claim_deliveries(p_limit integer default 25) returns table (id uuid, channel text, attempts integer, user_id uuid, ref text, title text, body text, data jsonb, type text)
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
  select u.id, u.channel, u.attempts, u.user_id, n.ref, n.title, n.body, n.data, n.type from upd u join notifications n on n.id = u.notification_id;
end $$;
revoke all on function claim_deliveries(integer) from public, anon, authenticated;
grant execute on function claim_deliveries(integer) to service_role;
