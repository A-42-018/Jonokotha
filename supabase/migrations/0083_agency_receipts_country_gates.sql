-- Phase 8 (B8.2, B8.10, erasure of Phase 8 data; masterplan §4.4, §2.8.4): signed agency receipts, second-country readiness gates.
-- Requires 0004-0082. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 8 status):
--   * "Officially registered" (B5.4) still needs a CONFIRMED integration (an administrator's statement that the agency's system accepts our referrals).
--     This file adds the one honest automatic path: an agency that really runs such a system can sign a receipt with its private key (Ed25519); we keep
--     only the PUBLIC key. A receipt is accepted only for a referral to THAT agency, only through a confirmed integration with a key, and the signed text is stored
--     as the proof. No agency has such a system today: nothing is registered by this code until one does, and no key is seeded.
--   * A second country can be activated only when five reviews (legal, electoral, data protection, language, hosting and residency) are each recorded as
--     cleared with a reference to the document and the name of the external reviewer. The platform cannot judge those reviews; it records who stands behind them.

alter table agency_integrations add column if not exists public_key_pem text check (public_key_pem is null or (char_length(public_key_pem) between 60 and 800 and public_key_pem like '-----BEGIN PUBLIC KEY-----%'));
alter table agency_integrations add column if not exists key_fingerprint text check (key_fingerprint is null or key_fingerprint ~ '^[0-9a-f]{64}$');
alter table agency_integrations add column if not exists key_set_at timestamptz;

-- Admin: attach (or rotate) the agency's public key. The fingerprint is computed by the API from the key's DER form.
create or replace function set_agency_integration_key(p_integration uuid, p_public_key text, p_fingerprint text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v agency_integrations%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into v from agency_integrations where id = p_integration;
  if not found or v.status = 'retired' then raise exception 'integration not found' using errcode = 'JK404'; end if;
  update agency_integrations set public_key_pem = p_public_key, key_fingerprint = p_fingerprint, key_set_at = now() where id = v.id;
  perform audit_write('agency_integration.key', 'agency', v.agency_id::text, jsonb_build_object('fingerprint', v.key_fingerprint), jsonb_build_object('fingerprint', p_fingerprint), jsonb_build_object('integration', v.id));
  return jsonb_build_object('id', v.id, 'key_fingerprint', p_fingerprint);
exception when check_violation then raise exception 'invalid key' using errcode = 'JK002', detail = 'public_key';
end $$;
revoke all on function set_agency_integration_key(uuid, text, text) from public, anon;
grant execute on function set_agency_integration_key(uuid, text, text) to authenticated;

-- Admin overview of integrations (no keys, only fingerprints).
create or replace function list_agency_integrations() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'agency_id', i.agency_id, 'agency', a.name_en, 'kind', i.kind, 'status', i.status, 'has_key', i.public_key_pem is not null,
    'key_fingerprint', i.key_fingerprint, 'confirmed_at', i.confirmed_at,
    'receipts', (select count(*)::int from agency_receipts r where r.integration_id = i.id)) order by i.created_at desc), '[]')
    from agency_integrations i join agencies a on a.id = i.agency_id);
end $$;
revoke all on function list_agency_integrations() from public, anon;
grant execute on function list_agency_integrations() to authenticated;

create table if not exists agency_receipts (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references agency_integrations on delete restrict,
  referral_id uuid not null references issue_agency_referrals on delete cascade,
  agency_reference text not null check (char_length(agency_reference) between 1 and 120),
  issued_at timestamptz not null,
  signature_sha256 text not null check (signature_sha256 ~ '^[0-9a-f]{64}$'),
  key_fingerprint text not null,
  received_at timestamptz not null default now(),
  unique (integration_id, referral_id, signature_sha256)
);
alter table agency_receipts enable row level security;
drop policy if exists agency_receipts_select on agency_receipts;
create policy agency_receipts_select on agency_receipts for select using (is_admin());
revoke all on agency_receipts from anon, authenticated;
grant select on agency_receipts to authenticated;

-- Called by the API only after it verified the signature (service role). Everything else is rechecked here.
create or replace function record_agency_receipt(p_integration uuid, p_referral uuid, p_reference text, p_issued_at timestamptz, p_signature_sha256 text, p_fingerprint text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g agency_integrations%rowtype; r issue_agency_referrals%rowtype;
begin
  select * into g from agency_integrations where id = p_integration;
  if not found or g.status <> 'confirmed' or g.public_key_pem is null or g.key_fingerprint is distinct from p_fingerprint then raise exception 'no confirmed integration with this key' using errcode = 'JK003', detail = 'no_integration'; end if;
  select * into r from issue_agency_referrals where id = p_referral;
  if not found or r.agency_id is distinct from g.agency_id then raise exception 'referral not found for this agency' using errcode = 'JK404'; end if;
  if p_issued_at > now() + interval '5 minutes' or p_issued_at < now() - interval '7 days' then raise exception 'the receipt is too old or from the future' using errcode = 'JK003', detail = 'stale_receipt'; end if;
  if char_length(btrim(coalesce(p_reference, ''))) < 1 then raise exception 'reference' using errcode = 'JK002', detail = 'agency_reference'; end if;
  insert into agency_receipts (integration_id, referral_id, agency_reference, issued_at, signature_sha256, key_fingerprint) values (g.id, r.id, btrim(p_reference), p_issued_at, p_signature_sha256, p_fingerprint)
  on conflict do nothing;
  if r.registration_status = 'officially_registered' then return jsonb_build_object('referral', r.id, 'registration_status', r.registration_status, 'already', true); end if;
  update issue_agency_referrals set registration_status = 'officially_registered', registration_reference = btrim(p_reference),
    registration_proof = 'Signed receipt from the agency system (key ' || left(p_fingerprint, 12) || ', issued ' || to_char(p_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') || ')',
    integration_id = g.id, registered_at = now(), registered_by = null where id = r.id;
  perform audit_write('referral.register_by_receipt', 'issue', r.issue_id::text, jsonb_build_object('registration_status', r.registration_status), jsonb_build_object('registration_status', 'officially_registered'), jsonb_build_object('referral', r.id, 'integration', g.id));
  return jsonb_build_object('referral', r.id, 'registration_status', 'officially_registered', 'already', false);
end $$;
revoke all on function record_agency_receipt(uuid, uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function record_agency_receipt(uuid, uuid, text, timestamptz, text, text) to service_role;

-- The API needs the public key to verify a signature (service role only).
create or replace function agency_integration_key(p_integration uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('public_key_pem', public_key_pem, 'key_fingerprint', key_fingerprint, 'status', status) from agency_integrations where id = p_integration $$;
revoke all on function agency_integration_key(uuid) from public, anon, authenticated;
grant execute on function agency_integration_key(uuid) to service_role;

-- Second-country readiness (B8.10) --------------------------------------------------------------------------------------------------------------------------------
create table if not exists country_gates (
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  gate text not null check (gate in ('legal_review','electoral_review','data_protection_review','language_review','hosting_residency')),
  status text not null default 'open' check (status in ('open','cleared')),
  evidence_ref text check (evidence_ref is null or char_length(evidence_ref) between 5 and 300),
  reviewer text check (reviewer is null or char_length(reviewer) between 3 and 150),
  note text check (note is null or char_length(note) <= 500),
  cleared_by uuid references profiles on delete set null,
  cleared_at timestamptz,
  primary key (country_code, gate),
  check (status <> 'cleared' or (evidence_ref is not null and reviewer is not null and cleared_by is not null and cleared_at is not null))
);
alter table country_gates enable row level security;
drop policy if exists country_gates_select on country_gates;
create policy country_gates_select on country_gates for select using (is_admin());
revoke all on country_gates from anon, authenticated;
grant select on country_gates to authenticated;

create or replace function set_country_gate(p_code text, p_gate text, p_status text, p_evidence text default null, p_reviewer text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_code = 'BD' then raise exception 'the home country has no pilot gates' using errcode = 'JK003', detail = 'home_country'; end if;
  if not exists (select 1 from country_adapters where code = p_code) then raise exception 'country adapter not found' using errcode = 'JK404'; end if;
  if p_status not in ('open','cleared') then raise exception 'status' using errcode = 'JK002', detail = 'status'; end if;
  if p_status = 'cleared' and (char_length(btrim(coalesce(p_evidence, ''))) < 5 or char_length(btrim(coalesce(p_reviewer, ''))) < 3) then raise exception 'a document reference and the reviewer are needed' using errcode = 'JK002', detail = 'evidence_ref'; end if;
  insert into country_gates (country_code, gate, status, evidence_ref, reviewer, note, cleared_by, cleared_at)
  values (p_code, p_gate, p_status, case when p_status = 'cleared' then btrim(p_evidence) end, case when p_status = 'cleared' then btrim(p_reviewer) end, nullif(btrim(coalesce(p_note, '')), ''),
          case when p_status = 'cleared' then auth.uid() end, case when p_status = 'cleared' then now() end)
  on conflict (country_code, gate) do update set status = excluded.status, evidence_ref = excluded.evidence_ref, reviewer = excluded.reviewer, note = excluded.note, cleared_by = excluded.cleared_by, cleared_at = excluded.cleared_at;
  -- Reopening any gate of an active country does not switch the country off silently: it is reported by country_readiness and blocks the NEXT activation.
  perform audit_write('country_gate.' || p_status, 'country_adapter', p_code, null, jsonb_build_object('gate', p_gate, 'status', p_status), jsonb_build_object('reviewer', p_reviewer));
  return jsonb_build_object('country', p_code, 'gate', p_gate, 'status', p_status);
exception when check_violation then raise exception 'invalid gate' using errcode = 'JK002', detail = 'gate';
end $$;

create or replace function country_readiness(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare gates jsonb;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('gate', g.gate, 'status', coalesce(cg.status, 'open'), 'evidence_ref', cg.evidence_ref, 'reviewer', cg.reviewer, 'cleared_at', cg.cleared_at) order by g.gate), '[]') into gates
  from unnest(array['data_protection_review','electoral_review','hosting_residency','language_review','legal_review']) as g(gate) left join country_gates cg on cg.country_code = p_code and cg.gate = g.gate;
  return jsonb_build_object('country', p_code, 'home_country', p_code = 'BD', 'adapter_configured', exists (select 1 from country_adapters where code = p_code),
    'ready', p_code = 'BD' or not exists (select 1 from jsonb_array_elements(gates) x where x ->> 'status' <> 'cleared'), 'gates', gates);
end $$;
revoke all on function set_country_gate(text, text, text, text, text, text), country_readiness(text) from public, anon;
grant execute on function set_country_gate(text, text, text, text, text, text), country_readiness(text) to authenticated;

-- Activation of any country other than the home country now needs every gate cleared. (Replaces the B5.12 function; the body is the same plus the check.)
create or replace function set_country_adapter(p_code text, p_config jsonb, p_activate boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_code !~ '^[A-Z]{2}$' or jsonb_typeof(p_config) <> 'object' then raise exception 'config' using errcode = 'JK002', detail = 'code'; end if;
  if p_activate and p_code <> 'BD' and not coalesce((country_readiness(p_code) ->> 'ready')::boolean, false) then
    raise exception 'legal, electoral, data-protection, language and hosting reviews must all be cleared first' using errcode = 'JK003', detail = 'country_not_ready';
  end if;
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

-- Erasure of Phase 8 data (called from erase_user_data, which is guarded by legal holds in 0061) --------------------------------------------------------------------
create or replace function erase_phase8_data(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from rti_drafts where user_id = p_user;
  delete from pb_ballots where user_id = p_user;
  update volunteers set status = 'withdrawn', decided_at = now() where user_id = p_user and status <> 'withdrawn';
  update regional_admins set status = 'revoked', revoked_at = coalesce(revoked_at, now()) where user_id = p_user and status <> 'revoked';
end $$;
revoke all on function erase_phase8_data(uuid) from public, anon, authenticated;

create or replace function erase_user_data(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if legal_hold_active(p_user) then
    perform audit_write('privacy.erasure_blocked_by_hold', 'profile', p_user::text, null, null, '{}');
    return jsonb_build_object('erased', false, 'held', true);
  end if;
  r := erase_user_data_unchecked(p_user);
  if coalesce((r ->> 'erased')::boolean, false) then perform erase_phase7_data(p_user); perform erase_phase8_data(p_user); end if;
  return r;
end $$;
revoke all on function erase_user_data(uuid) from public, anon, authenticated;
grant execute on function erase_user_data(uuid) to service_role;
