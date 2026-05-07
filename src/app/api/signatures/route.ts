import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(request: NextRequest) {
  try {
    const { admin } = await getAuthContext();
    const body = await request.json();
    const { job_id, signer_name, signer_role, image_data, profile_sig_path } = body;

    if (!job_id || !signer_name || !signer_role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let storagePath: string;

    if (profile_sig_path) {
      // Use existing signature from tech profile — just reference it
      storagePath = profile_sig_path;
    } else if (image_data) {
      // Convert base64 data URL to buffer and upload
      const base64 = image_data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");

      // Path is relative to the bucket — never prefix the bucket name into
      // the key, or PDF overlay/download paths look in "signatures/signatures/…"
      // and silently fail to find the image.
      storagePath = `${job_id}_${signer_role}.png`;
      const { error: uploadErr } = await admin.storage
        .from("signatures")
        .upload(storagePath, buffer, { contentType: "image/png", upsert: true });

      if (uploadErr) {
        return NextResponse.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "No signature data" }, { status: 400 });
    }

    // Save signature record
    const { data: sig, error: sigErr } = await admin
      .from("signatures")
      .insert({
        job_id,
        signer_name,
        signer_role,
        image_path: storagePath,
      })
      .select()
      .single();

    if (sigErr) {
      return NextResponse.json({ error: sigErr.message }, { status: 500 });
    }

    return NextResponse.json({ signature: sig });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
