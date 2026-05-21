// Client-side API helpers — all data goes through server API routes (bypasses RLS)

export interface JobsFilters {
  status?: string[];
  companyId?: string;
  program?: string;   // "HEAP" | "DOH"
  dateFrom?: string;  // YYYY-MM-DD
  dateTo?: string;    // YYYY-MM-DD
  q?: string;         // free-text search across invoice_number + customer fields
  paid?: "yes" | "no";
}

export async function fetchJobs(
  statusFilter?: string[] | JobsFilters,
  companyId?: string,
) {
  // Back-compat: positional (statusFilter, companyId) OR a single filters object.
  const f: JobsFilters = Array.isArray(statusFilter) || statusFilter === undefined
    ? { status: statusFilter as string[] | undefined, companyId }
    : (statusFilter as JobsFilters);

  const params = new URLSearchParams();
  if (f.status && f.status.length > 0) params.set("status", f.status.join(","));
  if (f.companyId) params.set("company_id", f.companyId);
  if (f.program) params.set("program", f.program);
  if (f.dateFrom) params.set("date_from", f.dateFrom);
  if (f.dateTo) params.set("date_to", f.dateTo);
  if (f.q) params.set("q", f.q);
  if (f.paid) params.set("paid", f.paid);

  const res = await fetch(`/api/jobs/list?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch jobs");
  const data = await res.json();
  return data.jobs;
}

export async function fetchJob(id: string) {
  const res = await fetch(`/api/jobs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch job");
  const data = await res.json();
  return data.job;
}

export async function updateJob(id: string, updates: Record<string, unknown>) {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to update job (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.job;
}
