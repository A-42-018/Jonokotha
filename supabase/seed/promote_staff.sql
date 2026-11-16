-- Promote one account to staff and give it an office role in one constituency. Run in the Supabase SQL editor.
-- Replace the email and, if needed, the constituency key and office role
-- (case_officer | office_manager | mp | agency_liaison). Staff with no membership can see no private cases.
update profiles set role = 'staff'
where id = (select id from auth.users where email = 'REPLACE_WITH_STAFF_EMAIL');

insert into office_members (user_id, constituency_id, office_role)
select u.id, c.id, 'office_manager'
from auth.users u, constituencies c
where u.email = 'REPLACE_WITH_STAFF_EMAIL' and c.key = 'demo-1'
on conflict (user_id, constituency_id) do update set office_role = excluded.office_role, status = 'active';

-- Check:
select p.id, u.email, p.role, m.office_role, c.key as constituency
from profiles p join auth.users u on u.id = p.id
left join office_members m on m.user_id = p.id and m.status = 'active'
left join constituencies c on c.id = m.constituency_id
order by p.created_at;
