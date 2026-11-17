-- Phase 8 (B8.6, B8.7, B8.8; masterplan §4.4): participatory budgeting, the Right to Information helper, and MP activity from official records.
-- Requires 0004-0081. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 8 status):
--   * Participatory budgeting (PB) is a cycle that can only open when (a) it is tied to a VERIFIED budget source document (B8.1) of the same area and
--     fiscal year, (b) the office wrote a public pledge of how it will use the result, and (c) the MP or an administrator approved it. The platform
--     cannot know whether an office really controls that money: the pledge is the office's own public statement and that is how it is shown.
--     One ballot per verified local account, approval voting (up to max_choices options), results public only after closing and with 5+ voters. After
--     closing the office MUST record whether it followed the result; a deviation needs a public reason. Nothing here is "binding" in law.
--   * RTI helper: drafts and tracks. It never files, sends or submits anything and stores no applicant name, address or ID: the draft carries
--     placeholders that the citizen fills in when they copy it. Dates the citizen reports (filed, answered) are self-reported and shown as such.
--     Deadlines and official channels are configuration (app_settings.rti_rules) with `reviewed: false` until counsel confirms them.
--   * MP records: individual, sourced records only (question asked, bill introduced, committee membership, debate contribution). Every record needs an
--     official source link and date. They are entered by moderators or administrators (never by the MP's own office), published only after a SECOND person
--     reviews the plain-Bangla summary. There is no count, ranking or score anywhere in the schema, the views or the API. Attendance is deliberately not a kind.

-- Participatory budgeting -------------------------------------------------------------------------------------------------------------------------------
create sequence if not exists pb_ref_seq start 1000;
create table if not exists pb_cycles (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PB-' || to_char(now(), 'YYYY') || '-' || nextval('pb_ref_seq')),
  constituency_id uuid not null references constituencies,
  budget_source_id uuid references budget_sources,
  title text not null check (char_length(title) between 5 and 150),
  description text check (description is null or char_length(description) <= 800),
  fiscal_year text not null check (fiscal_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  budget_amount numeric(18,2) not null check (budget_amount > 0),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  pledge text not null check (char_length(pledge) between 20 and 1000),
  max_choices integer not null default 5 check (max_choices between 1 and 10),
  status text not null default 'draft' check (status in ('draft','pending_approval','open','closed','cancelled')),
  closes_at timestamptz not null,
  opened_at timestamptz,
  closed_at timestamptz,
  participants integer,
  result_valid boolean,
  followed_result boolean,
  deviation_reason text check (deviation_reason is null or char_length(deviation_reason) between 10 and 1000),
  outcome_recorded_at timestamptz,
  created_by uuid references profiles on delete set null,
  approved_by uuid references profiles on delete set null,
  approved_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (outcome_recorded_at is null or followed_result is not null),
  check (followed_result is not false or deviation_reason is not null)
);
create table if not exists pb_options (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references pb_cycles on delete cascade,
  position integer not null check (position between 1 and 30),
  title text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 400),
  cost numeric(18,2) not null check (cost > 0),
  approvals integer,
  funded boolean,
  unique (cycle_id, position)
);
create table if not exists pb_ballots (
  cycle_id uuid not null references pb_cycles on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  option_ids uuid[] not null check (cardinality(option_ids) between 1 and 10),
  submitted_at timestamptz not null default now(),
  primary key (cycle_id, user_id)
);
create index if not exists pb_cycles_scope_idx on pb_cycles (constituency_id, status);
alter table pb_cycles enable row level security;
alter table pb_options enable row level security;
alter table pb_ballots enable row level security;
drop policy if exists pb_cycles_select on pb_cycles;
create policy pb_cycles_select on pb_cycles for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists pb_options_select on pb_options;
create policy pb_options_select on pb_options for select using (exists (select 1 from pb_cycles x where x.id = cycle_id and (office_can(x.constituency_id, 'view', null) or is_admin())));
drop policy if exists pb_ballots_select on pb_ballots;
create policy pb_ballots_select on pb_ballots for select using (user_id = auth.uid());
revoke all on pb_cycles, pb_options, pb_ballots from anon, authenticated;
grant select on pb_cycles, pb_options, pb_ballots to authenticated;

-- Public: cycles that are open or closed; options without counts until closed AND valid (5+ voters).
create or replace view public_pb_cycles with (security_invoker = false) as
  select x.ref, c.key as constituency_key, x.title, x.description, x.fiscal_year, x.budget_amount, x.currency, x.pledge, x.max_choices, x.status, x.closes_at, x.opened_at, x.closed_at,
         case when x.status = 'closed' and x.result_valid then x.participants end as participants, x.result_valid,
         x.followed_result, x.deviation_reason, x.outcome_recorded_at, s.ref as budget_source_ref, s.source_url as budget_source_url, x.is_demo
  from pb_cycles x join constituencies c on c.id = x.constituency_id left join budget_sources s on s.id = x.budget_source_id and s.status = 'verified'
  where x.status in ('open','closed');
create or replace view public_pb_options with (security_invoker = false) as
  select x.ref as cycle_ref, o.id, o.position, o.title, o.description, o.cost,
         case when x.status = 'closed' and x.result_valid then o.approvals end as approvals, case when x.status = 'closed' and x.result_valid then o.funded end as funded
  from pb_options o join pb_cycles x on x.id = o.cycle_id where x.status in ('open','closed');
grant select on public_pb_cycles, public_pb_options to anon, authenticated;

-- p_options: [{"title","description"?,"cost"}] (2 to 30). The source must be verified, in this area and for the same fiscal year.
create or replace function create_pb_cycle(p_constituency text, p_source text, p_title text, p_description text, p_budget numeric, p_pledge text, p_max_choices integer, p_closes_at timestamptz, p_options jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; s budget_sources%rowtype; v pb_cycles%rowtype; o jsonb; i integer := 0;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into s from budget_sources where ref = p_source and constituency_id = c.id;
  if not found or s.status <> 'verified' then raise exception 'a verified budget source of this area is required' using errcode = 'JK003', detail = 'budget_source'; end if;
  if p_closes_at <= now() or p_closes_at > now() + interval '120 days' then raise exception 'closing time must be within 120 days' using errcode = 'JK002', detail = 'closes_at'; end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 30 then raise exception '2 to 30 options are needed' using errcode = 'JK002', detail = 'options'; end if;
  insert into pb_cycles (constituency_id, budget_source_id, title, description, fiscal_year, budget_amount, currency, pledge, max_choices, closes_at, created_by, is_demo)
  values (c.id, s.id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), s.fiscal_year, p_budget, coalesce((select currency from country_adapters where code = active_country()), 'BDT'), btrim(p_pledge), p_max_choices, p_closes_at, auth.uid(), c.is_demo) returning * into v;
  for o in select * from jsonb_array_elements(p_options) loop
    i := i + 1;
    insert into pb_options (cycle_id, position, title, description, cost) values (v.id, i, btrim(o ->> 'title'), nullif(btrim(coalesce(o ->> 'description', '')), ''), (o ->> 'cost')::numeric);
  end loop;
  perform audit_write('pb.create', 'pb_cycle', v.ref, null, jsonb_build_object('options', i, 'source', s.ref));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then raise exception 'invalid cycle' using errcode = 'JK002', detail = 'cycle';
end $$;

-- The office asks to open; the MP (or an administrator) approves. The pledge and the source are rechecked at both steps.
create or replace function request_pb_open(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pb_cycles%rowtype;
begin
  select * into v from pb_cycles where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status <> 'draft' then raise exception 'only a draft can be sent for approval' using errcode = 'JK001'; end if;
  if v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  if not exists (select 1 from budget_sources where id = v.budget_source_id and status = 'verified') then raise exception 'the budget source is no longer verified' using errcode = 'JK003', detail = 'budget_source'; end if;
  if (select coalesce(sum(cost), 0) from pb_options where cycle_id = v.id) < v.budget_amount * 0.5 then raise exception 'the options cost less than half of the budget: add real options' using errcode = 'JK003', detail = 'options_cost'; end if;
  update pb_cycles set status = 'pending_approval' where id = v.id;
  perform notify_office(v.constituency_id, 'approve', 'approval_decision', 'অংশগ্রহণমূলক বাজেট অনুমোদনের অপেক্ষায়', 'নম্বর ' || v.ref,
    jsonb_build_object('ref', v.ref, 'en', jsonb_build_object('title', 'A participatory budget waits for your approval', 'body', 'Reference ' || v.ref)), 'pb-wait:' || v.ref, v.ref);
  perform audit_write('pb.request_approval', 'pb_cycle', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', 'pending_approval'));
  return jsonb_build_object('ref', v.ref, 'status', 'pending_approval');
end $$;

create or replace function decide_pb_cycle(p_ref text, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pb_cycles%rowtype; ok boolean := (p_decision = 'approve');
begin
  select * into v from pb_cycles where ref = p_ref for update;
  if not found or not (office_can(v.constituency_id, 'view', null) or is_admin()) then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  if not (office_can(v.constituency_id, 'approve', null) or is_admin()) then raise exception 'only the MP or an administrator can decide' using errcode = '42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if v.status <> 'pending_approval' then raise exception 'nothing waits for approval' using errcode = 'JK001'; end if;
  if not ok and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is required to reject' using errcode = 'JK002', detail = 'note'; end if;
  if ok and v.closes_at <= now() then raise exception 'the closing time has passed' using errcode = 'JK003', detail = 'closes_at'; end if;
  if ok and not exists (select 1 from budget_sources where id = v.budget_source_id and status = 'verified') then raise exception 'the budget source is no longer verified' using errcode = 'JK003', detail = 'budget_source'; end if;
  update pb_cycles set status = case when ok then 'open' else 'draft' end, opened_at = case when ok then now() else null end, approved_by = auth.uid(), approved_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = v.id;
  perform audit_write('pb.' || p_decision, 'pb_cycle', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', case when ok then 'open' else 'draft' end));
  return jsonb_build_object('ref', v.ref, 'status', case when ok then 'open' else 'draft' end);
end $$;

create or replace function submit_pb_ballot(p_ref text, p_options uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v pb_cycles%rowtype;
begin
  select * into v from pb_cycles where ref = p_ref and status in ('open','closed');
  if not found then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  if uid is null or not local_verified_account(v.constituency_id) then raise exception 'a verified account that follows this area is needed' using errcode = '42501'; end if;
  if v.status <> 'open' or v.closes_at <= now() then raise exception 'this vote is closed' using errcode = 'JK003', detail = 'cycle_closed'; end if;
  if coalesce(array_length(p_options, 1), 0) not between 1 and v.max_choices or (select count(distinct x) from unnest(p_options) x) <> array_length(p_options, 1) then
    raise exception 'choose 1 to % different options', v.max_choices using errcode = 'JK002', detail = 'options'; end if;
  if (select count(*) from pb_options where cycle_id = v.id and id = any (p_options)) <> array_length(p_options, 1) then raise exception 'unknown option' using errcode = 'JK002', detail = 'options'; end if;
  insert into pb_ballots (cycle_id, user_id, option_ids) values (v.id, uid, p_options) on conflict (cycle_id, user_id) do update set option_ids = excluded.option_ids, submitted_at = now();
  return jsonb_build_object('ref', v.ref, 'chosen', array_length(p_options, 1), 'label', 'advisory_until_pledge_recorded');
end $$;

-- Close: counts approvals, then funds options by approvals (ties: lower cost, then position) while the budget lasts. With fewer than 5 voters nothing is funded.
create or replace function close_pb_cycle(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pb_cycles%rowtype; n integer; rest numeric; o record;
begin
  select * into v from pb_cycles where ref = p_ref for update;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status <> 'open' then raise exception 'only an open cycle can be closed' using errcode = 'JK001'; end if;
  select count(*)::int into n from pb_ballots where cycle_id = v.id;
  update pb_options po set approvals = (select count(*)::int from pb_ballots b where b.cycle_id = v.id and po.id = any (b.option_ids)), funded = false where po.cycle_id = v.id;
  rest := v.budget_amount;
  if n >= 5 then
    for o in select id, cost from pb_options where cycle_id = v.id and approvals > 0 order by approvals desc, cost asc, position asc loop
      if o.cost <= rest then update pb_options set funded = true where id = o.id; rest := rest - o.cost; end if;
    end loop;
  end if;
  update pb_cycles set status = 'closed', closed_at = now(), participants = n, result_valid = (n >= 5) where id = v.id;
  perform audit_write('pb.close', 'pb_cycle', v.ref, jsonb_build_object('status', 'open'), jsonb_build_object('status', 'closed', 'valid', n >= 5));
  return jsonb_build_object('ref', v.ref, 'status', 'closed', 'result_valid', n >= 5, 'participants', n);
end $$;

-- After closing the office states whether it followed the result. "No" needs a public reason. Cannot be recorded twice.
create or replace function record_pb_outcome(p_ref text, p_followed boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pb_cycles%rowtype;
begin
  select * into v from pb_cycles where ref = p_ref for update;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status <> 'closed' then raise exception 'the vote must be closed first' using errcode = 'JK001'; end if;
  if v.outcome_recorded_at is not null then raise exception 'the outcome was already recorded' using errcode = 'JK003', detail = 'already_recorded'; end if;
  if p_followed is null then raise exception 'followed' using errcode = 'JK002', detail = 'followed'; end if;
  if not p_followed and char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'a public reason is needed when the result was not followed' using errcode = 'JK002', detail = 'reason'; end if;
  update pb_cycles set followed_result = p_followed, deviation_reason = case when p_followed then null else btrim(p_reason) end, outcome_recorded_at = now() where id = v.id;
  perform audit_write('pb.outcome', 'pb_cycle', v.ref, null, jsonb_build_object('followed', p_followed));
  return jsonb_build_object('ref', v.ref, 'followed_result', p_followed);
end $$;

create or replace function cancel_pb_cycle(p_ref text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pb_cycles%rowtype;
begin
  select * into v from pb_cycles where ref = p_ref for update;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status not in ('draft','pending_approval') then raise exception 'only a cycle that has not opened can be cancelled' using errcode = 'JK001'; end if;
  update pb_cycles set status = 'cancelled', decision_note = left(btrim(coalesce(p_reason, '')), 500) where id = v.id;
  perform audit_write('pb.cancel', 'pb_cycle', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', 'cancelled'));
  return jsonb_build_object('ref', v.ref, 'status', 'cancelled');
end $$;

create or replace function pb_office_view(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v pb_cycles%rowtype; c text;
begin
  select * into v from pb_cycles where ref = p_ref;
  if not found or not (office_can(v.constituency_id, 'view', null) or is_admin()) then raise exception 'cycle not found' using errcode = 'JK404'; end if;
  select key into c from constituencies where id = v.constituency_id;
  return jsonb_build_object('ref', v.ref, 'constituency', c, 'title', v.title, 'status', v.status, 'fiscal_year', v.fiscal_year, 'budget_amount', v.budget_amount, 'pledge', v.pledge, 'closes_at', v.closes_at,
    'participants', (select count(*)::int from pb_ballots where cycle_id = v.id), 'result_valid', v.result_valid, 'followed_result', v.followed_result, 'outcome_recorded', v.outcome_recorded_at is not null,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'position', o.position, 'title', o.title, 'cost', o.cost, 'approvals', o.approvals, 'funded', o.funded) order by o.position), '[]') from pb_options o where o.cycle_id = v.id));
end $$;

create or replace function pb_office_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ref', x.ref, 'constituency', c.key, 'title', x.title, 'status', x.status, 'closes_at', x.closes_at, 'outcome_recorded', x.outcome_recorded_at is not null) order by x.created_at desc), '[]')
  from pb_cycles x join constituencies c on c.id = x.constituency_id where office_can(x.constituency_id, 'view', null) or is_admin() $$;

create or replace function my_pb_ballot(p_ref text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('option_ids', b.option_ids, 'submitted_at', b.submitted_at)
  from pb_ballots b join pb_cycles x on x.id = b.cycle_id where x.ref = p_ref and b.user_id = auth.uid() $$;
revoke all on function create_pb_cycle(text, text, text, text, numeric, text, integer, timestamptz, jsonb), request_pb_open(text), decide_pb_cycle(text, text, text), submit_pb_ballot(text, uuid[]),
  close_pb_cycle(text), record_pb_outcome(text, boolean, text), cancel_pb_cycle(text, text), pb_office_view(text), pb_office_list(), my_pb_ballot(text) from public, anon;
grant execute on function create_pb_cycle(text, text, text, text, numeric, text, integer, timestamptz, jsonb), request_pb_open(text), decide_pb_cycle(text, text, text), submit_pb_ballot(text, uuid[]),
  close_pb_cycle(text), record_pb_outcome(text, boolean, text), cancel_pb_cycle(text, text), pb_office_view(text), pb_office_list(), my_pb_ballot(text) to authenticated;

-- Right to Information helper (B8.7) ------------------------------------------------------------------------------------------------------------------------------
insert into app_settings (key, value, description) values
  ('rti_rules', '{"reviewed":false,"respond_working_days":20,"respond_working_days_multiple_units":30,"appeal_days_after_decision":30,"weekend_days":[5,6],
    "official_channels":[{"name_en":"Information Commission","name_bn":"তথ্য কমিশন","url":"https://infocom.gov.bd","verified":false}],
    "note":"Deadlines and channels are a starting draft from the public text of the RTI Act 2009 and must be confirmed by counsel (docs/aibc/release2/open-items.md)."}',
   'RTI helper settings (deadlines and official channels). "reviewed" stays false until counsel confirms them.')
on conflict (key) do nothing;

create table if not exists rti_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  agency_id uuid references agencies on delete set null,
  agency_name text not null check (char_length(agency_name) between 2 and 150),
  subject text not null check (char_length(subject) between 5 and 150),
  info_requested text not null check (char_length(info_requested) between 20 and 2000),
  period_text text check (period_text is null or char_length(period_text) <= 100),
  preferred_format text not null default 'electronic' check (preferred_format in ('electronic','paper_copy','inspection')),
  draft_text text not null check (char_length(draft_text) <= 6000),
  status text not null default 'draft' check (status in ('draft','filed_by_me','answered','appealed','closed')),
  filed_on date,
  filed_channel text check (filed_channel is null or filed_channel in ('in_person','post','email','official_portal')),
  agency_reference text check (agency_reference is null or char_length(agency_reference) <= 80),
  answered_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or status = 'closed' or filed_on is not null)
);
create index if not exists rti_drafts_user_idx on rti_drafts (user_id, created_at desc);
alter table rti_drafts enable row level security;
drop policy if exists rti_drafts_select on rti_drafts;
create policy rti_drafts_select on rti_drafts for select using (user_id = auth.uid());
revoke all on rti_drafts from anon, authenticated;
grant select on rti_drafts to authenticated;

create or replace function save_rti_draft(p_agency uuid, p_agency_name text, p_subject text, p_info text, p_period text, p_format text, p_draft text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v rti_drafts%rowtype; an text := p_agency_name;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  if (select count(*) from rti_drafts where user_id = uid) >= 50 then raise exception 'too many drafts: delete some first' using errcode = 'JK003', detail = 'draft_limit'; end if;
  if p_agency is not null then select name_en into an from agencies where id = p_agency; if not found then raise exception 'agency not found' using errcode = 'JK002', detail = 'agency_id'; end if; end if;
  insert into rti_drafts (user_id, agency_id, agency_name, subject, info_requested, period_text, preferred_format, draft_text)
  values (uid, p_agency, btrim(coalesce(p_agency_name, an)), btrim(p_subject), btrim(p_info), nullif(btrim(coalesce(p_period, '')), ''), coalesce(p_format, 'electronic'), p_draft) returning * into v;
  return jsonb_build_object('id', v.id, 'status', v.status);
exception when check_violation or not_null_violation then raise exception 'invalid request' using errcode = 'JK002', detail = 'draft';
end $$;

-- The citizen tells us what they did outside the platform. We do not check it and say so.
create or replace function update_rti_status(p_id uuid, p_action text, p_on date default null, p_channel text default null, p_reference text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v rti_drafts%rowtype; ns text;
begin
  select * into v from rti_drafts where id = p_id and user_id = auth.uid();
  if not found then raise exception 'draft not found' using errcode = 'JK404'; end if;
  ns := case p_action when 'mark_filed' then 'filed_by_me' when 'mark_answered' then 'answered' when 'mark_appealed' then 'appealed' when 'close' then 'closed' end;
  if ns is null then raise exception 'action' using errcode = 'JK002', detail = 'action'; end if;
  if not ((v.status = 'draft' and p_action in ('mark_filed','close')) or (v.status = 'filed_by_me' and p_action in ('mark_answered','mark_appealed','close')) or (v.status in ('answered','appealed') and p_action in ('mark_appealed','close'))) then
    raise exception 'invalid status change' using errcode = 'JK001'; end if;
  if p_action = 'mark_filed' and (p_on is null or p_on > current_date or p_on < current_date - 3650 or p_channel is null) then raise exception 'the date you filed and how you filed are needed' using errcode = 'JK002', detail = 'filed_on'; end if;
  if p_action = 'mark_answered' and (p_on is null or p_on > current_date or p_on < v.filed_on) then raise exception 'the date of the answer is needed' using errcode = 'JK002', detail = 'answered_on'; end if;
  update rti_drafts set status = ns, updated_at = now(),
    filed_on = case when p_action = 'mark_filed' then p_on else filed_on end, filed_channel = case when p_action = 'mark_filed' then p_channel else filed_channel end,
    agency_reference = coalesce(nullif(btrim(coalesce(p_reference, '')), ''), agency_reference), answered_on = case when p_action = 'mark_answered' then p_on else answered_on end where id = v.id;
  return jsonb_build_object('id', v.id, 'status', ns);
exception when check_violation then raise exception 'invalid value' using errcode = 'JK002', detail = 'channel';
end $$;

create or replace function delete_rti_draft(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  delete from rti_drafts where id = p_id and user_id = auth.uid();
  if not found then raise exception 'draft not found' using errcode = 'JK404'; end if;
  return jsonb_build_object('id', p_id, 'deleted', true);
end $$;
revoke all on function save_rti_draft(uuid, text, text, text, text, text, text), update_rti_status(uuid, text, date, text, text), delete_rti_draft(uuid) from public, anon;
grant execute on function save_rti_draft(uuid, text, text, text, text, text, text), update_rti_status(uuid, text, date, text, text), delete_rti_draft(uuid) to authenticated;

-- Public settings for the guide (no personal data; reviewed flag included).
create or replace function rti_rules() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = 'rti_rules'), '{}') $$;
revoke all on function rti_rules() from public;
grant execute on function rti_rules() to anon, authenticated, service_role;

-- MP records (B8.8) ---------------------------------------------------------------------------------------------------------------------------------------------------
create sequence if not exists mp_record_ref_seq start 1000;
create table if not exists mp_records (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('MR-' || to_char(now(), 'YYYY') || '-' || nextval('mp_record_ref_seq')),
  representative_id uuid not null references representatives on delete cascade,
  kind text not null check (kind in ('question_asked','bill_introduced','committee_membership','debate_contribution','other')),
  title text not null check (char_length(title) between 5 and 200),
  occurred_on date not null,
  session_label text check (session_label is null or char_length(session_label) <= 80),
  source_name text not null check (char_length(source_name) between 3 and 150),
  source_url text not null check (source_url ~ '^https://'),
  source_checked_at date not null,
  excerpt text check (excerpt is null or char_length(excerpt) <= 1500),
  summary_draft text check (summary_draft is null or char_length(summary_draft) <= 800),
  summary_bn text check (summary_bn is null or char_length(summary_bn) between 10 and 800),
  summary_source text check (summary_source is null or summary_source in ('ai_draft_reviewed','human')),
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  created_by uuid references profiles on delete set null,
  reviewed_by uuid references profiles on delete set null,
  published_at timestamptz,
  withdraw_reason text check (withdraw_reason is null or char_length(withdraw_reason) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (status <> 'published' or (summary_bn is not null and reviewed_by is not null and published_at is not null)),
  check (reviewed_by is null or created_by is null or reviewed_by <> created_by)
);
create index if not exists mp_records_rep_idx on mp_records (representative_id, occurred_on desc);
alter table mp_records enable row level security;
drop policy if exists mp_records_select on mp_records;
create policy mp_records_select on mp_records for select using (is_admin() or is_moderator());
revoke all on mp_records from anon, authenticated;
grant select on mp_records to authenticated;

-- Public: one row per record, newest first by the reader. No counts, no ranks, no scores.
create or replace view public_mp_records with (security_invoker = false) as
  select m.ref, m.representative_id, r.full_name as representative_name, m.kind, m.title, m.occurred_on, m.session_label, m.source_name, m.source_url, m.source_checked_at, m.summary_bn, m.published_at, m.is_demo
  from mp_records m join representatives r on r.id = m.representative_id where m.status = 'published';
grant select on public_mp_records to anon, authenticated;

create or replace function create_mp_record(p_representative uuid, p_kind text, p_title text, p_occurred date, p_session text, p_source_name text, p_source_url text, p_checked date, p_excerpt text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r representatives%rowtype; v mp_records%rowtype;
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from representatives where id = p_representative;
  if not found then raise exception 'representative not found' using errcode = 'JK404'; end if;
  if p_occurred > current_date or p_checked > current_date then raise exception 'dates cannot be in the future' using errcode = 'JK002', detail = 'occurred_on'; end if;
  insert into mp_records (representative_id, kind, title, occurred_on, session_label, source_name, source_url, source_checked_at, excerpt, created_by, is_demo)
  values (r.id, p_kind, btrim(p_title), p_occurred, nullif(btrim(coalesce(p_session, '')), ''), btrim(p_source_name), btrim(p_source_url), p_checked, nullif(btrim(coalesce(p_excerpt, '')), ''), auth.uid(), r.is_demo) returning * into v;
  perform audit_write('mp_record.create', 'mp_record', v.ref, null, jsonb_build_object('kind', p_kind), jsonb_build_object('representative', r.id));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation or not_null_violation then raise exception 'invalid record' using errcode = 'JK002', detail = 'record';
end $$;

create or replace function save_mp_record_draft(p_ref text, p_draft text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v mp_records%rowtype;
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from mp_records where ref = p_ref;
  if not found then raise exception 'record not found' using errcode = 'JK404'; end if;
  if v.status <> 'draft' then raise exception 'only a draft can be changed' using errcode = 'JK001'; end if;
  update mp_records set summary_draft = left(p_draft, 800) where id = v.id;
  perform audit_write('mp_record.draft_summary', 'mp_record', v.ref, null, jsonb_build_object('has_draft', p_draft is not null));
  return jsonb_build_object('ref', v.ref, 'summary_draft', left(p_draft, 800));
end $$;

-- A second person reads the record against its source and publishes the summary they stand behind.
create or replace function publish_mp_record(p_ref text, p_summary text, p_from_draft boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v mp_records%rowtype;
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from mp_records where ref = p_ref for update;
  if not found then raise exception 'record not found' using errcode = 'JK404'; end if;
  if v.status <> 'draft' then raise exception 'only a draft can be published' using errcode = 'JK001'; end if;
  if v.created_by = auth.uid() then raise exception 'a different person must review and publish this record' using errcode = 'JK003', detail = 'self_review'; end if;
  if char_length(btrim(coalesce(p_summary, ''))) < 10 then raise exception 'a reviewed summary is needed' using errcode = 'JK002', detail = 'summary_bn'; end if;
  update mp_records set status = 'published', summary_bn = btrim(p_summary), summary_source = case when p_from_draft and v.summary_draft is not null then 'ai_draft_reviewed' else 'human' end, reviewed_by = auth.uid(), published_at = now() where id = v.id;
  perform audit_write('mp_record.publish', 'mp_record', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', 'published'));
  return jsonb_build_object('ref', v.ref, 'status', 'published');
end $$;

create or replace function withdraw_mp_record(p_ref text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v mp_records%rowtype;
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from mp_records where ref = p_ref;
  if not found then raise exception 'record not found' using errcode = 'JK404'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is needed' using errcode = 'JK002', detail = 'reason'; end if;
  update mp_records set status = 'withdrawn', withdraw_reason = btrim(p_reason) where id = v.id and status <> 'withdrawn';
  perform audit_write('mp_record.withdraw', 'mp_record', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', 'withdrawn'));
  return jsonb_build_object('ref', v.ref, 'status', 'withdrawn');
end $$;

create or replace function list_mp_records_admin(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('ref', m.ref, 'representative_id', m.representative_id, 'kind', m.kind, 'title', m.title, 'occurred_on', m.occurred_on, 'status', m.status,
    'source_url', m.source_url, 'has_excerpt', m.excerpt is not null, 'summary_draft', m.summary_draft, 'summary_bn', m.summary_bn, 'created_by_me', m.created_by = auth.uid()) order by m.created_at desc), '[]')
    from (select * from mp_records where p_status is null or status = p_status order by created_at desc limit 100) m);
end $$;

-- The excerpt (needed to write a draft) is read by moderators and administrators only.
create or replace function mp_record_excerpt(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v mp_records%rowtype;
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from mp_records where ref = p_ref;
  if not found then raise exception 'record not found' using errcode = 'JK404'; end if;
  return jsonb_build_object('ref', v.ref, 'kind', v.kind, 'title', v.title, 'occurred_on', v.occurred_on, 'excerpt', v.excerpt, 'status', v.status);
end $$;
revoke all on function create_mp_record(uuid, text, text, date, text, text, text, date, text), save_mp_record_draft(text, text), publish_mp_record(text, text, boolean), withdraw_mp_record(text, text),
  list_mp_records_admin(text), mp_record_excerpt(text) from public, anon;
grant execute on function create_mp_record(uuid, text, text, date, text, text, text, date, text), save_mp_record_draft(text, text), publish_mp_record(text, text, boolean), withdraw_mp_record(text, text),
  list_mp_records_admin(text), mp_record_excerpt(text) to authenticated;

insert into feature_flags (key, enabled, data_status, description) values
  ('participatory_budgeting', false, 'planned', 'Participatory budgeting (only for an office that controls a real budget and pledged to follow the result)'),
  ('rti_helper', false, 'planned', 'Right to Information request helper (switch on after counsel confirms the wording and deadlines)'),
  ('mp_records', false, 'planned', 'MP activity from official parliamentary records (sourced, neutral, never a score)')
on conflict (key) do nothing;
