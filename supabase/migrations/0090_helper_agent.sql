-- Dadu (জমির দাদু) helper. Requires 0015 (ai_runs_agent_check) and 0031 (feature_flags). Safe to run twice.
-- 1. ai_runs may now record the 'helper' agent (the optional model layer of the chat helper). One value is added to the allowed list; no data changes.
-- 2. Three switches, all off: 'helper' (the chat route), 'helper_ai' (model-written answers for signed-in people), 'helper_speech' (the server voice).
alter table ai_runs drop constraint if exists ai_runs_agent_check;
alter table ai_runs add constraint ai_runs_agent_check
  check (agent in ('intake','duplicate','routing','copilot','translation','insight','idea','transcription','helper'));

insert into feature_flags (key, enabled, data_status, description) values
  ('helper', false, 'live', 'Dadu chat helper: scripted answers, page guides and spoken navigation (no model)'),
  ('helper_ai', false, 'planned', 'Dadu model layer: signed-in people get answers written by the model from the site''s own text (switch on after the eval gate passes)'),
  ('helper_speech', false, 'planned', 'Dadu server voice (Azure Speech, a Bangla male voice); the browser voice is used when this is off')
on conflict (key) do nothing;
