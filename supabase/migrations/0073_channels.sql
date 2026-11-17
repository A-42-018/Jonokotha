-- Phase 7 (B7.2, B7.4; masterplan §7.15, §8.12, §15, §19.7): WhatsApp and SMS intake, channel notifications, area alerts and provider cost alerts.
-- Requires 0070-0072. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 7 status):
--   * Identity first. A message is only turned into anything for a phone number that a signed-in verified citizen linked from the app: the app
--     shows a one-time code, the citizen sends it from that number, and the webhook confirms the sender's number equals the number claimed.
--     So every message maps to a real account (same reference numbers, timeline, privacy rules and rate limits as the app). Unknown numbers get
--     one fixed "link your account" reply and nothing about them is stored.
--   * Consent and the privacy notice come first: linking records a consent (consent_type channel_whatsapp / channel_sms, with the policy version)
--     and the first message back is the privacy notice. Revoking a link deletes the number.
--   * A case is only created after "হ্যাঁ"/"yes" to the draft. Nothing is created from an unconfirmed message.
--   * Stored message text is kept 90 days (purge_channel_messages) and is erased with the account.
--   * Costs: the operator sets the per-message price (environment); we never guess one. Monthly budgets per channel raise an administrator alert
--     at 80 percent and pause non-essential sends at 100 percent.
--   * SMS and WhatsApp updates go only to people who switched that channel on AND have an active link, only for their own case updates and
--     replies and for area alerts, and never carry report details (generic title and reference only).

alter table issues add column if not exists source_channel text not null default 'app' check (source_channel in ('app','whatsapp','sms'));

-- Delivery channels ------------------------------------------------------------------------------------------------------------------------------------
alter table notification_deliveries drop constraint if exists notification_deliveries_channel_check;
alter table notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('push','email','sms','whatsapp'));

-- Links ------------------------------------------------------------------------------------------------------------------------------------------------
create table if not exists channel_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  channel text not null check (channel in ('whatsapp','sms')),
  address text check (address is null or address ~ '^\+[1-9][0-9]{7,14}$'),
  address_hash text,
  address_hint text,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  code_hash text,
  code_expires_at timestamptz,
  consent_id uuid references consents on delete set null,
  updates_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  last_inbound_at timestamptz,
  check (status = 'revoked' or (address is not null and address_hash is not null))
);
create unique index if not exists channel_links_active_address on channel_links (channel, address_hash) where status = 'active';
create unique index if not exists channel_links_user_channel on channel_links (user_id, channel) where status in ('pending','active');
create index if not exists channel_links_code_idx on channel_links (code_hash) where status = 'pending';
alter table channel_links enable row level security;
drop policy if exists channel_links_own on channel_links;
create policy channel_links_own on channel_links for select using (user_id = auth.uid());
revoke all on channel_links from anon, authenticated;
grant select (id, user_id, channel, address_hint, status, code_expires_at, updates_enabled, created_at, verified_at) on channel_links to authenticated;

create table if not exists channel_conversations (
  link_id uuid primary key references channel_links on delete cascade,
  state text not null default 'idle' check (state in ('idle','awaiting_confirm')),
  draft jsonb,
  privacy_notice_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table channel_conversations enable row level security;
revoke all on channel_conversations from anon, authenticated;

create table if not exists channel_messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references channel_links on delete set null,
  channel text not null check (channel in ('whatsapp','sms')),
  direction text not null check (direction in ('in','out')),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  body text check (body is null or char_length(body) <= 2000),
  kind text not null default 'text' check (kind in ('text','image','location','other')),
  segments integer not null default 1 check (segments between 0 and 20),
  cost_usd numeric check (cost_usd is null or cost_usd >= 0),
  status text not null default 'received' check (status in ('received','queued','sent','failed','skipped')),
  note text check (note is null or char_length(note) <= 200),
  issue_ref text,
  created_at timestamptz not null default now()
);
create unique index if not exists channel_messages_provider_uq on channel_messages (channel, direction, provider_message_id) where provider_message_id is not null;
create index if not exists channel_messages_month_idx on channel_messages (channel, created_at);
alter table channel_messages enable row level security;
revoke all on channel_messages from anon, authenticated;

create table if not exists channel_budgets (
  channel text not null check (channel in ('whatsapp','sms')),
  month date not null check (month = date_trunc('month', month)::date),
  budget_usd numeric not null check (budget_usd > 0),
  alerted_80 boolean not null default false,
  alerted_100 boolean not null default false,
  updated_by uuid references profiles on delete set null,
  primary key (channel, month)
);
alter table channel_budgets enable row level security;
drop policy if exists channel_budgets_admin on channel_budgets;
create policy channel_budgets_admin on channel_budgets for select using (is_admin());
revoke all on channel_budgets from anon, authenticated;
grant select on channel_budgets to authenticated;

-- Linking (citizen) -------------------------------------------------------------------------------------------------------------------------------
create or replace function start_channel_link(p_channel text, p_address text, p_policy_version text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); code text; cid uuid; v channel_links%rowtype; a text := regexp_replace(coalesce(p_address, ''), '[\s-]', '', 'g');
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  if p_channel not in ('whatsapp','sms') then raise exception 'channel' using errcode = 'JK002', detail = 'channel'; end if;
  if a !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'phone number' using errcode = 'JK002', detail = 'address'; end if;
  if char_length(btrim(coalesce(p_policy_version, ''))) < 1 then raise exception 'policy version' using errcode = 'JK002', detail = 'policy_version'; end if;
  if exists (select 1 from channel_links where channel = p_channel and address_hash = encode(extensions.digest(a, 'sha256'), 'hex') and status = 'active' and user_id <> uid) then
    raise exception 'this number is linked to another account' using errcode = 'JK003', detail = 'address_in_use';
  end if;
  if (select count(*) from channel_links where user_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'too many link attempts today' using errcode = 'JK003', detail = 'link_limit'; end if;
  update channel_links set status = 'revoked', address = null, address_hash = null, address_hint = null, code_hash = null, updates_enabled = false where user_id = uid and channel = p_channel and status in ('pending','active');
  insert into consents (user_id, consent_type, policy_version) values (uid, 'channel_' || p_channel, btrim(p_policy_version)) returning id into cid;
  code := 'JK' || lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))::bit(28)::int) % 1000000)::text, 6, '0');
  insert into channel_links (user_id, channel, address, address_hash, address_hint, code_hash, code_expires_at, consent_id)
  values (uid, p_channel, a, encode(extensions.digest(a, 'sha256'), 'hex'), '…' || right(a, 3), encode(extensions.digest(code, 'sha256'), 'hex'), now() + interval '30 minutes', cid) returning * into v;
  perform audit_write('channel.link_started', 'channel_link', v.id::text, null, jsonb_build_object('channel', p_channel), '{}');
  return jsonb_build_object('id', v.id, 'channel', p_channel, 'status', 'pending', 'code', code, 'code_expires_at', v.code_expires_at, 'address_hint', v.address_hint);
end $$;

create or replace function revoke_channel_link(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v channel_links%rowtype;
begin
  select * into v from channel_links where id = p_id and user_id = auth.uid();
  if not found or v.status = 'revoked' then raise exception 'link not found' using errcode = 'JK404'; end if;
  update channel_links set status = 'revoked', address = null, address_hash = null, address_hint = null, code_hash = null, updates_enabled = false where id = v.id;
  delete from channel_conversations where link_id = v.id;
  update consents set withdrawn_at = now() where id = v.consent_id and withdrawn_at is null;
  update channel_messages set body = null where link_id = v.id;
  perform audit_write('channel.link_revoked', 'channel_link', v.id::text, null, jsonb_build_object('channel', v.channel), '{}');
  return jsonb_build_object('id', v.id, 'status', 'revoked');
end $$;

create or replace function set_channel_updates(p_id uuid, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update channel_links set updates_enabled = coalesce(p_enabled, updates_enabled) where id = p_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'link not found' using errcode = 'JK404'; end if;
  return jsonb_build_object('id', p_id, 'updates_enabled', p_enabled);
end $$;

-- Webhook side (service role only) ------------------------------------------------------------------------------------------------------------------
-- The sender sent a code: confirm only when the number matches the one claimed and the code is unexpired.
create or replace function channel_confirm_link(p_channel text, p_address text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v channel_links%rowtype;
begin
  select * into v from channel_links where channel = p_channel and status = 'pending' and code_hash = encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex') and code_expires_at > now()
     and address_hash = encode(extensions.digest(p_address, 'sha256'), 'hex');
  if not found then return jsonb_build_object('linked', false); end if;
  update channel_links set status = 'active', code_hash = null, code_expires_at = null, verified_at = now(), last_inbound_at = now() where id = v.id;
  insert into channel_conversations (link_id) values (v.id) on conflict do nothing;
  perform audit_write('channel.link_confirmed', 'channel_link', v.id::text, null, jsonb_build_object('channel', p_channel), '{}');
  return jsonb_build_object('linked', true, 'link_id', v.id, 'user_id', v.user_id);
end $$;
create or replace function channel_find_link(p_channel text, p_address text) returns table (link_id uuid, user_id uuid, updates_enabled boolean, state text, draft jsonb, privacy_notice_sent_at timestamptz)
language sql security definer set search_path = public as $$
  select l.id, l.user_id, l.updates_enabled, coalesce(c.state, 'idle'), c.draft, c.privacy_notice_sent_at
  from channel_links l left join channel_conversations c on c.link_id = l.id
  join profiles p on p.id = l.user_id and p.account_status = 'active'
  where l.channel = p_channel and l.status = 'active' and l.address_hash = encode(extensions.digest(p_address, 'sha256'), 'hex') $$;

-- Monthly spend and whether a send is allowed (budget reached = pause, except for the confirmation of a case the citizen asked for).
create or replace function channel_spend(p_channel text, p_month date default date_trunc('month', now())::date) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('channel', p_channel, 'month', p_month,
    'messages_out', count(*) filter (where direction = 'out' and status in ('queued','sent')),
    'messages_in', count(*) filter (where direction = 'in'),
    'segments_out', coalesce(sum(segments) filter (where direction = 'out' and status in ('queued','sent')), 0),
    'spend_usd', coalesce(sum(cost_usd), 0),
    'messages_without_known_cost', count(*) filter (where direction = 'out' and status in ('queued','sent') and cost_usd is null),
    'budget_usd', (select b.budget_usd from channel_budgets b where b.channel = p_channel and b.month = p_month))
  from channel_messages where channel = p_channel and created_at >= p_month and created_at < (p_month + interval '1 month') $$;
revoke all on function channel_spend(text, date) from public, anon, authenticated;
grant execute on function channel_spend(text, date) to service_role;

create or replace function channel_send_allowed(p_channel text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce((channel_spend(p_channel) ->> 'spend_usd')::numeric, 0) < b.budget_usd from channel_budgets b where b.channel = p_channel and b.month = date_trunc('month', now())::date), true) $$;
revoke all on function channel_send_allowed(text) from public, anon, authenticated;
grant execute on function channel_send_allowed(text) to service_role;

-- Alerts (job): administrators hear once at 80 percent and once at 100 percent per channel and month.
create or replace function channel_cost_alerts() returns integer
language plpgsql security definer set search_path = public as $$
declare b record; s numeric; a record; n integer := 0; lvl integer;
begin
  for b in select * from channel_budgets where month = date_trunc('month', now())::date loop
    s := coalesce((channel_spend(b.channel, b.month) ->> 'spend_usd')::numeric, 0);
    lvl := case when s >= b.budget_usd then 100 when s >= b.budget_usd * 0.8 then 80 else 0 end;
    if lvl = 0 or (lvl = 80 and b.alerted_80) or (lvl = 100 and b.alerted_100) then continue; end if;
    for a in select id from profiles where role = 'admin' and account_status = 'active' loop
      perform notify_user(a.id, 'channel_cost_alert', 'বার্তা পরিষেবার খরচ ' || lvl || '% ছুঁয়েছে', b.channel || ' · ' || to_char(b.month, 'YYYY-MM'),
        jsonb_build_object('channel', b.channel, 'level', lvl, 'en', jsonb_build_object('title', 'Messaging cost reached ' || lvl || '% of budget', 'body', b.channel || ' ' || to_char(b.month, 'YYYY-MM'))),
        'chan-cost:' || b.channel || ':' || b.month || ':' || lvl, null);
    end loop;
    update channel_budgets set alerted_80 = alerted_80 or lvl >= 80, alerted_100 = alerted_100 or lvl = 100 where channel = b.channel and month = b.month;
    perform audit_write('channel.cost_alert', 'channel', b.channel, null, jsonb_build_object('level', lvl, 'spend_usd', s, 'budget_usd', b.budget_usd), '{}');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function channel_cost_alerts() from public, anon, authenticated;
grant execute on function channel_cost_alerts() to service_role;

create or replace function set_channel_budget(p_channel text, p_month date, p_budget numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', coalesce(p_month, current_date))::date;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_channel not in ('whatsapp','sms') then raise exception 'channel' using errcode = 'JK002', detail = 'channel'; end if;
  if p_budget is null or p_budget <= 0 or p_budget > 1000000 then raise exception 'budget' using errcode = 'JK002', detail = 'budget_usd'; end if;
  insert into channel_budgets (channel, month, budget_usd, updated_by) values (p_channel, m, p_budget, auth.uid())
  on conflict (channel, month) do update set budget_usd = excluded.budget_usd, alerted_80 = false, alerted_100 = false, updated_by = auth.uid();
  perform audit_write('channel.budget_set', 'channel', p_channel, null, jsonb_build_object('month', m, 'budget_usd', p_budget));
  return jsonb_build_object('channel', p_channel, 'month', m, 'budget_usd', p_budget);
end $$;

create or replace function channel_cost_report() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  return jsonb_build_object('month', date_trunc('month', now())::date, 'channels', jsonb_build_array(channel_spend('whatsapp'), channel_spend('sms')),
    'note', 'Costs are only counted when the operator has set a per-message price. Messages without a known cost are counted separately; no price is assumed.');
end $$;

create or replace function purge_channel_messages() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from channel_messages where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purge_channel_messages() from public, anon, authenticated;
grant execute on function purge_channel_messages() to service_role;

-- notify_user: same as 0018 plus SMS and WhatsApp deliveries for the person's own case updates and area alerts, when they switched the channel on and
-- have an active link. Quiet hours apply. Text is the same generic title and reference as every other channel. ---------------------------------------
create or replace function notify_user(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb, p_dedupe text, p_ref text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare pref user_preferences%rowtype; nid uuid; due timestamptz; ch text;
begin
  if p_user is null or not exists (select 1 from profiles where id = p_user and account_status = 'active') then return null; end if;
  select * into pref from user_preferences where user_id = p_user;
  if found and p_type = any (pref.muted_types) then return null; end if;
  insert into notifications (user_id, type, title, body, data, dedupe_key, ref, retention_until)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'), p_dedupe, p_ref, now() + interval '180 days')
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing returning id into nid;
  if nid is null then return null; end if;
  due := quiet_until(p_user);
  if found and coalesce((pref.channels ->> 'push')::boolean, false) and exists (select 1 from push_subscriptions where user_id = p_user) then
    insert into notification_deliveries (notification_id, user_id, channel, next_attempt_at) values (nid, p_user, 'push', due) on conflict do nothing;
  end if;
  if found and coalesce((pref.channels ->> 'email')::boolean, false) then
    insert into notification_deliveries (notification_id, user_id, channel, next_attempt_at) values (nid, p_user, 'email', due) on conflict do nothing;
  end if;
  if found and (notification_is_essential(p_type) or p_type in ('channel_reply','area_alert')) then
    foreach ch in array array['sms','whatsapp'] loop
      if coalesce((pref.channels ->> ch)::boolean, false)
         and exists (select 1 from channel_links l where l.user_id = p_user and l.channel = ch and l.status = 'active' and l.updates_enabled) then
        insert into notification_deliveries (notification_id, user_id, channel, next_attempt_at) values (nid, p_user, ch, due) on conflict do nothing;
      end if;
    end loop;
  end if;
  return nid;
end $$;
revoke all on function notify_user(uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;

-- Reply on a case that came in by WhatsApp or SMS: a public note from the office is sent back on the same channel (via the person's preferences).
create or replace function trg_notify_channel_reply() returns trigger language plpgsql security definer set search_path = public as $$
declare i issues%rowtype;
begin
  if new.event_type <> 'note' or not coalesce(new.is_public, false) then return new; end if;
  select * into i from issues where id = new.issue_id;
  if i.source_channel in ('whatsapp','sms') and i.reporter_id is distinct from new.actor_id then
    perform notify_user(i.reporter_id, 'channel_reply', 'আপনার রিপোর্টে অফিসের উত্তর এসেছে', 'নম্বর ' || i.ref,
      jsonb_build_object('ref', i.ref, 'en', jsonb_build_object('title', 'The office replied to your report', 'body', 'Reference ' || i.ref)), 'chrep:' || new.id, i.ref);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists notify_channel_reply_trg on issue_events;
create trigger notify_channel_reply_trg after insert on issue_events for each row execute function trg_notify_channel_reply();

-- Channel claim: the delivery worker also needs to know the destination of sms/whatsapp rows (service role only).
create or replace function channel_destination(p_user uuid, p_channel text) returns text
language sql stable security definer set search_path = public as $$
  select address from channel_links where user_id = p_user and channel = p_channel and status = 'active' and updates_enabled limit 1 $$;
revoke all on function channel_destination(uuid, text) from public, anon, authenticated;
grant execute on function channel_destination(uuid, text) to service_role;

-- Area alerts (B7.4) ---------------------------------------------------------------------------------------------------------------------------------
create table if not exists area_alerts (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies on delete cascade,
  created_by uuid references profiles on delete set null,
  title_bn text not null check (char_length(title_bn) between 5 and 120),
  title_en text check (title_en is null or char_length(title_en) <= 120),
  body text check (body is null or char_length(body) <= 300),
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists area_alerts_scope_idx on area_alerts (constituency_id, created_at desc);
alter table area_alerts enable row level security;
drop policy if exists area_alerts_select on area_alerts;
create policy area_alerts_select on area_alerts for select using (office_can(constituency_id, 'view', null) or is_admin());
revoke all on area_alerts from anon, authenticated;
grant select on area_alerts to authenticated;
create or replace view public_area_alerts with (security_invoker = false) as
  select a.id, c.key as constituency_key, a.title_bn, a.title_en, a.body, a.created_at from area_alerts a join constituencies c on c.id = a.constituency_id;
grant select on public_area_alerts to anon, authenticated;

-- The office sends a short alert to everyone who follows the area. At most 2 a day per area. Content is the office's own words; no case details.
create or replace function send_area_alert(p_constituency text, p_title_bn text, p_title_en text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v area_alerts%rowtype; n integer;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_title_bn, ''))) not between 5 and 120 then raise exception 'title' using errcode = 'JK002', detail = 'title_bn'; end if;
  if char_length(coalesce(p_title_en, '')) > 120 or char_length(coalesce(p_body, '')) > 300 then raise exception 'length' using errcode = 'JK002', detail = 'body'; end if;
  if (select count(*) from area_alerts where constituency_id = c.id and created_at > now() - interval '1 day') >= 2 then raise exception 'alert limit for this area today' using errcode = 'JK003', detail = 'alert_limit'; end if;
  insert into area_alerts (constituency_id, created_by, title_bn, title_en, body) values (c.id, auth.uid(), btrim(p_title_bn), nullif(btrim(coalesce(p_title_en, '')), ''), nullif(btrim(coalesce(p_body, '')), '')) returning * into v;
  n := notify_area_followers(c.id, 'area_alert', v.title_bn, coalesce(v.body, ''), jsonb_build_object('constituency', c.key, 'en', jsonb_build_object('title', coalesce(v.title_en, 'An alert for your area'), 'body', coalesce(v.body, ''))), 'area-alert:' || v.id, null);
  update area_alerts set recipients = n where id = v.id;
  perform audit_write('area_alert.send', 'constituency', c.key, null, jsonb_build_object('alert', v.id, 'recipients', n));
  return jsonb_build_object('id', v.id, 'recipients', n);
end $$;

revoke all on function start_channel_link(text, text, text), revoke_channel_link(uuid), set_channel_updates(uuid, boolean), set_channel_budget(text, date, numeric), channel_cost_report(), send_area_alert(text, text, text, text) from public, anon;
grant execute on function start_channel_link(text, text, text), revoke_channel_link(uuid), set_channel_updates(uuid, boolean), set_channel_budget(text, date, numeric), channel_cost_report(), send_area_alert(text, text, text, text) to authenticated;
revoke all on function channel_confirm_link(text, text, text), channel_find_link(text, text) from public, anon, authenticated;
grant execute on function channel_confirm_link(text, text, text), channel_find_link(text, text) to service_role;
