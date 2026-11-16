-- Phase 2.5 (masterplan §7.5, §13): citizen engagement.
--   * issue_affected: "আমারও একই সমস্যা" — one per signed-in user per issue; only the COUNT is public.
--   * follows: a user follows an issue, an area (constituency) or a category; private to the user.
-- Writes go through SECURITY DEFINER functions (signed-in users hold no DELETE privilege anywhere in public).
-- Requires 0004-0013.

create table if not exists issue_affected (
  issue_id uuid not null references issues on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);
create index if not exists issue_affected_user_idx on issue_affected (user_id);
alter table issue_affected enable row level security;
drop policy if exists issue_affected_select on issue_affected;
create policy issue_affected_select on issue_affected for select using (user_id = auth.uid());
revoke all on issue_affected from anon, authenticated;
grant select on issue_affected to authenticated;

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  target_type text not null check (target_type in ('issue', 'area', 'category')),
  issue_id uuid references issues on delete cascade,
  constituency_id uuid references constituencies on delete cascade,
  category text check (category is null or category ~ '^[a-z_]{2,40}$'),
  created_at timestamptz not null default now(),
  check ((target_type = 'issue' and issue_id is not null and constituency_id is null and category is null)
      or (target_type = 'area' and constituency_id is not null and issue_id is null and category is null)
      or (target_type = 'category' and category is not null and issue_id is null and constituency_id is null))
);
create unique index if not exists follows_unique on follows (user_id, target_type, coalesce(issue_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(constituency_id, '00000000-0000-0000-0000-000000000000'), coalesce(category, ''));
alter table follows enable row level security;
drop policy if exists follows_select on follows;
create policy follows_select on follows for select using (user_id = auth.uid());
revoke all on follows from anon, authenticated;
grant select on follows to authenticated;

-- Affected ---------------------------------------------------------------------------------------------------------
-- p_on true adds, false removes (both idempotent). Only publicly visible issues, only for active accounts, and the
-- reporter cannot add themselves (their report already counts as one). Returns the new public count.
create or replace function set_issue_affected(p_ref text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v issues%rowtype; uid uuid := auth.uid(); n integer;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into v from issues where ref = p_ref and public_visibility;
  if not found then raise exception 'issue not found' using errcode = 'JK404'; end if;
  if p_on then
    if v.reporter_id = uid then raise exception 'you reported this issue' using errcode = 'JK003', detail = 'own_issue'; end if;
    insert into issue_affected (issue_id, user_id) values (v.id, uid) on conflict do nothing;
  else
    delete from issue_affected where issue_id = v.id and user_id = uid;
  end if;
  select count(*) into n from issue_affected where issue_id = v.id;
  return jsonb_build_object('ref', v.ref, 'affected', p_on, 'affected_count', n);
end $$;
revoke all on function set_issue_affected(text, boolean) from public, anon;
grant execute on function set_issue_affected(text, boolean) to authenticated;

-- Public counts only; never who. Publicly visible issues only.
create or replace function issue_affected_counts(p_refs text[]) returns table (ref text, affected_count integer)
language sql stable security definer set search_path = public as $$
  select i.ref, (select count(*)::int from issue_affected a where a.issue_id = i.id)
  from issues i where i.ref = any (p_refs) and i.public_visibility and cardinality(p_refs) <= 50 $$;
revoke all on function issue_affected_counts(text[]) from public;
grant execute on function issue_affected_counts(text[]) to anon, authenticated;

-- Follows ----------------------------------------------------------------------------------------------------------
-- p_target: issue ref, constituency key, or category key, according to p_type. Idempotent; 200 follows per user.
create or replace function add_follow(p_type text, p_target text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_issue uuid; v_area uuid; v_cat text; v_id uuid;
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
  else
    raise exception 'unknown follow type' using errcode = 'JK002', detail = 'type';
  end if;
  insert into follows (user_id, target_type, issue_id, constituency_id, category) values (uid, p_type, v_issue, v_area, v_cat)
    on conflict do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from follows where user_id = uid and target_type = p_type and issue_id is not distinct from v_issue
      and constituency_id is not distinct from v_area and category is not distinct from v_cat;
  end if;
  return jsonb_build_object('id', v_id, 'type', p_type, 'target', p_target);
end $$;

create or replace function remove_follow(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  delete from follows where id = p_id and user_id = auth.uid();
  if not found then raise exception 'follow not found' using errcode = 'JK404'; end if;
end $$;
revoke all on function add_follow(text, text), remove_follow(uuid) from public, anon;
grant execute on function add_follow(text, text), remove_follow(uuid) to authenticated;
