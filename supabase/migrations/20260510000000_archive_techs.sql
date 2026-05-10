-- Soft-delete support for technicians.
-- Setting archived_at hides the tech from the picker / team list but
-- preserves the row so past jobs' assigned_tech_id and embedded
-- signatures continue to resolve.
alter table profiles add column archived_at timestamptz;

create index profiles_org_archived_idx on profiles(org_id, archived_at);
