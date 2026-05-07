-- ============================================================
-- HEAP / DOH Job Management System — Initial Schema
-- ============================================================

-- Extensions
-- gen_random_uuid() is built-in in Postgres 13+, no extension needed

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('owner', 'office', 'tech');
create type job_status as enum (
  'new',
  'contact_attempted',
  'contacted',
  'scheduled',
  'installed',
  'completed',
  'submitted',
  'on_hold',
  'cancelled'
);
create type attachment_kind as enum (
  'invoice_original',
  'invoice_signed',
  'photo_before',
  'photo_after',
  'other'
);
create type ocr_status as enum ('pending', 'processing', 'done', 'failed', 'not_applicable');
create type contact_channel as enum ('call', 'text', 'voicemail', 'email', 'in_person');
create type contact_direction as enum ('outbound', 'inbound');
create type contact_outcome as enum ('reached', 'no_answer', 'left_voicemail', 'declined', 'callback_requested');
create type overlay_field_kind as enum ('text', 'signature', 'date', 'checkbox');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'tech',
  phone text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROGRAMS (seed HEAP + DOH)
-- ============================================================
create table programs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  submission_format jsonb,
  created_at timestamptz not null default now()
);

insert into programs (code, name) values
  ('HEAP', 'Home Energy Assistance Program'),
  ('DOH', 'Department of Health');

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  phone_primary text,
  phone_secondary text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customers_dedupe_idx
  on customers (org_id, lower(full_name), address_line1, zip);

-- ============================================================
-- JOBS
-- ============================================================
create table jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references programs(id),
  customer_id uuid references customers(id),
  invoice_number text,
  invoice_received_at date,
  status job_status not null default 'new',
  hold_reason text,
  priority smallint not null default 3,
  assigned_tech_id uuid references profiles(id),
  scheduled_at timestamptz,
  installed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_status_idx on jobs (status);
create index jobs_scheduled_idx on jobs (scheduled_at);
create index jobs_tech_idx on jobs (assigned_tech_id);
create index jobs_program_idx on jobs (program_id);

-- ============================================================
-- JOB SYSTEMS
-- ============================================================
create table job_systems (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  system_type text not null,
  make text,
  model text,
  serial_number text,
  install_location text,
  btu_input int,
  efficiency_rating text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ATTACHMENTS
-- ============================================================
create table attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind attachment_kind not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  original_filename text,
  ocr_status ocr_status not null default 'not_applicable',
  ocr_raw jsonb,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONTACT LOG
-- ============================================================
create table contact_log (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  channel contact_channel not null,
  direction contact_direction not null default 'outbound',
  outcome contact_outcome not null,
  notes text,
  contacted_at timestamptz not null default now(),
  logged_by uuid references profiles(id)
);

-- ============================================================
-- SIGNATURES
-- ============================================================
create table signatures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  signer_name text not null,
  signer_role text not null,
  image_path text not null,
  ip_address inet,
  user_agent text,
  signed_at timestamptz not null default now()
);

-- ============================================================
-- PDF OVERLAY TEMPLATES
-- ============================================================
create table pdf_overlay_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  name text not null,
  version int not null default 1,
  page_count int not null default 1,
  field_map jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SUBMISSION BATCHES
-- ============================================================
create table submission_batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references profiles(id),
  job_count int not null default 0,
  export_path text,
  notes text
);

create table submission_batch_jobs (
  batch_id uuid not null references submission_batches(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  primary key (batch_id, job_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table jobs enable row level security;
alter table job_systems enable row level security;
alter table attachments enable row level security;
alter table contact_log enable row level security;
alter table signatures enable row level security;
alter table pdf_overlay_templates enable row level security;
alter table submission_batches enable row level security;
alter table submission_batch_jobs enable row level security;

-- Helper function: get current user's org_id
create or replace function public.get_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Organizations: users can see their own org
create policy "Users can view own org"
  on organizations for select
  using (id = public.get_user_org_id());

-- Profiles: users can see profiles in their org
create policy "Users can view org profiles"
  on profiles for select
  using (org_id = public.get_user_org_id());

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- Customers: org-scoped
create policy "Org members can view customers"
  on customers for select using (org_id = public.get_user_org_id());
create policy "Org members can insert customers"
  on customers for insert with check (org_id = public.get_user_org_id());
create policy "Org members can update customers"
  on customers for update using (org_id = public.get_user_org_id());

-- Jobs: org-scoped, techs can only write their assigned jobs
create policy "Org members can view jobs"
  on jobs for select using (org_id = public.get_user_org_id());
create policy "Org members can insert jobs"
  on jobs for insert with check (org_id = public.get_user_org_id());
create policy "Owners/office can update any job"
  on jobs for update using (
    org_id = public.get_user_org_id()
    and (
      (select role from profiles where id = auth.uid()) in ('owner', 'office')
      or assigned_tech_id = auth.uid()
    )
  );

-- Job systems: via job org
create policy "Org members can view job_systems"
  on job_systems for select
  using (exists (select 1 from jobs where jobs.id = job_systems.job_id and jobs.org_id = public.get_user_org_id()));
create policy "Org members can insert job_systems"
  on job_systems for insert
  with check (exists (select 1 from jobs where jobs.id = job_systems.job_id and jobs.org_id = public.get_user_org_id()));
create policy "Org members can update job_systems"
  on job_systems for update
  using (exists (select 1 from jobs where jobs.id = job_systems.job_id and jobs.org_id = public.get_user_org_id()));

-- Attachments: via job org
create policy "Org members can view attachments"
  on attachments for select
  using (exists (select 1 from jobs where jobs.id = attachments.job_id and jobs.org_id = public.get_user_org_id()));
create policy "Org members can insert attachments"
  on attachments for insert
  with check (exists (select 1 from jobs where jobs.id = attachments.job_id and jobs.org_id = public.get_user_org_id()));

-- Contact log: via job org
create policy "Org members can view contact_log"
  on contact_log for select
  using (exists (select 1 from jobs where jobs.id = contact_log.job_id and jobs.org_id = public.get_user_org_id()));
create policy "Org members can insert contact_log"
  on contact_log for insert
  with check (exists (select 1 from jobs where jobs.id = contact_log.job_id and jobs.org_id = public.get_user_org_id()));

-- Signatures: via job org
create policy "Org members can view signatures"
  on signatures for select
  using (exists (select 1 from jobs where jobs.id = signatures.job_id and jobs.org_id = public.get_user_org_id()));
create policy "Org members can insert signatures"
  on signatures for insert
  with check (exists (select 1 from jobs where jobs.id = signatures.job_id and jobs.org_id = public.get_user_org_id()));

-- PDF templates: via program (all authenticated users can read)
create policy "Authenticated users can view templates"
  on pdf_overlay_templates for select
  using (auth.uid() is not null);
create policy "Owners can manage templates"
  on pdf_overlay_templates for all
  using ((select role from profiles where id = auth.uid()) = 'owner');

-- Submission batches: org-scoped via submitted_by
create policy "Org members can view batches"
  on submission_batches for select
  using ((select org_id from profiles where id = submitted_by) = public.get_user_org_id());
create policy "Org members can insert batches"
  on submission_batches for insert
  with check ((select org_id from profiles where id = submitted_by) = public.get_user_org_id());

create policy "Org members can view batch_jobs"
  on submission_batch_jobs for select
  using (exists (
    select 1 from submission_batches sb
    where sb.id = submission_batch_jobs.batch_id
    and (select org_id from profiles where id = sb.submitted_by) = public.get_user_org_id()
  ));
create policy "Org members can insert batch_jobs"
  on submission_batch_jobs for insert
  with check (exists (
    select 1 from submission_batches sb
    where sb.id = submission_batch_jobs.batch_id
    and (select org_id from profiles where id = sb.submitted_by) = public.get_user_org_id()
  ));

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated_at before update on customers
  for each row execute function update_updated_at();
create trigger jobs_updated_at before update on jobs
  for each row execute function update_updated_at();
create trigger job_systems_updated_at before update on job_systems
  for each row execute function update_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('invoices', 'invoices', false),
  ('signatures', 'signatures', false),
  ('signed-pdfs', 'signed-pdfs', false),
  ('photos', 'photos', false);
