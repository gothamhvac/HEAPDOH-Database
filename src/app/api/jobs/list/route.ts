import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const companyFilter = searchParams.get("company_id");
    const programFilter = searchParams.get("program"); // e.g. "HEAP" | "DOH"
    const dateFrom = searchParams.get("date_from");    // YYYY-MM-DD, inclusive
    const dateTo = searchParams.get("date_to");        // YYYY-MM-DD, inclusive

    // Resolve program code → id so we can filter the jobs table without a
    // foreign-table filter (Supabase quirks).
    let programId: string | null = null;
    if (programFilter) {
      const { data: prog } = await admin
        .from("programs")
        .select("id")
        .eq("code", programFilter)
        .single();
      programId = prog?.id ?? "__no_match__";
    }

    let query = admin
      .from("jobs")
      .select(`*, customer:customers(id, full_name, address_line1, city, state, zip, phone_primary), program:programs(id, code, name), company:companies(id, name), assigned_tech:profiles(id, full_name)`)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.in("status", statusFilter.split(","));
    }
    if (companyFilter) {
      if (companyFilter === "unassigned") {
        query = query.is("company_id", null);
      } else {
        query = query.eq("company_id", companyFilter);
      }
    }
    if (programId) {
      query = query.eq("program_id", programId);
    }
    if (dateFrom) {
      query = query.gte("scheduled_at", `${dateFrom}T00:00:00Z`);
    }
    if (dateTo) {
      query = query.lte("scheduled_at", `${dateTo}T23:59:59Z`);
    }

    const { data: jobs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
