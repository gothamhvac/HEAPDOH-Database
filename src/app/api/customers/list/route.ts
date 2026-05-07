import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();

    const { data: customers, error } = await admin
      .from("customers")
      .select(`
        *,
        jobs:jobs(id, status, program_id, scheduled_at, completed_at, program:programs(code))
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ customers });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
