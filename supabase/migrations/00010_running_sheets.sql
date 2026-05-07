-- ============================================================
-- DOH RUNNING SHEETS — bulk consumer assignment notices
-- (Vendor Assignment Notice PDFs from NY State of Health)
-- ============================================================
create table doh_running_sheets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  storage_path text not null,
  source_filename text,
  vendor_name text,
  sheet_date date,
  uploaded_by uuid references profiles(id),
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create index doh_running_sheets_org_idx on doh_running_sheets (org_id);

alter table doh_running_sheets enable row level security;
create policy "Org members can view running sheets"
  on doh_running_sheets for select using (org_id = public.get_user_org_id());
create policy "Org members can insert running sheets"
  on doh_running_sheets for insert with check (org_id = public.get_user_org_id());
create policy "Org members can update running sheets"
  on doh_running_sheets for update using (org_id = public.get_user_org_id());
create policy "Org members can delete running sheets"
  on doh_running_sheets for delete using (org_id = public.get_user_org_id());

-- One row per consumer line in the parsed sheet.
create table doh_running_sheet_rows (
  id uuid primary key default uuid_generate_v4(),
  sheet_id uuid not null references doh_running_sheets(id) on delete cascade,
  application_id text not null,
  consumer_name text not null,
  assignment_date date,
  paper_mail boolean not null default false,
  -- y-coordinate of the row in the source PDF (for annotation overlay).
  page_index int not null default 0,
  row_y numeric,
  -- Match info — populated at parse time and refreshed on import.
  matched_job_id uuid references jobs(id) on delete set null,
  created_job_id uuid references jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index doh_running_sheet_rows_sheet_idx on doh_running_sheet_rows (sheet_id);
create index doh_running_sheet_rows_app_idx on doh_running_sheet_rows (application_id);

alter table doh_running_sheet_rows enable row level security;
create policy "Org members can view sheet rows"
  on doh_running_sheet_rows for select
  using (exists (select 1 from doh_running_sheets s where s.id = sheet_id and s.org_id = public.get_user_org_id()));
create policy "Org members can insert sheet rows"
  on doh_running_sheet_rows for insert
  with check (exists (select 1 from doh_running_sheets s where s.id = sheet_id and s.org_id = public.get_user_org_id()));
create policy "Org members can update sheet rows"
  on doh_running_sheet_rows for update
  using (exists (select 1 from doh_running_sheets s where s.id = sheet_id and s.org_id = public.get_user_org_id()));
create policy "Org members can delete sheet rows"
  on doh_running_sheet_rows for delete
  using (exists (select 1 from doh_running_sheets s where s.id = sheet_id and s.org_id = public.get_user_org_id()));

-- Storage bucket for the original + annotated running-sheet PDFs
insert into storage.buckets (id, name, public)
values ('running-sheets', 'running-sheets', false)
on conflict (id) do nothing;
