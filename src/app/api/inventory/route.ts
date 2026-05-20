import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

// GET /api/inventory
//
// Returns every active AC model with three derived numbers:
//   - current_stock     = sum of all transaction deltas for the model
//   - scheduled_demand  = count of job_systems on jobs with status='scheduled'
//                         and scheduled_at within the next 30 days
//   - recommended_order = max(0, scheduled_demand - current_stock)
//
// Models with zero demand AND zero stock still appear so the page is the
// canonical place to enter starting stock for a new model.
export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();

    const { data: models, error: modelsErr } = await admin
      .from("ac_models")
      .select("id, brand, model_number, ac_type, btu, description")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("brand")
      .order("btu");

    if (modelsErr) return NextResponse.json({ error: modelsErr.message }, { status: 500 });

    // Sum transactions per model
    const { data: txns, error: txErr } = await admin
      .from("inventory_transactions")
      .select("ac_model_id, delta")
      .eq("org_id", orgId);

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    const stockByModel = new Map<string, number>();
    for (const t of (txns || []) as { ac_model_id: string; delta: number }[]) {
      stockByModel.set(t.ac_model_id, (stockByModel.get(t.ac_model_id) || 0) + t.delta);
    }

    // Scheduled demand in next 30 days. We pull job_systems joined to jobs
    // and filter on the job side, then count by ac_model_id in JS.
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);

    const { data: systems, error: sysErr } = await admin
      .from("job_systems")
      .select("ac_model_id, job:jobs!inner(status, scheduled_at, org_id)")
      .eq("job.org_id", orgId)
      .eq("job.status", "scheduled")
      .not("ac_model_id", "is", null)
      .lte("job.scheduled_at", horizon.toISOString())
      .gte("job.scheduled_at", new Date().toISOString());

    if (sysErr) return NextResponse.json({ error: sysErr.message }, { status: 500 });

    const demandByModel = new Map<string, number>();
    for (const s of systems || []) {
      if (!s.ac_model_id) continue;
      demandByModel.set(s.ac_model_id, (demandByModel.get(s.ac_model_id) || 0) + 1);
    }

    type ModelRow = { id: string; brand: string; model_number: string; ac_type: string; btu: number; description: string | null };
    const items = ((models || []) as ModelRow[]).map((m) => {
      const current_stock = stockByModel.get(m.id) || 0;
      const scheduled_demand = demandByModel.get(m.id) || 0;
      return {
        ...m,
        current_stock,
        scheduled_demand,
        recommended_order: Math.max(0, scheduled_demand - current_stock),
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
