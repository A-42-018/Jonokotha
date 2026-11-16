-- Demo accounts for the dev-period one-click login (src/lib/demo.ts). Run in the Supabase SQL editor.
-- Replace __DEMO_PASSWORD__ with the value of DEMO_PASSWORD from .env.local. Never commit the real value.
-- Remove these users and unset DEMO_LOGIN before real use:
--   delete from auth.users where email in ('demo-citizen@jonokotha.test','demo-staff@jonokotha.test');
create extension if not exists pgcrypto;
do $$
declare r record; uid uuid;
begin
  for r in select * from (values ('demo-citizen@jonokotha.test', 'citizen'), ('demo-staff@jonokotha.test', 'staff')) as t(email, role) loop
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
select u.email, p.role from profiles p join auth.users u on u.id = p.id where u.email like 'demo-%@jonokotha.test';
