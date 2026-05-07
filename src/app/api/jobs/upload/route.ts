import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId, admin } = await getAuthContext();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("job_id") as string | null;
    const programCode = formData.get("program_code") as string | null;

    if (!file || !jobId) {
      return NextResponse.json({ error: "Missing file or job_id" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `invoices/${orgId}/${jobId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await admin.storage
      .from("invoices")
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      return NextResponse.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });
    }

    const { data: attachment, error: attachErr } = await admin
      .from("attachments")
      .insert({
        job_id: jobId,
        kind: "invoice_original",
        storage_path: storagePath,
        mime_type: file.type,
        byte_size: file.size,
        original_filename: file.name,
        ocr_status: programCode === "HEAP" ? "pending" : "not_applicable",
        uploaded_by: userId,
      })
      .select()
      .single();

    if (attachErr) {
      return NextResponse.json({ error: "Attachment failed: " + attachErr.message }, { status: 500 });
    }

    return NextResponse.json({ attachment });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
