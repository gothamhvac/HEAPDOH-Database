import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();

    const { data: customer, error } = await admin
      .from("customers")
      .update({
        full_name: body.full_name,
        address_line1: body.address_line1 || null,
        address_line2: body.address_line2 || null,
        city: body.city || null,
        state: body.state || null,
        zip: body.zip || null,
        phone_primary: body.phone_primary || null,
        email: body.email || null,
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ customer });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
