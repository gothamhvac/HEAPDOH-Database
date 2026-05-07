import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();

    const { data: techs, error } = await admin
      .from("profiles")
      .select("id, full_name, role, phone, signature_path")
      .eq("org_id", orgId)
      .order("full_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ techs });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();
    const { full_name, phone } = body;

    if (!full_name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Create a placeholder auth user for the tech
    const email = `${full_name.toLowerCase().replace(/\s+/g, ".")}@tech.local`;
    const { data: authUser } = await admin.auth.admin.createUser({
      email,
      password: "tech-" + Math.random().toString(36).slice(2, 10),
      email_confirm: true,
    });

    if (!authUser?.user) {
      return NextResponse.json({ error: "Failed to create tech user" }, { status: 500 });
    }

    const { data: profile, error } = await admin
      .from("profiles")
      .insert({
        id: authUser.user.id,
        org_id: orgId,
        full_name,
        role: "tech",
        phone: phone || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tech: profile });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
