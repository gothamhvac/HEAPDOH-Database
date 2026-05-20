-- Inventory ledger. Append-only — current stock for an AC model is
-- coalesce(sum(delta), 0) over its transactions. Corrections happen by
-- inserting a reversing row, never by updating or deleting history.

create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  ac_model_id uuid not null references ac_models(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('install', 'restock', 'manual', 'correction', 'initial')),
  job_id uuid references jobs(id) on delete set null,
  job_system_id uuid references job_systems(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

create index inventory_tx_model_idx on inventory_transactions(ac_model_id);
create index inventory_tx_org_idx on inventory_transactions(org_id);

-- Each job_system can only ever produce one install-decrement.
-- This makes the overlay-route hook safely re-runnable.
create unique index inventory_install_per_system
  on inventory_transactions(job_system_id)
  where reason = 'install';

alter table inventory_transactions enable row level security;

create policy "Org members can view inventory_transactions"
  on inventory_transactions for select
  using (org_id = public.get_user_org_id());

create policy "Org members can insert inventory_transactions"
  on inventory_transactions for insert
  with check (org_id = public.get_user_org_id());

-- No update/delete policy — the ledger is immutable. Reverse with a
-- new transaction whose delta cancels the bad one.
