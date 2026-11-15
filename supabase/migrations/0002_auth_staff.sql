-- Sprint 0 part 2: profile auto-create, staff role policies, ref numbers, event trigger.

-- Simplify: agencies/constituency keys live in app code for now.
alter table cases drop column if exists ai_agency_id;
alter table cases drop column if exists constituency_id;
alter table cases add column if not exists ai_agency text;
alter table cases add column if not exists constituency_key text not null default 'demo-1';
alter table cases add column if not exists ai_similar text[] not null default '{}';

-- Human-friendly reference numbers: JK-2026-1001, 1002, ...
create sequence if not exists case_ref_seq start 1001;
alter table cases alter column ref set default ('JK-' || extract(year from now())::int || '-' || nextval('case_ref_seq'));

-- Profile for every new auth user.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
insert into profiles (id, display_name)
  select id, split_part(coalesce(email, ''), '@', 1) from auth.users on conflict (id) do nothing;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff','admin'));
$$;

-- Staff may update cases (status changes); citizens cannot.
drop policy if exists "staff update cases" on cases;
create policy "staff update cases" on cases for update using (is_staff()) with check (is_staff());

-- Audit: every insert / status change writes a case event.
create or replace function log_case_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into case_events (case_id, status, actor_id) values (new.id, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into case_events (case_id, status, actor_id) values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists case_event_trg on cases;
create trigger case_event_trg after insert or update on cases for each row execute function log_case_event();

-- Staff can read all profiles (to see roles); users read their own.
drop policy if exists "staff read profiles" on profiles;
create policy "staff read profiles" on profiles for select using (is_staff());
