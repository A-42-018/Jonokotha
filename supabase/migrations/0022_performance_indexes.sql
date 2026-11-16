-- Phase 3 performance review (backend plan 3.6). EXPLAIN ANALYZE on 50,000 synthetic issues showed that filtered lists
-- (public by status or category, office by constituency and status) walked the whole created_at index and filtered rows,
-- 5 to 35 ms and growing linearly. These indexes match the filter plus the cursor order (created_at desc, ref desc).
create index if not exists issues_pub_created_idx on issues (created_at desc, ref desc) where public_visibility;
create index if not exists issues_pub_status_created_idx on issues (status, created_at desc, ref desc) where public_visibility;
create index if not exists issues_pub_category_created_idx on issues (category, created_at desc, ref desc) where public_visibility;
create index if not exists issues_pub_constituency_created_idx on issues (constituency_key, created_at desc, ref desc) where public_visibility;
create index if not exists issues_office_status_created_idx on issues (constituency_id, status, created_at desc, ref desc);
-- "My reports", newest first.
create index if not exists issues_reporter_created_idx on issues (reporter_id, created_at desc);
-- Retention sweep and the delivery worker look up by time.
create index if not exists notifications_retention_idx on notifications (retention_until) where retention_until is not null;
create index if not exists ai_runs_retention_idx on ai_runs (retention_until) where retention_until is not null;
create index if not exists deletion_requests_due_idx on deletion_requests (requested_at) where status = 'requested';
