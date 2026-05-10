import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

// Soft-delete a tech: keeps the row (and signature_path) so past jobs'
// assigned_tech_id continues to resolve, but hides them from the picker.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: techId } = await params;
    const { orgId, admin } = await getAuthContext();

    const { data: existing, error: lookupErr } = await admin
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", techId)
      .single();

    if (lookupErr || !existing) {
      return NextResponse.json({ error: "Tech not found" }, { status: 404 });
    }
    if (existing.org_id !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.role === "owner") {
      return NextResponse.json({ error: "Cannot archive the owner account" }, { status: 400 });
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", techId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
