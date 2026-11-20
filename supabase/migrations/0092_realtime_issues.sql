-- Live office queue: lets signed-in staff receive changes to `issues` over Supabase Realtime (postgres_changes).
-- Realtime applies row-level security per subscriber, so a staff member is only told about cases they may already read;
-- the browser then refreshes the page's server data (src/components/office/OfficeLive.tsx), it never trusts the payload.
-- Safe to run twice. NOT applied to the live database: apply it in order after review.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'issues') then
    alter publication supabase_realtime add table public.issues;
  end if;
end $$;
