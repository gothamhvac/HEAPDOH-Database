import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();

    const { data: job, error } = await admin
      .from("jobs")
      .select(`*, customer:customers(*), program:programs(*), company:companies(*), assigned_tech:profiles(id, full_name), systems:job_systems(*), attachments:attachments(*), contact_log:contact_log(*), signatures:signatures(*)`)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();

    const { data: job, error } = await admin
      .from("jobs")
      .update(body)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
