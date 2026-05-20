import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

const ALLOWED_REASONS = new Set(["restock", "manual", "correction", "initial"]);

// POST /api/inventory/adjust
// Body: { ac_model_id, delta, reason, notes? }
//
// Inserts a single transaction. "install" is reserved for the overlay route
// (with the unique-per-job_system index) — users go through restock/manual/
// correction/initial here.
export async function POST(request: NextRequest) {
  try {
    const { orgId, userId, admin } = await getAuthContext();
    const body = await request.json();
    const { ac_model_id, delta, reason, notes } = body;

    if (!ac_model_id || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: "ac_model_id and a non-zero numeric delta are required" }, { status: 400 });
    }
    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: `reason must be one of ${[...ALLOWED_REASONS].join(", ")}` }, { status: 400 });
    }

    // Confirm the model belongs to this org so we don't let a forged
    // ac_model_id from another tenant pass RLS.
    const { data: model, error: mErr } = await admin
      .from("ac_models")
      .select("id, org_id")
      .eq("id", ac_model_id)
      .single();

    if (mErr || !model || model.org_id !== orgId) {
      return NextResponse.json({ error: "AC model not found" }, { status: 404 });
    }

    const { data: tx, error: txErr } = await admin
      .from("inventory_transactions")
      .insert({
        org_id: orgId,
        ac_model_id,
        delta,
        reason,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({ transaction: tx });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
