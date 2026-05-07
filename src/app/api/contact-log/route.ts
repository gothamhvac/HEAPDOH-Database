import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(request: NextRequest) {
  try {
    const { userId, admin } = await getAuthContext();
    const body = await request.json();
    const { job_id, channel, direction, outcome, notes } = body;

    if (!job_id || !channel || !outcome) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: entry, error: logError } = await admin
      .from("contact_log")
      .insert({
        job_id,
        channel: channel || "call",
        direction: direction || "outbound",
        outcome,
        notes: notes || null,
        logged_by: userId,
      })
      .select()
      .single();

    if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

    // Auto-advance job status
    const statusUpdate: Record<string, unknown> = {};
    if (outcome === "reached") {
      statusUpdate.status = "contacted";
    } else if (outcome === "declined") {
      statusUpdate.status = "cancelled";
    } else if (["no_answer", "left_voicemail", "callback_requested"].includes(outcome)) {
      const { data: job } = await admin.from("jobs").select("status").eq("id", job_id).single();
      if (job?.status === "new") {
        statusUpdate.status = "contact_attempted";
      }
    }

    if (Object.keys(statusUpdate).length > 0) {
      await admin.from("jobs").update(statusUpdate).eq("id", job_id);
    }

    return NextResponse.json({ entry, statusUpdate });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
