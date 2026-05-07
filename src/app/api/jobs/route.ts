import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();
    const { program_code, customer, invoice_number } = body;

    const { data: program, error: progError } = await admin
      .from("programs")
      .select("id, code")
      .eq("code", program_code)
      .single();

    if (progError || !program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const customerData = {
      org_id: orgId,
      full_name: customer?.full_name || "Pending OCR",
      address_line1: customer?.address_line1 || null,
      address_line2: customer?.address_line2 || null,
      city: customer?.city || null,
      state: customer?.state || null,
      zip: customer?.zip || null,
      phone_primary: customer?.phone_primary || null,
      phone_secondary: customer?.phone_secondary || null,
      email: customer?.email || null,
      notes: customer?.notes || null,
    };

    const { data: newCustomer, error: custError } = await admin
      .from("customers")
      .insert(customerData)
      .select()
      .single();

    if (custError) {
      return NextResponse.json({ error: "Failed to create customer: " + custError.message }, { status: 500 });
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .insert({
        org_id: orgId,
        program_id: program.id,
        customer_id: newCustomer.id,
        invoice_number: invoice_number || null,
        invoice_received_at: new Date().toISOString().split("T")[0],
        status: "new",
      })
      .select("*, customer:customers(*), program:programs(*)")
      .single();

    if (jobError) {
      return NextResponse.json({ error: "Failed to create job: " + jobError.message }, { status: 500 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
