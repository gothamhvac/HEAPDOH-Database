import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// OCR runs in the BROWSER now (see src/lib/ocr/browser.ts). This route
// just accepts the extracted fields the client produced and writes them
// to the customer row + flips the attachment's ocr_status. No serverless
// tesseract — Vercel's function bundler couldn't ship its worker
// transitively without breaking the deploy package.

interface OcrBody {
  job_id: string;
  customerData?: {
    full_name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    phone_primary?: string | null;
  };
  raw_text?: string;
  // Browser sends { error } if OCR couldn't run — we still mark the
  // attachment status so the UI doesn't sit on "Pending" forever.
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const admin = createServiceClient();
    const body = (await request.json()) as OcrBody;

    if (!body.job_id) {
      return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    }

    const { data: attachment } = await admin
      .from("attachments")
      .select("id")
      .eq("job_id", body.job_id)
      .eq("kind", "invoice_original")
      .single();

    if (attachment) {
      await admin
        .from("attachments")
        .update({
          ocr_status: body.error ? "failed" : "done",
          ocr_raw: body.raw_text || null,
        })
        .eq("id", attachment.id);
    }

    const { data: job } = await admin
      .from("jobs")
      .select("customer_id")
      .eq("id", body.job_id)
      .single();

    if (job?.customer_id && body.customerData) {
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(body.customerData)) {
        if (value) updates[key] = value;
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("customers").update(updates).eq("id", job.customer_id);
      }
    }

    return NextResponse.json({
      success: !body.error,
      customerData: body.customerData,
    });
  } catch (err) {
    console.error("OCR persist error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
