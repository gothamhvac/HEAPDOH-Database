import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient, createServiceClient } from "@/lib/supabase/server";

// Called immediately after Supabase signUp() to provision an org + profile
// for the new user. Idempotent — calling twice for the same user returns the
// existing profile instead of creating duplicates.
export async function POST(request: NextRequest) {
  const { fullName } = await request.json();
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  // Derive userId from the session, not from the request body, so a malicious
  // client can't provision arbitrary profiles for other users.
  const supabase = await createServerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createServiceClient();

  // Idempotency: if a profile already exists for this user, return its org.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ success: true, orgId: existing.org_id });
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `${fullName}'s Organization` })
    .select()
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message || "Failed to create org" }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    org_id: org.id,
    full_name: fullName,
    role: "owner",
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, orgId: org.id });
}
