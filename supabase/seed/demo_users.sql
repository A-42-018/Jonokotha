-- Demo accounts for the dev-period one-click login (src/lib/demo.ts). Run in the Supabase SQL editor. Safe to run twice.
-- One account per role except admin (never created here). Replace __DEMO_PASSWORD__ with the value of DEMO_PASSWORD from .env.local.
-- Never commit the real value. Requires migrations 0006 (roles) and 0030 (office_members.agency_id).
-- Remove these users and unset DEMO_LOGIN before real use:
--   delete from auth.users where email in ('demo-citizen@jonokotha.test','demo-staff@jonokotha.test','demo-officer@jonokotha.test',
--     'demo-mp@jonokotha.test','demo-liaison@jonokotha.test','demo-moderator@jonokotha.test');
-- MFA: the MP and moderator accounts need TOTP once app_settings.enforce_mfa is true; until then they sign in with the password alone.
create extension if not exists pgcrypto;
do $$
declare r record; uid uuid;
begin
  for r in select * from (values
      ('demo-citizen@jonokotha.test', 'citizen'),
      ('demo-staff@jonokotha.test', 'staff'),
      ('demo-officer@jonokotha.test', 'staff'),
      ('demo-mp@jonokotha.test', 'staff'),
      ('demo-liaison@jonokotha.test', 'staff'),
      ('demo-moderator@jonokotha.test', 'moderator')
    ) as t(email, role) loop
    select id into uid from auth.users where email = r.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', r.email,
        crypt('__DEMO_PASSWORD__', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', r.email), 'email', now(), now(), now());
    else
      update auth.users set encrypted_password = crypt('__DEMO_PASSWORD__', gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()) where id = uid;
    end if;
    insert into profiles (id, display_name) values (uid, split_part(r.email, '@', 1)) on conflict (id) do nothing;
    update profiles set role = r.role where id = uid;
  end loop;
end $$;
-- Office roles, all in the sample constituency only (scoped; no access elsewhere). The liaison belongs to LGED, so it sees only cases
-- an office forwards to LGED; the case officer sees only cases assigned to it. Adding the MP makes demo-1 an area with an active MP,
-- so if its office turns on "MP approval required", announcements and public replies wait for demo-mp.
insert into office_members (user_id, constituency_id, office_role, agency_id)
select u.id, c.id, m.office_role, (select id from agencies where key = m.agency_key)
from (values
    ('demo-staff@jonokotha.test', 'office_manager', null),
    ('demo-officer@jonokotha.test', 'case_officer', null),
    ('demo-mp@jonokotha.test', 'mp', null),
    ('demo-liaison@jonokotha.test', 'agency_liaison', 'ag-lged')
  ) as m(email, office_role, agency_key)
join auth.users u on u.email = m.email
cross join constituencies c
where c.key = 'demo-1'
on conflict (user_id, constituency_id) do update set office_role = excluded.office_role, agency_id = excluded.agency_id, status = 'active';
select u.email, p.role, m.office_role, a.key as agency from profiles p join auth.users u on u.id = p.id
left join office_members m on m.user_id = p.id and m.status = 'active'
left join agencies a on a.id = m.agency_id
where u.email like 'demo-%@jonokotha.test' order by u.email;
