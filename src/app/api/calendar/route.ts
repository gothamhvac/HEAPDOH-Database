import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let query = admin
      .from("jobs")
      .select(`
        *,
        customer:customers(id, full_name, address_line1, city, state, zip, phone_primary),
        program:programs(id, code, name),
        systems:job_systems(*, ac_model:ac_models(*))
      `)
      .eq("org_id", orgId)
      .not("scheduled_at", "is", null);

    if (start) query = query.gte("scheduled_at", start);
    if (end) query = query.lte("scheduled_at", end);

    const { data: jobs, error } = await query.order("scheduled_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
