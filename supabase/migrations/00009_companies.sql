-- ============================================================
-- COMPANIES — vendor entities used on DOH invoices
-- (HEAP forms come pre-printed with the company; DOH does not.)
-- ============================================================
create table companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  county text,
  license_number text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at before update on companies
  for each row execute function update_updated_at();

create index companies_org_idx on companies (org_id);

alter table companies enable row level security;

create policy "Org members can view companies"
  on companies for select using (org_id = public.get_user_org_id());
create policy "Org members can insert companies"
  on companies for insert with check (org_id = public.get_user_org_id());
create policy "Org members can update companies"
  on companies for update using (org_id = public.get_user_org_id());
create policy "Org members can delete companies"
  on companies for delete using (org_id = public.get_user_org_id());

-- Per-job company selection (which vendor signs/issues this invoice)
alter table jobs add column company_id uuid references companies(id);
create index jobs_company_idx on jobs (company_id);
