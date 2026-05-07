import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const { admin } = await getAuthContext();
    const body = await request.json();
    const { scheduled_at, ac_type, room, btu, ac_model_id, serial_number, sqft, company_id } = body;

    if (!scheduled_at) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const jobUpdate: Record<string, unknown> = { scheduled_at, status: "scheduled" };
    if (company_id !== undefined) jobUpdate.company_id = company_id || null;

    const { error: jobError } = await admin
      .from("jobs")
      .update(jobUpdate)
      .eq("id", jobId);

    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

    const { data: existing } = await admin
      .from("job_systems")
      .select("id")
      .eq("job_id", jobId)
      .limit(1)
      .single();

    const systemData: Record<string, unknown> = {
      job_id: jobId,
      system_type: "ac",
      ac_type: ac_type || null,
      install_location: room || null,
      btu_input: btu ? parseInt(btu) : null,
      ac_model_id: ac_model_id || null,
      serial_number: serial_number || null,
      sqft: sqft ? parseInt(sqft) : null,
    };

    if (ac_model_id) {
      const { data: model } = await admin
        .from("ac_models")
        .select("brand, model_number")
        .eq("id", ac_model_id)
        .single();
      if (model) {
        systemData.make = model.brand;
        systemData.model = model.model_number;
      }
    }

    if (existing) {
      await admin.from("job_systems").update(systemData).eq("id", existing.id);
    } else {
      await admin.from("job_systems").insert(systemData);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
