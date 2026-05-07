import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const companyFilter = searchParams.get("company_id");

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

    const { data: jobs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
