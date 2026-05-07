import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: techId } = await params;
    const { admin } = await getAuthContext();
    const body = await request.json();
    const { image_data } = body;

    if (!image_data) {
      return NextResponse.json({ error: "Signature data required" }, { status: 400 });
    }

    // Convert base64 to buffer
    const base64 = image_data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    // Upload to storage
    const storagePath = `tech-signatures/${techId}.png`;
    await admin.storage
      .from("signatures")
      .upload(storagePath, buffer, { contentType: "image/png", upsert: true });

    // Update profile
    await admin
      .from("profiles")
      .update({ signature_path: storagePath })
      .eq("id", techId);

    return NextResponse.json({ success: true, signature_path: storagePath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
