-- Phase 5 (B5.12, B5.15; masterplan §2.8.4, §31 #21, §13.10, §4.4): country adapters as configuration, and Open311-ready identifiers.
-- Requires 0030-0035. Safe to run twice.
--
-- A country adapter is DATA: country code, locale, currency, date format, the administrative level names, which identity checks and notification
-- channels apply, and where the agency directory and categories come from. Shared modules read the adapter; they hold no Bangladesh-specific
-- constants. Bangladesh is the first adapter (src/lib/country/bd.ts is its code-side half: phone rules and numerals).

create table if not exists country_adapters (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name_en text not null,
  name_native text not null,
  default_locale text not null,
  locales text[] not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  date_format text not null,
  timezone text not null,
  admin_levels jsonb not null,
  identity_checks text[] not null default '{}',
  notification_channels text[] not null default '{}',
  emergency_numbers jsonb not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table country_adapters enable row level security;
drop policy if exists country_adapters_public on country_adapters;
create policy country_adapters_public on country_adapters for select using (true);
revoke all on country_adapters from anon, authenticated;
grant select on country_adapters to anon, authenticated;

insert into country_adapters (code, name_en, name_native, default_locale, locales, currency, date_format, timezone, admin_levels, identity_checks, notification_channels, emergency_numbers, is_active)
values ('BD', 'Bangladesh', 'বাংলাদেশ', 'bn', array['bn','en'], 'BDT', 'dd/MM/yyyy', 'Asia/Dhaka',
  '[{"level":"division","name_en":"Division","name_bn":"বিভাগ"},{"level":"district","name_en":"District","name_bn":"জেলা"},{"level":"upazila","name_en":"Upazila","name_bn":"উপজেলা"},{"level":"city","name_en":"City corporation or municipality","name_bn":"সিটি কর্পোরেশন বা পৌরসভা"},{"level":"union","name_en":"Union","name_bn":"ইউনিয়ন"},{"level":"ward","name_en":"Ward","name_bn":"ওয়ার্ড"}]',
  array['email_code'], array['in_app','web_push','email'], '{"general":"999"}', true)
on conflict (code) do nothing;

insert into app_settings (key, value, description) values ('country_code', '"BD"', 'The active country adapter (country_adapters.code)') on conflict (key) do nothing;

create or replace function active_country() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from app_settings where key = 'country_code'), 'BD') $$;
grant execute on function active_country() to anon, authenticated, service_role;

-- Admin: add or change an adapter. Switching the active country is a deliberate, audited step.
create or replace function set_country_adapter(p_code text, p_config jsonb, p_activate boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_code !~ '^[A-Z]{2}$' or jsonb_typeof(p_config) <> 'object' then raise exception 'config' using errcode = 'JK002', detail = 'code'; end if;
  insert into country_adapters (code, name_en, name_native, default_locale, locales, currency, date_format, timezone, admin_levels, identity_checks, notification_channels, emergency_numbers, is_active)
  values (p_code, p_config ->> 'name_en', p_config ->> 'name_native', p_config ->> 'default_locale', array(select jsonb_array_elements_text(p_config -> 'locales')), p_config ->> 'currency', p_config ->> 'date_format',
          p_config ->> 'timezone', coalesce(p_config -> 'admin_levels', '[]'), coalesce(array(select jsonb_array_elements_text(p_config -> 'identity_checks')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p_config -> 'notification_channels')), '{}'), coalesce(p_config -> 'emergency_numbers', '{}'), false)
  on conflict (code) do update set name_en = excluded.name_en, name_native = excluded.name_native, default_locale = excluded.default_locale, locales = excluded.locales, currency = excluded.currency,
    date_format = excluded.date_format, timezone = excluded.timezone, admin_levels = excluded.admin_levels, identity_checks = excluded.identity_checks, notification_channels = excluded.notification_channels, emergency_numbers = excluded.emergency_numbers;
  if p_activate then
    update country_adapters set is_active = (code = p_code);
    update app_settings set value = to_jsonb(p_code) where key = 'country_code';
  end if;
  perform audit_write('country_adapter.set', 'country_adapter', p_code, null, jsonb_build_object('activated', p_activate));
  return jsonb_build_object('code', p_code, 'active', p_activate);
exception when not_null_violation or check_violation or invalid_parameter_value then raise exception 'incomplete adapter configuration' using errcode = 'JK002', detail = 'config';
end $$;
revoke all on function set_country_adapter(text, jsonb, boolean) from public, anon;
grant execute on function set_country_adapter(text, jsonb, boolean) to authenticated;

-- Open311-ready identifiers (B5.15) ----------------------------------------------------------------------------------------------------------------
-- service_code on categories exists since 0031 (stable, never changes). The public service_request_id of an issue is its reference
-- (JK-2026-1001): unique, stable, never reused. The view maps both to Open311 GeoReport v2 field names so a later API is a pure read.
create or replace view public_open311_requests with (security_invoker = false) as
  select i.ref as service_request_id, ic.service_code, ic.name_en as service_name, i.description,
         case when i.status in ('resolved','closed') then 'closed' else 'open' end as status,
         i.status::text as status_detail, i.public_lat as lat, i.public_lng as long, i.created_at as requested_datetime, i.updated_at as updated_datetime,
         i.constituency_key, i.is_demo
  from issues i left join issue_categories ic on ic.slug = i.category where i.public_visibility;
grant select on public_open311_requests to anon, authenticated;

create or replace view public_open311_services with (security_invoker = false) as
  select service_code, name_en as service_name, name_bn as service_name_bn, 'realtime'::text as type, slug as group_slug
  from issue_categories where is_active;
grant select on public_open311_services to anon, authenticated;
