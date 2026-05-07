import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();

    // Get all jobs with customer and system data
    const { data: jobs, error } = await admin
      .from("jobs")
      .select(`
        id, status, created_at, scheduled_at, installed_at, completed_at,
        customer:customers(city, state),
        program:programs(code),
        systems:job_systems(ac_type, make, model, btu_input, ac_model_id)
      `)
      .eq("org_id", orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const j of jobs || []) {
      statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    }

    // City breakdown
    const cityCounts: Record<string, { total: number; pending: number; completed: number; cancelled: number }> = {};
    for (const j of jobs || []) {
      const city = (j.customer as Record<string, unknown>)?.city as string || "Unknown";
      if (!cityCounts[city]) cityCounts[city] = { total: 0, pending: 0, completed: 0, cancelled: 0 };
      cityCounts[city].total++;
      if (["completed", "submitted"].includes(j.status)) cityCounts[city].completed++;
      else if (j.status === "cancelled") cityCounts[city].cancelled++;
      else cityCounts[city].pending++;
    }

    // Model breakdown (installed/completed jobs only)
    const modelCounts: Record<string, { count: number; ac_type: string; btu: number }> = {};
    for (const j of jobs || []) {
      if (!["installed", "completed", "submitted"].includes(j.status)) continue;
      const systems = (j.systems as Record<string, unknown>[]) || [];
      for (const sys of systems) {
        const modelName = sys.model ? `${sys.make || ""} ${sys.model}`.trim() : "Unspecified";
        const key = modelName;
        if (!modelCounts[key]) {
          modelCounts[key] = { count: 0, ac_type: (sys.ac_type as string) || "", btu: (sys.btu_input as number) || 0 };
        }
        modelCounts[key].count++;
      }
    }

    // Program breakdown
    const programCounts: Record<string, { total: number; pending: number; completed: number; cancelled: number }> = {
      HEAP: { total: 0, pending: 0, completed: 0, cancelled: 0 },
      DOH: { total: 0, pending: 0, completed: 0, cancelled: 0 },
    };
    for (const j of jobs || []) {
      const code = (j.program as Record<string, unknown>)?.code as string || "HEAP";
      if (!programCounts[code]) programCounts[code] = { total: 0, pending: 0, completed: 0, cancelled: 0 };
      programCounts[code].total++;
      if (["completed", "submitted"].includes(j.status)) programCounts[code].completed++;
      else if (j.status === "cancelled") programCounts[code].cancelled++;
      else programCounts[code].pending++;
    }

    // Revenue & Profit — from completed jobs with AC models
    const completedJobs = (jobs || []).filter((j: Record<string, unknown>) => ["completed", "submitted"].includes(j.status as string));
    const acModelIds = new Set<string>();
    for (const j of completedJobs) {
      for (const sys of (j.systems as Record<string, unknown>[]) || []) {
        if (sys.ac_model_id) acModelIds.add(sys.ac_model_id as string);
      }
    }

    let totalRevenue = 0;
    let totalOurCost = 0;
    let totalBracketCost = 0;
    const acModelData = new Map<string, Record<string, unknown>>();

    if (acModelIds.size > 0) {
      const { data: models } = await admin
        .from("ac_models")
        .select("id, ac_type, heap_total_cost, doh_total_cost, our_cost, bracket_cost")
        .in("id", Array.from(acModelIds));
      for (const m of models || []) {
        acModelData.set(m.id, m);
      }
    }

    for (const j of completedJobs) {
      const code = (j.program as Record<string, unknown>)?.code as string || "HEAP";
      for (const sys of (j.systems as Record<string, unknown>[]) || []) {
        const model = acModelData.get(sys.ac_model_id as string);
        if (!model) continue;
        const rev = code === "DOH"
          ? Number(model.doh_total_cost || 0)
          : Number(model.heap_total_cost || 0);
        const cost = Number(model.our_cost || 0);
        const bracket = model.ac_type === "window" ? Number(model.bracket_cost || 0) : 0;
        totalRevenue += rev;
        totalOurCost += cost;
        totalBracketCost += bracket;
      }
    }

    return NextResponse.json({
      totalJobs: jobs?.length || 0,
      statusCounts,
      cityCounts,
      modelCounts,
      programCounts,
      financials: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalOurCost * 100) / 100,
        bracketCost: Math.round(totalBracketCost * 100) / 100,
        totalExpenses: Math.round((totalOurCost + totalBracketCost) * 100) / 100,
        grossProfit: Math.round((totalRevenue - totalOurCost - totalBracketCost) * 100) / 100,
        completedJobs: completedJobs.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
