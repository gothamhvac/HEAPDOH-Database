import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractFromInvoice, mapToCustomerData } from "@/lib/ocr/extract";

// tesseract.js downloads ~10MB of language data on cold start; give the
// function headroom over the 30s default.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const admin = createServiceClient();
    const { job_id } = await request.json();

    if (!job_id) {
      return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    }

    const { data: attachment, error: attachErr } = await admin
      .from("attachments")
      .select("*")
      .eq("job_id", job_id)
      .eq("kind", "invoice_original")
      .single();

    if (attachErr || !attachment) {
      return NextResponse.json({ error: "No invoice found" }, { status: 404 });
    }

    await admin.from("attachments").update({ ocr_status: "processing" }).eq("id", attachment.id);

    const { data: fileData, error: downloadErr } = await admin.storage
      .from("invoices")
      .download(attachment.storage_path);

    if (downloadErr || !fileData) {
      await admin.from("attachments").update({ ocr_status: "failed" }).eq("id", attachment.id);
      return NextResponse.json({ error: "Failed to download invoice" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log("OCR: invoke extractFromInvoice, mime=", attachment.mime_type, "size=", buffer.length);
    const extracted = await extractFromInvoice(buffer, attachment.mime_type || "application/pdf");
    console.log("OCR: extractFromInvoice returned keys=", Object.keys(extracted));
    const customerData = mapToCustomerData(extracted);

    await admin.from("attachments").update({ ocr_status: "done", ocr_raw: extracted }).eq("id", attachment.id);

    const { data: job } = await admin.from("jobs").select("customer_id").eq("id", job_id).single();

    if (job?.customer_id) {
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(customerData)) {
        if (value) updates[key] = value;
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("customers").update(updates).eq("id", job.customer_id);
      }
    }

    return NextResponse.json({ success: true, extracted, customerData });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "OCR failed" }, { status: 500 });
  }
}
