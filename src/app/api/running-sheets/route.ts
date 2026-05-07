import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();
    const { data, error } = await admin
      .from("doh_running_sheets")
      .select("*, rows:doh_running_sheet_rows(id, matched_job_id, created_job_id)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sheets: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
