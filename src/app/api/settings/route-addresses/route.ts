import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { orgId, admin } = await getAuthContext();
    const { data } = await admin.from("organizations").select("route_start_address, route_end_address").eq("id", orgId).single();
    return NextResponse.json(data || { route_start_address: null, route_end_address: null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const body = await request.json();
    await (admin as any).from("organizations").update({
      route_start_address: body.route_start_address || null,
      route_end_address: body.route_end_address || null,
    }).eq("id", orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
