import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface FieldMapping {
  key: string;
  kind: string;
  purpose: string;
  fontSize?: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await getAuthContext();
    const { job_id, reason } = await request.json();

    if (!job_id || !reason) {
      return NextResponse.json({ error: "job_id and reason required" }, { status: 400 });
    }

    // Load job
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select(`*, customer:customers(*), program:programs(*), company:companies(*), attachments:attachments(*)`)
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get template
    const { data: template } = await admin
      .from("pdf_overlay_templates")
      .select("*")
      .eq("program_id", job.program.id)
      .eq("active", true)
      .single();

    if (!template) {
      return NextResponse.json({ error: "No template found" }, { status: 404 });
    }

    // Get original invoice
    const invoiceAttachment = job.attachments?.find(
      (a: Record<string, unknown>) => a.kind === "invoice_original"
    );

    if (!invoiceAttachment) {
      return NextResponse.json({ error: "No invoice found" }, { status: 404 });
    }

    const { data: fileData } = await admin.storage
      .from("invoices")
      .download(invoiceAttachment.storage_path);

    if (!fileData) {
      return NextResponse.json({ error: "Failed to download invoice" }, { status: 500 });
    }

    const originalBytes = new Uint8Array(await fileData.arrayBuffer());
    const customer = job.customer || {};
    const companyOverrides = (((job.company as Record<string, unknown> | null) || {}).invoice_overrides as Record<string, string> | null) || {};
    const checkMarkStyle: "x" | "check" = companyOverrides.check_mark_style === "check" ? "check" : "x";

    // Load PDF
    const pdf = await PDFDocument.load(originalBytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fieldMap = template.field_map as FieldMapping[];

    const writeFields = fieldMap.filter(
      (f) => f.purpose === "write" || f.purpose === "both"
    );

    // Checkboxes for cancelled: work NOT completed = checked, work completed = NOT checked
    const checkboxValues = new Map<string, boolean>();
    checkboxValues.set("check_box_1", false);                    // work completed — NOT checked
    checkboxValues.set("work_not_completed_check_box", true);    // work NOT completed — ✓
    checkboxValues.set("registration_warranty_checkbox", false);  // no registration

    // Values to populate
    const values = new Map<string, string>();
    values.set("customer_name", customer.full_name || "");
    values.set("address", customer.address_line1 || "");
    values.set("city", customer.city || "");
    values.set("state", customer.state || "");
    values.set("zip_code", customer.zip || "");
    values.set("phone_number", customer.phone_primary || "");

    for (const f of writeFields) {
      const page = pdf.getPage((f.page || 1) - 1);

      if (f.kind === "checkbox") {
        const shouldCheck = checkboxValues.get(f.key);
        if (shouldCheck) {
          if (checkMarkStyle === "check") {
            const x0 = f.x + 2;
            const y0 = f.y + f.height * 0.45;
            const x1 = f.x + f.width * 0.4;
            const y1 = f.y + 2;
            const x2 = f.x + f.width - 1;
            const y2 = f.y + f.height - 1;
            page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness: 1.4, color: rgb(0, 0, 0) });
            page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.4, color: rgb(0, 0, 0) });
          } else {
            page.drawText("X", {
              x: f.x + 1,
              y: f.y + 1,
              size: (f.fontSize || 12) - 2,
              font,
              color: rgb(0, 0, 0),
            });
          }
        }
        continue;
      }

      if (f.kind === "signature") continue;

      if (f.kind === "text" || f.kind === "date") {
        const value = values.get(f.key);
        if (value) {
          page.drawText(value, {
            x: f.x,
            y: f.y + 3,
            size: f.fontSize || 10,
            font,
            color: rgb(0, 0, 0),
          });
        }
      }
    }

    // Draw the cancel reason next to the "Work could not be completed" checkbox
    // Find the work_not_completed field to position the reason text
    const notCompletedField = writeFields.find((f) => f.key === "work_not_completed_check_box");
    if (notCompletedField) {
      const page = pdf.getPage((notCompletedField.page || 1) - 1);
      // Draw reason text after "Work could not be completed. Reason:"
      page.drawText(reason, {
        x: notCompletedField.x + 260,
        y: notCompletedField.y + 3,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // Save PDF
    const pdfBytes = await pdf.save();
    const signedPath = `signed-pdfs/${job_id}-cancelled.pdf`;
    await admin.storage
      .from("signed-pdfs")
      .upload(signedPath, pdfBytes, { contentType: "application/pdf", upsert: true });

    // Save attachment
    const { data: existingSigned } = await admin
      .from("attachments")
      .select("id")
      .eq("job_id", job_id)
      .eq("kind", "invoice_signed")
      .single();

    if (existingSigned) {
      await admin.from("attachments").update({ storage_path: signedPath, byte_size: pdfBytes.length }).eq("id", existingSigned.id);
    } else {
      await admin.from("attachments").insert({
        job_id,
        kind: "invoice_signed",
        storage_path: signedPath,
        mime_type: "application/pdf",
        byte_size: pdfBytes.length,
        original_filename: `cancelled-invoice-${job_id}.pdf`,
        ocr_status: "not_applicable",
      });
    }

    // Get download URL
    const { data: signedUrl } = await admin.storage
      .from("signed-pdfs")
      .createSignedUrl(signedPath, 3600);

    return NextResponse.json({
      success: true,
      downloadUrl: signedUrl?.signedUrl,
    });
  } catch (err) {
    console.error("Cancel PDF error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
