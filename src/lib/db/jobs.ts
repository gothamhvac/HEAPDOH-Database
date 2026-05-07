import { SupabaseClient } from "@supabase/supabase-js";

export async function getPrograms(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("programs")
    .select("id, code, name")
    .order("code");
  if (error) throw error;
  return data;
}

export async function createCustomer(
  supabase: SupabaseClient,
  orgId: string,
  customer: {
    full_name: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone_primary?: string;
    phone_secondary?: string;
    email?: string;
    notes?: string;
  }
) {
  const { data, error } = await supabase
    .from("customers")
    .insert({ org_id: orgId, ...customer })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createJob(
  supabase: SupabaseClient,
  job: {
    org_id: string;
    program_id: string;
    customer_id: string;
    invoice_number?: string;
    status?: string;
  }
) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      org_id: job.org_id,
      program_id: job.program_id,
      customer_id: job.customer_id,
      invoice_number: job.invoice_number || null,
      invoice_received_at: new Date().toISOString().split("T")[0],
      status: job.status || "new",
    })
    .select(
      `
      *,
      customer:customers(*),
      program:programs(*)
    `
    )
    .single();
  if (error) throw error;
  return data;
}

export async function getJobs(
  supabase: SupabaseClient,
  filters?: {
    status?: string[];
    program_code?: string;
    search?: string;
  }
) {
  let query = supabase
    .from("jobs")
    .select(
      `
      *,
      customer:customers(id, full_name, address_line1, city, state, zip, phone_primary),
      program:programs(id, code, name),
      assigned_tech:profiles(id, full_name)
    `
    )
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }

  if (filters?.program_code) {
    query = query.eq("program.code", filters.program_code);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getJob(supabase: SupabaseClient, jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      customer:customers(*),
      program:programs(*),
      assigned_tech:profiles(id, full_name),
      systems:job_systems(*),
      attachments:attachments(*),
      contact_log:contact_log(*),
      signatures:signatures(*)
    `
    )
    .eq("id", jobId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  status: string,
  extra?: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ status, ...extra })
    .eq("id", jobId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCustomers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data;
}
