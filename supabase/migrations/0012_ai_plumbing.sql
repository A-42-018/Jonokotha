-- Phase 1 step 9 (masterplan §17): AI plumbing in the database.
--   * log_ai_run(): the only writer of ai_runs, callable by the trusted server (service role) only, so nobody can forge
--     model/cost/decision records from a browser. Stores a hash of the REDACTED input and the validated output only.
--   * ai_suggestions are created by the server; staff Accept / Edit / Dismiss them through decide_ai_suggestion(), which
--     checks office scope, records who decided and what the final value was, mirrors the decision onto ai_runs and
--     writes an audit row. Nothing an AI suggests changes an issue by itself.
-- Requires 0004-0011. Safe to run twice.

alter table ai_runs add column if not exists prompt_id text;
alter table ai_runs add column if not exists error_class text;

create or replace function log_ai_run(
  p_agent text, p_status text, p_model text, p_prompt_id text, p_prompt_version text, p_input_hash text,
  p_output jsonb, p_latency_ms integer, p_token_usage jsonb, p_cost_usd numeric,
  p_issue_id uuid default null, p_actor_id uuid default null, p_request_id text default null, p_error_class text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  insert into ai_runs (agent, status, model, prompt_id, prompt_version, input_hash, redaction_applied, output, latency_ms,
                       token_usage, cost_usd, issue_id, actor_id, request_id, error_class, decision, retention_until)
  values (p_agent, p_status, p_model, p_prompt_id, p_prompt_version, p_input_hash, true, p_output, p_latency_ms,
          p_token_usage, p_cost_usd, p_issue_id, p_actor_id, p_request_id, left(p_error_class, 60),
          case when p_status = 'ok' then 'pending' else 'not_applicable' end, now() + interval '180 days')
  returning id into rid;
  return rid;
end $$;
revoke all on function log_ai_run(text,text,text,text,text,text,jsonb,integer,jsonb,numeric,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function log_ai_run(text,text,text,text,text,text,jsonb,integer,jsonb,numeric,uuid,uuid,text,text) to service_role;

-- Accept / Edit / Dismiss -------------------------------------------------------------------------------------
create or replace function decide_ai_suggestion(p_id uuid, p_decision text, p_final jsonb default null) returns ai_suggestions
language plpgsql security definer set search_path = public as $$
declare
  s ai_suggestions; i issues; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_decision not in ('accepted','edited','dismissed') then
    raise exception 'invalid decision' using errcode = 'JK002', detail = 'decision';
  end if;
  select * into s from ai_suggestions where id = p_id for update;
  if s.id is null then raise exception 'not found' using errcode = 'JK404'; end if;

  if s.target_type = 'issue' then
    select * into i from issues where id = try_uuid(s.target_id);
    if i.id is null or not can_manage_issue(i.constituency_id, i.assigned_to) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  elsif not is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if s.decision <> 'pending' then raise exception 'already decided' using errcode = 'JK003', detail = 'already_decided'; end if;
  if p_decision = 'edited' and (p_final is null or p_final = 'null'::jsonb) then
    raise exception 'an edited suggestion needs the final value' using errcode = 'JK002', detail = 'final_value';
  end if;

  update ai_suggestions set decision = p_decision, decided_by = uid, decided_at = now(),
         final_value = case p_decision when 'accepted' then payload when 'edited' then p_final else null end
   where id = p_id returning * into s;
  if s.ai_run_id is not null then update ai_runs set decision = p_decision where id = s.ai_run_id; end if;

  perform audit_write('ai_suggestion.' || p_decision, 'ai_suggestion', s.id::text,
    jsonb_build_object('decision', 'pending'), jsonb_build_object('decision', p_decision, 'target', s.target_type || ':' || s.target_id,
    'suggestion_type', s.suggestion_type));
  return s;
end $$;
revoke all on function decide_ai_suggestion(uuid, text, jsonb) from public, anon;
grant execute on function decide_ai_suggestion(uuid, text, jsonb) to authenticated, service_role;
