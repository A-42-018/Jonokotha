-- Area search for the 300 seats: Bangla or English name, seat number (Bangla or English digits), old spellings (aliases), district, division.
-- Bangla digits are folded to 0-9 on both sides so "পঞ্চগড়-১" and "পঞ্চগড় 1" both find Panchagarh-1.
-- Folds text for matching: lower case, hyphens and spaces removed ("dhaka 17" finds Dhaka-17), Bangla digits to 0-9, and the three precomposed letters (ড় ঢ় য়) to base letter + nukta,
-- because keyboards produce either form and the stored names use the decomposed one.
create or replace function search_fold(t text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(replace(replace(replace(translate(lower(coalesce(t, '')), '০১২৩৪৫৬৭৮৯', '0123456789'),
    U&'\09DC', U&'\09A1\09BC'), U&'\09DD', U&'\09A2\09BC'), U&'\09DF', U&'\09AF\09BC'), '[-\s]+', '', 'g') $$;
grant execute on function search_fold(text) to anon, authenticated;

drop function if exists search_constituencies(text);
create or replace function search_constituencies(p_q text)
returns table (key text, name_bn text, name_en text, district text, upazila_or_city text, is_demo boolean, seat_no integer, seat_status text, district_bn text, division text)
language sql stable security definer set search_path = public as $$
  with q as (select search_fold(btrim(p_q)) as s)
  select c.key, c.name_bn, c.name_en, c.district, c.upazila_or_city, c.is_demo, c.seat_no, c.seat_status, c.district_bn, c.division
  from constituencies c, q
  where c.is_active and char_length(btrim(p_q)) between 1 and 80 and (char_length(btrim(p_q)) >= 2 or q.s ~ '^[0-9]$')
    and (search_fold(c.name_bn) like '%' || q.s || '%' or search_fold(c.name_en) like '%' || q.s || '%' or c.seat_no::text = q.s
         or search_fold(array_to_string(c.aliases, ' ')) like '%' || q.s || '%'
         or search_fold(c.district) like '%' || q.s || '%' or search_fold(c.district_bn) like '%' || q.s || '%'
         or search_fold(c.upazila_or_city) like '%' || q.s || '%' or search_fold(c.ward_or_union) like '%' || q.s || '%'
         or search_fold(c.division) like '%' || q.s || '%' or search_fold(c.division_bn) like '%' || q.s || '%')
  order by (c.seat_no::text = q.s) desc, c.is_demo, c.seat_no nulls last, c.name_en limit 20 $$;
revoke all on function search_constituencies(text) from public;
grant execute on function search_constituencies(text) to anon, authenticated;
