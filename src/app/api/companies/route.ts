import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

const FIELDS = [
  "name",
  "phone",
  "email",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "zip",
  "county",
  "license_number",
  "notes",
] as const;

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();

    const { data: companies, error } = await admin
      .from("companies")
      .select("*")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ companies });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const insertData: Record<string, unknown> = { org_id: orgId };
    for (const f of FIELDS) {
      insertData[f] = body[f] || null;
    }
    insertData.name = body.name;

    const { data: company, error } = await admin
      .from("companies")
      .insert(insertData)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ company });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
