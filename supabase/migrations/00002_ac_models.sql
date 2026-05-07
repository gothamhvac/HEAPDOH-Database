-- ============================================================
-- AC MODELS — lookup table for AC units
-- ============================================================
create table ac_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  brand text not null,
  model_number text not null,
  ac_type text not null, -- 'portable' | 'wall' | 'window'
  btu int not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ac_models_updated_at before update on ac_models
  for each row execute function update_updated_at();

alter table ac_models enable row level security;

create policy "Org members can view ac_models"
  on ac_models for select using (org_id = public.get_user_org_id());
create policy "Org members can insert ac_models"
  on ac_models for insert with check (org_id = public.get_user_org_id());
create policy "Org members can update ac_models"
  on ac_models for update using (org_id = public.get_user_org_id());

-- Add AC details to job_systems
alter table job_systems add column ac_type text;        -- 'portable' | 'wall' | 'window'
alter table job_systems add column room text;           -- 'living_room' | 'bedroom' | 'den' | etc
alter table job_systems add column ac_model_id uuid references ac_models(id);
