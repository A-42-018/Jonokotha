-- Public bucket for MP photos copied from the official parliament.gov.bd profile (scripts/fetch-mp-photos.mjs).
-- Public read (faces of public officials, one small JPEG each); writes only by the server with the service role.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rep-photos', 'rep-photos', true, 1048576, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
  end if;
end $$;
