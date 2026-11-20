-- Graph evidence for routing (Graph RAG, light) and the 'ingest' AI agent used for model-written chunk context.
-- Requires 0004 (graph_edges), 0013 (edges are written by trigger), 0015 and 0090 (ai_runs_agent_check). Safe to run twice.
-- NOT applied to the live database: apply it in order, like the earlier migrations, after review.

-- 1. ai_runs may record the 'ingest' agent (one value added to the allowed list; no data changes).
alter table ai_runs drop constraint if exists ai_runs_agent_check;
alter table ai_runs add constraint ai_runs_agent_check
  check (agent in ('intake','duplicate','routing','copilot','translation','insight','idea','transcription','helper','ingest'));

-- 2. For one issue and some candidate agencies: how many EARLIER issues in the same constituency and the same category were
--    routed to each agency. It walks the graph: issue -in_category-> category <-in_category- issue -routed_to-> agency.
--    Counts only, no issue ids, no text. Needs the right to view the issue; demo and real data are never mixed.
create or replace function agency_graph_evidence(p_issue uuid, p_agencies uuid[])
returns table (agency_id uuid, similar_routed integer)
language plpgsql stable security definer set search_path = public as $$
declare i issues%rowtype;
begin
  select * into i from issues where id = p_issue;
  if not found or not office_can(i.constituency_id, 'view', i.assigned_to) then raise exception 'issue not found' using errcode = 'JK404'; end if;
  return query
  select r.to_id::uuid, count(distinct same.from_id)::integer
  from graph_edges cat
  join graph_edges same on same.relation = 'in_category' and same.to_type = 'category' and same.to_id = cat.to_id and same.from_id <> cat.from_id
  join issues i2 on i2.id::text = same.from_id and i2.constituency_id = i.constituency_id and i2.is_demo = i.is_demo
  join graph_edges r on r.from_type = 'issue' and r.from_id = same.from_id and r.relation = 'routed_to' and r.to_type = 'agency'
                    and r.to_id in (select x::text from unnest(p_agencies) x)
  where cat.from_type = 'issue' and cat.from_id = p_issue::text and cat.relation = 'in_category'
  group by r.to_id;
end $$;
revoke all on function agency_graph_evidence(uuid, uuid[]) from public, anon;
grant execute on function agency_graph_evidence(uuid, uuid[]) to authenticated;
