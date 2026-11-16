-- Phase 1 step 8 (masterplan §17.2): Duplicate Agent storage and search.
--   * Embeddings are 1024-dimensional (BGE-M3, hosted), cosine distance, HNSW index. They are built from REDACTED
--     public text only (title, description, area) and written by the trusted server; clients have no access.
--   * find_similar_issues(): nearest issues in the SAME constituency and category, with a score and reasons. Callable by
--     office staff in scope only. It returns references and scores, never text or reporter data.
--   * graph_edges: issue-category / issue-area / issue-agency edges are kept in sync by a trigger; "duplicate_of" is
--     recorded when staff accept or edit a duplicate suggestion (source = ai_suggestion_accepted).
--   * Accepting a duplicate suggestion records the office's agreement; the status change itself is still the explicit
--     "mark-duplicate" office action (it needs the master reference and goes through the state machine).
-- Requires 0004-0012. The embedding tables are empty until the first run, so the type change is safe.

-- Dimension and index ---------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from issue_embeddings where embedding is not null) or exists (select 1 from knowledge_chunks where embedding is not null) then
    raise notice 'embeddings already present; leaving column types alone';
  else
    alter table issue_embeddings alter column embedding type vector(1024);
    alter table knowledge_chunks alter column embedding type vector(1024);
  end if;
end $$;
create index if not exists issue_embeddings_hnsw on issue_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists knowledge_chunks_hnsw on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Similar issues ---------------------------------------------------------------------------------------------
create or replace function find_similar_issues(p_issue uuid, p_limit integer default 5, p_min_score numeric default 0.80)
returns table (issue_id uuid, ref text, score numeric, reasons jsonb)
language plpgsql stable security definer set search_path = public, extensions as $$
declare me issues; my_emb vector(1024); my_model text;
begin
  select * into me from issues where id = p_issue;
  if me.id is null or not can_view_issue(p_issue) then return; end if;
  select e.embedding, e.model into my_emb, my_model from issue_embeddings e where e.issue_id = p_issue order by e.created_at desc limit 1;
  if my_emb is null or vector_norm(my_emb) = 0 then return; end if;
  return query
    select i.id, i.ref, round((1 - (e.embedding <=> my_emb))::numeric, 4) as score,
           jsonb_build_object(
             'same_category', true,
             'same_constituency', true,
             'same_area_text', (me.area is not null and me.area <> '' and lower(i.area) = lower(me.area)),
             'days_apart', abs(extract(day from (i.created_at - me.created_at)))::int,
             'master_candidate', i.status not in ('duplicate','rejected','out_of_jurisdiction')
           )
    from issue_embeddings e
    join issues i on i.id = e.issue_id
    where e.model = my_model and i.id <> me.id
      and vector_norm(e.embedding) > 0  -- a zero vector gives NaN, and NaN sorts above every real score
      and i.constituency_id is not distinct from me.constituency_id
      and i.category_id is not distinct from me.category_id
      and i.public_visibility
      and i.status not in ('duplicate','rejected')
      and (1 - (e.embedding <=> my_emb)) >= p_min_score
    order by e.embedding <=> my_emb
    limit greatest(1, least(coalesce(p_limit, 5), 20));
end $$;
revoke all on function find_similar_issues(uuid, integer, numeric) from public, anon;
grant execute on function find_similar_issues(uuid, integer, numeric) to authenticated, service_role;

-- Graph edges kept in sync ------------------------------------------------------------------------------------
create or replace function sync_issue_edges() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.category_id is not distinct from old.category_id and new.constituency_id is not distinct from old.constituency_id
       and new.agency_id is not distinct from old.agency_id then return new; end if;
    delete from graph_edges where from_type = 'issue' and from_id = new.id::text and relation in ('in_category','in_area','routed_to') and source = 'system';
  end if;
  if new.category_id is not null then
    insert into graph_edges (from_type, from_id, relation, to_type, to_id) values ('issue', new.id::text, 'in_category', 'category', new.category_id::text) on conflict do nothing;
  end if;
  if new.constituency_id is not null then
    insert into graph_edges (from_type, from_id, relation, to_type, to_id) values ('issue', new.id::text, 'in_area', 'constituency', new.constituency_id::text) on conflict do nothing;
  end if;
  if new.agency_id is not null then
    insert into graph_edges (from_type, from_id, relation, to_type, to_id) values ('issue', new.id::text, 'routed_to', 'agency', new.agency_id::text) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists issue_edges_trg on issues;
create trigger issue_edges_trg after insert or update on issues for each row execute function sync_issue_edges();

insert into graph_edges (from_type, from_id, relation, to_type, to_id)
  select 'issue', id::text, 'in_category', 'category', category_id::text from issues where category_id is not null on conflict do nothing;
insert into graph_edges (from_type, from_id, relation, to_type, to_id)
  select 'issue', id::text, 'in_area', 'constituency', constituency_id::text from issues where constituency_id is not null on conflict do nothing;
insert into graph_edges (from_type, from_id, relation, to_type, to_id)
  select 'issue', id::text, 'routed_to', 'agency', agency_id::text from issues where agency_id is not null on conflict do nothing;

-- Accept / Edit on a duplicate suggestion records "duplicate_of" -----------------------------------------------
create or replace function decide_ai_suggestion(p_id uuid, p_decision text, p_final jsonb default null) returns ai_suggestions
language plpgsql security definer set search_path = public as $$
declare
  s ai_suggestions; i issues; m issues; uid uuid := auth.uid(); master uuid;
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

  if s.suggestion_type = 'duplicate' and p_decision in ('accepted','edited') then
    master := try_uuid(coalesce(case p_decision when 'edited' then p_final else s.payload end ->> 'master_id', ''));
    select * into m from issues where id = master;
    if m.id is null or m.id = i.id or m.constituency_id is distinct from i.constituency_id then
      raise exception 'the master issue must be another issue of the same office' using errcode = 'JK002', detail = 'master_id';
    end if;
  end if;

  update ai_suggestions set decision = p_decision, decided_by = uid, decided_at = now(),
         final_value = case p_decision when 'accepted' then payload when 'edited' then p_final else null end
   where id = p_id returning * into s;
  if s.ai_run_id is not null then update ai_runs set decision = p_decision where id = s.ai_run_id; end if;

  if m.id is not null then
    insert into graph_edges (from_type, from_id, relation, to_type, to_id, weight, source)
    values ('issue', i.id::text, 'duplicate_of', 'issue', m.id::text, nullif(s.payload ->> 'score', '')::numeric, 'ai_suggestion_accepted')
    on conflict (from_type, from_id, relation, to_type, to_id) do nothing;
  end if;

  perform audit_write('ai_suggestion.' || p_decision, 'ai_suggestion', s.id::text,
    jsonb_build_object('decision', 'pending'), jsonb_build_object('decision', p_decision, 'target', s.target_type || ':' || s.target_id,
    'suggestion_type', s.suggestion_type));
  return s;
end $$;
revoke all on function decide_ai_suggestion(uuid, text, jsonb) from public, anon;
grant execute on function decide_ai_suggestion(uuid, text, jsonb) to authenticated, service_role;
