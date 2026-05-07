import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();

    const { data: sheet, error } = await admin
      .from("doh_running_sheets")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    if (error || !sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: rows } = await admin
      .from("doh_running_sheet_rows")
      .select("*")
      .eq("sheet_id", id)
      .order("row_y");

    // Re-resolve matches in case jobs were created/edited since upload.
    const appIds = (rows || []).map((r) => r.application_id);
    const { data: matchJobs } = await admin
      .from("jobs")
      .select("id, invoice_number, status, scheduled_at, installed_at, completed_at")
      .eq("org_id", orgId)
      .in("invoice_number", appIds.length ? appIds : ["__none__"]);

    const byAppId = new Map<string, Record<string, unknown>>();
    for (const j of matchJobs || []) {
      if (j.invoice_number) byAppId.set(String(j.invoice_number), j);
    }

    const enriched = (rows || []).map((r) => ({
      ...r,
      matchedJob: byAppId.get(r.application_id) ?? null,
    }));

    return NextResponse.json({ sheet, rows: enriched });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();

    const { data: sheet } = await admin
      .from("doh_running_sheets")
      .select("storage_path")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (sheet?.storage_path) {
      await admin.storage.from("running-sheets").remove([sheet.storage_path]);
    }
    await admin.from("doh_running_sheets").delete().eq("id", id).eq("org_id", orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
