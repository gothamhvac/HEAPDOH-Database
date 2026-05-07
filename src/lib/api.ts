// Client-side API helpers — all data goes through server API routes (bypasses RLS)

export async function fetchJobs(statusFilter?: string[], companyId?: string) {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter.length > 0) {
    params.set("status", statusFilter.join(","));
  }
  if (companyId) {
    params.set("company_id", companyId);
  }
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
  if (!res.ok) throw new Error("Failed to update job");
  const data = await res.json();
  return data.job;
}
