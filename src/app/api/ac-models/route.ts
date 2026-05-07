import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();

    const { data: models, error } = await admin
      .from("ac_models")
      .select("*")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("brand")
      .order("btu");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();
    const { brand, model_number, ac_type, btu, description,
      heap_labor_cost, heap_parts_cost, heap_total_cost,
      doh_labor_cost, doh_parts_cost, doh_total_cost, our_cost, bracket_cost } = body;

    if (!brand || !model_number || !ac_type || !btu) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const toNum = (v: unknown) => v != null && v !== "" ? parseFloat(String(v)) : null;

    const { data: model, error } = await admin
      .from("ac_models")
      .insert({
        org_id: orgId,
        brand,
        model_number,
        ac_type,
        btu: parseInt(btu),
        description: description || null,
        heap_labor_cost: toNum(heap_labor_cost),
        heap_parts_cost: toNum(heap_parts_cost),
        heap_total_cost: toNum(heap_total_cost),
        doh_labor_cost: toNum(doh_labor_cost),
        doh_parts_cost: toNum(doh_parts_cost),
        doh_total_cost: toNum(doh_total_cost),
        our_cost: toNum(our_cost),
        bracket_cost: toNum(bracket_cost),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ model });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
