import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId, admin } = await getAuthContext();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("job_id") as string | null;
    const kind = formData.get("kind") as string || "photo_after";

    if (!file || !jobId) {
      return NextResponse.json({ error: "Missing file or job_id" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `photos/${orgId}/${jobId}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await admin.storage
      .from("photos")
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      return NextResponse.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });
    }

    await (admin as any).from("attachments").insert({
      job_id: jobId,
      kind,
      storage_path: storagePath,
      mime_type: file.type,
      byte_size: file.size,
      original_filename: file.name,
      ocr_status: "not_applicable",
      uploaded_by: userId,
    });

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
