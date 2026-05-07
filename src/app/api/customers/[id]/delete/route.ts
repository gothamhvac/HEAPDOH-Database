import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();

    // Delete all related data first (cascade should handle most, but be safe)
    // Get all jobs for this customer
    const { data: jobs } = await (admin as any).from("jobs").select("id").eq("customer_id", id).eq("org_id", orgId);

    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map((j: { id: string }) => j.id);

      // Delete job-related data
      for (const jobId of jobIds) {
        await (admin as any).from("signatures").delete().eq("job_id", jobId);
        await (admin as any).from("contact_log").delete().eq("job_id", jobId);
        await (admin as any).from("attachments").delete().eq("job_id", jobId);
        await (admin as any).from("job_systems").delete().eq("job_id", jobId);
      }

      // Delete jobs
      await (admin as any).from("jobs").delete().eq("customer_id", id).eq("org_id", orgId);
    }

    // Delete customer
    const { error } = await (admin as any).from("customers").delete().eq("id", id).eq("org_id", orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
