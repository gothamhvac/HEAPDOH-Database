-- Payment tracking for completed jobs. paid_at being non-null is the
-- canonical "we got paid" signal — the other fields are descriptive.
-- Payment is intentionally decoupled from job_status: a job can be
-- 'submitted' (paperwork to SSD) and unpaid, or 'completed' and paid.

alter table jobs
  add column paid_at timestamptz,
  add column check_number text,
  add column check_amount numeric(10, 2),
  add column payment_notes text;

create index jobs_paid_at_idx on jobs(paid_at);
