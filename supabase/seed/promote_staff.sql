-- Promote one account to staff (0.3). Run in the Supabase SQL editor. Replace the email first.
update profiles set role = 'staff'
where id = (select id from auth.users where email = 'REPLACE_WITH_STAFF_EMAIL');
-- Check:
select p.id, u.email, p.role from profiles p join auth.users u on u.id = p.id order by p.created_at;
