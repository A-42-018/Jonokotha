-- MP directory (13th Jatiya Sangsad): seat numbers, Bangla names, aliases, term bookkeeping and a repeatable admin import.
-- Requires 0004-0023. Data file: supabase/seed/data/mps-13th-2026-11-16.json. Loader: npm run import:mps.

alter table constituencies add column if not exists seat_no integer;
alter table constituencies add column if not exists division_bn text;
alter table constituencies add column if not exists district_bn text;
alter table constituencies add column if not exists aliases text[] not null default '{}';
alter table constituencies add column if not exists seat_status text not null default 'serving' check (seat_status in ('serving','vacant'));
alter table constituencies add column if not exists seat_note text check (seat_note is null or char_length(seat_note) <= 600);
create unique index if not exists constituencies_seat_no_uq on constituencies (seat_no) where seat_no is not null;
alter table constituencies drop constraint if exists constituencies_seat_no_range;
alter table constituencies add constraint constituencies_seat_no_range check (seat_no is null or seat_no between 1 and 300);

alter table representatives add column if not exists full_name_bn text;
alter table representatives add column if not exists party_name_bn text;
alter table representatives add column if not exists role_note text;
alter table representatives add column if not exists elected_on date;
alter table representatives add column if not exists elected_how text check (elected_how is null or elected_how in ('general','by_election','rescheduled'));
alter table representatives add column if not exists source_id uuid references knowledge_sources on delete set null;
alter table representatives add column if not exists review_flags text[] not null default '{}';   -- things a person must check before verifying
alter table representatives add column if not exists photo_path text;                              -- storage path, filled by scripts/fetch-mp-photos.mjs
alter table representatives add column if not exists photo_source_url text check (photo_source_url is null or photo_source_url ~ '^https?://');
alter table representatives add column if not exists photo_checked_at date;

-- Admin-only, audited, safe to run twice. Imported records start as 'pending': a person verifies them (verify_representative).
-- p_items: [{seat_no, key, name_en, name_bn, aliases_en[], division_en, division_bn, district_en, district_bn, status, note,
--            mp: null | {name_en, name_bn, party_en, party_bn, elected_how, elected_on, role_note, profile_url}, review[]}]
create or replace function import_representatives(p_source jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid; it jsonb; mp jsonb; c constituencies%rowtype; cur representatives%rowtype; rid uuid;
  n_seats integer := 0; n_new integer := 0; n_changed integer := 0; n_closed integer := 0; n_same integer := 0;
  flags text[]; seat integer;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'items' using errcode = 'JK002', detail = 'items'; end if;
  if coalesce(p_source ->> 'name', '') = '' or coalesce(p_source ->> 'url', '') !~ '^https?://' or coalesce(p_source ->> 'license', '') = '' or coalesce(p_source ->> 'fetched_at', '') = '' then
    raise exception 'the import needs the source name, link, licence and fetch date' using errcode = 'JK002', detail = 'source';
  end if;
  insert into knowledge_sources (name, url, license_or_terms, collection_method, fetched_at, is_demo)
  values (p_source ->> 'name', p_source ->> 'url', p_source ->> 'license', 'file', (p_source ->> 'fetched_at')::timestamptz, false) returning id into sid;

  for it in select * from jsonb_array_elements(p_items) loop
    seat := (it ->> 'seat_no')::integer;
    if it ->> 'key' !~ '^bd-[0-9]{3}$' or seat not between 1 and 300 or coalesce(it ->> 'name_en', '') = '' or coalesce(it ->> 'name_bn', '') = ''
       or it ->> 'status' not in ('serving','vacant') or (it ->> 'status' = 'serving' and jsonb_typeof(it -> 'mp') <> 'object') then
      raise exception 'invalid seat %', coalesce(it ->> 'key', '?') using errcode = 'JK002', detail = 'items';
    end if;
    select * into c from constituencies where seat_no = seat;
    if not found then
      insert into constituencies (key, seat_no, name_en, name_bn, division, division_bn, district, district_bn, aliases, seat_status, seat_note, is_demo, is_active, boundary_source)
      values (it ->> 'key', seat, it ->> 'name_en', it ->> 'name_bn', it ->> 'division_en', it ->> 'division_bn', it ->> 'district_en', it ->> 'district_bn',
              coalesce(array(select jsonb_array_elements_text(it -> 'aliases_en')), '{}'), it ->> 'status', left(it ->> 'note', 600), false, true, null)
      returning * into c;
    else
      update constituencies set name_en = it ->> 'name_en', name_bn = it ->> 'name_bn', division = it ->> 'division_en', division_bn = it ->> 'division_bn',
        district = it ->> 'district_en', district_bn = it ->> 'district_bn', aliases = coalesce(array(select jsonb_array_elements_text(it -> 'aliases_en')), '{}'),
        seat_status = it ->> 'status', seat_note = left(it ->> 'note', 600), is_demo = false, is_active = true
      where id = c.id;
    end if;
    n_seats := n_seats + 1;

    select r.* into cur from representatives r join representative_constituencies rc on rc.representative_id = r.id
      where rc.constituency_id = c.id and rc.valid_to is null order by rc.valid_from desc limit 1;
    mp := it -> 'mp';

    -- vacant seat, or a different person now holds it: close the old term (valid_to), keep the record.
    if found and (it ->> 'status' = 'vacant' or cur.full_name <> mp ->> 'name_en') then
      update representative_constituencies set valid_to = coalesce((mp ->> 'elected_on')::date, current_date)
        where representative_id = cur.id and constituency_id = c.id and valid_to is null;
      update representatives set term_end = coalesce((mp ->> 'elected_on')::date, current_date) where id = cur.id;
      n_closed := n_closed + 1;
      cur := null;
    end if;
    if it ->> 'status' = 'vacant' then continue; end if;

    flags := coalesce(array(select jsonb_array_elements_text(it -> 'review')), '{}');
    if cur.id is null then
      insert into representatives (full_name, full_name_bn, office_title, party_name, party_name_bn, role_note, elected_on, elected_how, term_start, source_url, source_id,
                                   verification_status, review_flags, is_demo)
      values (mp ->> 'name_en', mp ->> 'name_bn', 'Member of Parliament', mp ->> 'party_en', mp ->> 'party_bn', mp ->> 'role_note', (mp ->> 'elected_on')::date,
              mp ->> 'elected_how', (mp ->> 'elected_on')::date, mp ->> 'profile_url', sid, 'pending', flags, false) returning id into rid;
      insert into representative_constituencies (representative_id, constituency_id, valid_from) values (rid, c.id, (mp ->> 'elected_on')::date);
      n_new := n_new + 1;
    elsif cur.full_name_bn is distinct from mp ->> 'name_bn' or cur.party_name is distinct from mp ->> 'party_en' or cur.party_name_bn is distinct from mp ->> 'party_bn'
          or cur.role_note is distinct from mp ->> 'role_note' or cur.review_flags is distinct from flags then
      -- A changed fact goes back to 'pending' so a person looks at it again; unchanged facts keep their verification.
      update representatives set full_name_bn = mp ->> 'name_bn', party_name = mp ->> 'party_en', party_name_bn = mp ->> 'party_bn', role_note = mp ->> 'role_note',
        review_flags = flags, source_url = mp ->> 'profile_url', source_id = sid,
        verification_status = case when cur.verification_status = 'verified' then 'pending' else cur.verification_status end
      where id = cur.id;
      n_changed := n_changed + 1;
    else
      n_same := n_same + 1;
    end if;
  end loop;
  perform audit_write('representative.import', 'knowledge_source', sid::text, null, jsonb_build_object('seats', n_seats, 'new', n_new, 'changed', n_changed, 'closed', n_closed),
                      jsonb_build_object('source', p_source ->> 'name'));
  return jsonb_build_object('source_id', sid, 'seats', n_seats, 'new', n_new, 'changed', n_changed, 'terms_closed', n_closed, 'unchanged', n_same);
exception when check_violation or invalid_text_representation or datetime_field_overflow or not_null_violation then
  raise exception 'invalid import data' using errcode = 'JK002', detail = 'items';
end $$;
revoke all on function import_representatives(jsonb, jsonb) from public, anon;
grant execute on function import_representatives(jsonb, jsonb) to authenticated;
