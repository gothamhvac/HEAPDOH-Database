import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

const ALLOWED_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await getAuthContext();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("job_id") as string | null;
    const companyId = (formData.get("company_id") as string) || "";
    const techId = (formData.get("assigned_tech_id") as string) || "";
    const installedAt = (formData.get("installed_at") as string) || "";

    if (!file || !jobId) {
      return NextResponse.json({ error: "Missing file or job_id" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const mime = ALLOWED_EXT[ext];
    if (!mime) {
      return NextResponse.json(
        { error: `Unsupported file type ".${ext}". Use PDF, JPG, or PNG.` },
        { status: 400 },
      );
    }

    const storagePath = `${jobId}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await admin.storage
      .from("signed-pdfs")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || mime,
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: "Upload failed: " + uploadErr.message },
        { status: 500 },
      );
    }

    // Replace any prior signed-invoice attachment for this job
    await (admin as any).from("attachments").delete().eq("job_id", jobId).eq("kind", "invoice_signed");
    await (admin as any).from("attachments").insert({
      job_id: jobId,
      kind: "invoice_signed",
      storage_path: storagePath,
      mime_type: mime,
      byte_size: file.size,
      original_filename: file.name,
      ocr_status: "not_applicable",
    });

    // Mark job completed + record any provided metadata
    const jobUpdate: Record<string, unknown> = {
      status: "completed",
      completed_at: new Date().toISOString(),
      installed_at: installedAt || new Date().toISOString(),
    };
    if (companyId) jobUpdate.company_id = companyId;
    if (techId) jobUpdate.assigned_tech_id = techId;

    await (admin as any).from("jobs").update(jobUpdate).eq("id", jobId);

    const { data: signed } = await admin.storage
      .from("signed-pdfs")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({ success: true, downloadUrl: signed?.signedUrl, mime });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
