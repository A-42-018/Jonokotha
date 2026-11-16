-- Reference data (0.5). Repeatable: upserts by key. Run after migrations 0001-0003.
-- Agencies are real bodies; the URL is their official site, reachability checked on checked_at.
-- Which agency serves a given area, and contact channels, must still be verified per constituency.

insert into constituencies (key, name_bn, name_en, boundary_source, is_demo)
values ('demo-1', 'নমুনা নির্বাচনী এলাকা', 'Sample Constituency', null, true)
on conflict (key) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, is_demo = excluded.is_demo;

insert into agencies (key, name_bn, name_en, categories, source, url, checked_at) values
  ('ag-lged',   'স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)', 'Local Government Engineering Department (LGED)', '{roads,facilities}',         'lged.gov.bd', 'https://lged.gov.bd', '2026-11-16'),
  ('ag-wasa',   'ঢাকা ওয়াসা', 'Dhaka WASA', '{drainage,water,flooding}', 'dwasa.org.bd', 'https://dwasa.org.bd', '2026-11-16'),
  ('ag-power',  'ঢাকা পাওয়ার ডিস্ট্রিবিউশন কোম্পানি (ডিপিডিসি)', 'Dhaka Power Distribution Company (DPDC)', '{electricity}', 'dpdc.org.bd', 'https://dpdc.org.bd', '2026-11-16'),
  ('ag-city',   'ঢাকা উত্তর সিটি কর্পোরেশন', 'Dhaka North City Corporation', '{waste,environment,health}', 'dncc.gov.bd', 'https://dncc.gov.bd', '2026-11-16'),
  ('ag-edu',    'প্রাথমিক শিক্ষা অধিদপ্তর', 'Directorate of Primary Education', '{education}', 'dpe.gov.bd', 'https://dpe.gov.bd', '2026-11-16'),
  ('ag-police', 'ঢাকা মেট্রোপলিটন পুলিশ', 'Dhaka Metropolitan Police', '{safety}', 'dmp.gov.bd', 'https://dmp.gov.bd', '2026-11-16'),
  ('ag-office', 'এমপি অফিস (সরাসরি)', 'MP office (direct)', '{other}', '—', null, null)
on conflict (key) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, categories = excluded.categories,
  source = excluded.source, url = excluded.url, checked_at = excluded.checked_at;
