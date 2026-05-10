import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

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
  isFormField?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await getAuthContext();
    const { job_id } = await request.json();

    if (!job_id) {
      return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    }

    // Load job with all related data
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select(`
        *,
        customer:customers(*),
        program:programs(*),
        company:companies(*),
        systems:job_systems(*),
        signatures:signatures(*),
        attachments:attachments(*)
      `)
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found: " + jobErr?.message }, { status: 404 });
    }

    const customer = job.customer || {};
    const system = job.systems?.[0] || {};
    const programCode = job.program?.code || "";

    // Get assigned tech
    let techName = "";
    if (job.assigned_tech_id) {
      const { data: tech } = await admin.from("profiles").select("full_name").eq("id", job.assigned_tech_id).single();
      if (tech) techName = tech.full_name || "";
    }

    // Get AC model costs
    let laborCost = "";
    let partsCost = "";
    let totalCost = "";
    if (system.ac_model_id) {
      const { data: acModel } = await admin.from("ac_models")
        .select("heap_labor_cost, heap_parts_cost, heap_total_cost, doh_labor_cost, doh_parts_cost, doh_total_cost")
        .eq("id", system.ac_model_id).single();
      if (acModel) {
        if (programCode === "DOH") {
          laborCost = acModel.doh_labor_cost != null ? Number(acModel.doh_labor_cost).toFixed(2) : "";
          partsCost = acModel.doh_parts_cost != null ? Number(acModel.doh_parts_cost).toFixed(2) : "";
          totalCost = acModel.doh_total_cost != null ? Number(acModel.doh_total_cost).toFixed(2) : "";
        } else {
          laborCost = acModel.heap_labor_cost != null ? Number(acModel.heap_labor_cost).toFixed(2) : "";
          partsCost = acModel.heap_parts_cost != null ? Number(acModel.heap_parts_cost).toFixed(2) : "";
          totalCost = acModel.heap_total_cost != null ? Number(acModel.heap_total_cost).toFixed(2) : "";
        }
      }
    }

    const installDate = job.installed_at
      ? new Date(job.installed_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

    const acTypeLabel = system.ac_type ? ` (${system.ac_type})` : "";

    console.log("PDF Overlay —", programCode, "Job:", job_id);
    console.log("Customer:", customer.full_name, customer.city);
    console.log("System:", system.make, system.model, system.btu_input);

    // ─── DOH: AcroForm fields ───
    if (programCode === "DOH") {
      return await generateDohPdf(admin, job, customer, system, techName, laborCost, partsCost, totalCost, installDate, acTypeLabel, job_id);
    }

    // ─── HEAP: Coordinate overlay ───
    return await generateHeapPdf(admin, job, customer, system, techName, laborCost, partsCost, totalCost, installDate, acTypeLabel, job_id);
  } catch (err) {
    console.error("PDF overlay error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF generation failed" }, { status: 500 });
  }
}

// ─── DOH PDF: Fill AcroForm fields ───
async function generateDohPdf(
  admin: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  job: Record<string, unknown>,
  customer: Record<string, unknown>,
  system: Record<string, unknown>,
  techName: string,
  laborCost: string,
  partsCost: string,
  totalCost: string,
  installDate: string,
  acTypeLabel: string,
  jobId: string,
) {
  // Load blank DOH template
  const { data: templateFile } = await admin.storage.from("invoices").download("templates/doh-blank.pdf");
  if (!templateFile) {
    return NextResponse.json({ error: "DOH blank template not found" }, { status: 500 });
  }

  const pdfBytes = new Uint8Array(await templateFile.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();

  // Helper to safely set text field with consistent font size
  function setText(fieldName: string, value: string, size: number = 10) {
    if (!value) return;
    try {
      const field = form.getTextField(fieldName);
      field.setFontSize(size);
      field.setText(value);
    } catch {
      console.log("DOH field not found:", fieldName);
    }
  }

  // Helper to safely check a checkbox
  function setCheck(fieldName: string, checked: boolean) {
    if (!checked) return;
    try {
      const field = form.getCheckBox(fieldName);
      field.check();
    } catch {
      console.log("DOH checkbox not found:", fieldName);
    }
  }

  // Customer fields
  setText("Consumer Name", customer.full_name as string || "");
  setText("Consumer Email Address", customer.email as string || "");
  setText("Consumer Application ID", job.invoice_number as string || "");

  // Try dropdown for consumer county
  try {
    const dropdown = form.getDropdown("Consumer County");
    const city = customer.city as string || "";
    if (city) {
      try { dropdown.select(city); } catch { /* not in dropdown options */ }
    }
  } catch {}

  // Vendor block (top-right of the form): only Name + Technician are
  // pre-printed fields, so that's all we write here.
  const company = (job.company as Record<string, unknown> | null) || null;
  const vendorName = (company?.name as string) || "";

  console.log("DOH vendor:", vendorName, "tech:", techName);
  setText("Vendor Name", vendorName);
  setText("Vendor Technician", techName);
  setText("Installation Technician", techName);
  setText("Technician Name", techName);

  // Consumer block: the AcroForm field NAMES on the DOH blank are misleading.
  // The field internally called "County" sits on the row whose printed label
  // is "Address", and "Phone" sits in the consumer row, not vendor. Write the
  // consumer street + apt and consumer phone to those fields.
  const street = (customer.address_line1 as string) || "";
  const unit = (customer.address_line2 as string) || "";
  const consumerAddress = unit ? `${street} ${unit}`.trim() : street;
  setText("County", consumerAddress);
  setText("Phone", (customer.phone_primary as string) || "");

  // Consumer print name (next to consumer signature at bottom)
  setText("Consumer Name", customer.full_name as string || "");

  // AC details
  const modelStr = `${system.make || ""} ${system.model || ""}`.trim();
  setText("Brand & Model", modelStr ? modelStr + acTypeLabel : "");
  setText("Serial #", system.serial_number as string || "");
  setText("BTUs", system.btu_input ? String(system.btu_input) : "");
  setText("Cooling Room Square Footage", system.sqft ? String(system.sqft) : "");

  // Installation materials based on AC type
  const acType = system.ac_type as string || "";
  let materials = "";
  if (acType === "window") materials = "Bracket, screws";
  else if (acType === "wall") materials = "Liner, foam insulation, screws";
  setText("Installation materials needed", materials);

  // Install date
  setText("Installation Date & time", installDate);
  setText("Preassessment Date & time", installDate);
  setText("Date", installDate);

  // Costs
  setText("Labor Cost", laborCost);
  setText("Unit Cost", partsCost);
  setText("Total Invoice", totalCost);

  // Checkboxes — electrical system
  setCheck("Check Box13", true);  // electrical yes

  // AC type checkbox — acType already declared above
  setCheck("Check Box15", acType === "wall");      // Replacement Sleeve AC
  setCheck("Check Box2", acType === "window");      // Window AC
  setCheck("Check Box3", acType === "portable");    // Portable AC

  // Energy Star — default yes
  setCheck("Check Box16", true);  // energy star yes

  // Provided items — all checked for completed installs
  setCheck("Check Box18", true);  // operating instructions
  setCheck("Check Box19", true);  // warranty
  setCheck("Check Box20", true);  // proof of purchase
  setCheck("Check Box21", true);  // instruction manual

  // Signatures — embed as images on the page
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const signatures = (job.signatures as Record<string, unknown>[]) || [];

  // Load DOH template field map ONCE up front so we can log its state.
  const programId = (job.program as Record<string, unknown>).id as string;
  const { data: tmpl } = await admin
    .from("pdf_overlay_templates")
    .select("field_map")
    .eq("program_id", programId)
    .eq("active", true)
    .single();
  const fieldMap = ((tmpl as Record<string, unknown> | null)?.field_map || []) as FieldMapping[];
  const sigFieldKeys = fieldMap.filter((f) => f.kind === "signature" || f.key.includes("signature")).map((f) => f.key);
  console.log("DOH: signatures on job =", signatures.length, "| template sig keys =", sigFieldKeys);

  for (const sig of signatures) {
    const role = sig.signer_role as string;
    console.log("DOH: processing sig role=", role, "path=", sig.image_path);
    if (!sig.image_path) {
      console.warn("DOH: signature row has no image_path — skipping");
      continue;
    }

    try {
      const { data: sigData, error: dlErr } = await admin.storage.from("signatures").download(sig.image_path as string);
      if (dlErr || !sigData) {
        console.error("DOH: signature download failed for", sig.image_path, dlErr?.message);
        continue;
      }

      const sigBytes = new Uint8Array(await sigData.arrayBuffer());
      const pngImage = await pdf.embedPng(sigBytes);
      const page = pdf.getPage(0);

      const sigFieldKey = role === "customer" ? "consumer_signature" : "technician_signature";
      const sigField = fieldMap.find((f) => f.key === sigFieldKey);

      if (!sigField) {
        console.error("DOH: no field_map entry for", sigFieldKey, "— signature NOT placed. Available sig keys:", sigFieldKeys);
        continue;
      }

      page.drawImage(pngImage, {
        x: sigField.x,
        y: sigField.y,
        width: sigField.width,
        height: sigField.height,
      });
      console.log("DOH: Embedded", role, "signature at", sigField.x, sigField.y);
    } catch (e) {
      console.error("DOH signature error:", e);
    }
  }

  // Flatten form so fields are permanent
  form.flatten();

  return await savePdf(admin, pdf, jobId, "DOH");
}

// ─── HEAP PDF: Coordinate overlay on scanned invoice ───
async function generateHeapPdf(
  admin: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  job: Record<string, unknown>,
  customer: Record<string, unknown>,
  system: Record<string, unknown>,
  techName: string,
  laborCost: string,
  partsCost: string,
  totalCost: string,
  installDate: string,
  acTypeLabel: string,
  jobId: string,
) {
  // Get the active template
  const { data: template } = await admin
    .from("pdf_overlay_templates")
    .select("*")
    .eq("program_id", (job.program as Record<string, unknown>).id as string)
    .eq("active", true)
    .single();

  if (!template) {
    return NextResponse.json({ error: "No active HEAP template" }, { status: 404 });
  }

  // Get original uploaded invoice
  const attachments = (job.attachments as Record<string, unknown>[]) || [];
  const invoiceAttachment = attachments.find((a) => a.kind === "invoice_original");
  if (!invoiceAttachment) {
    return NextResponse.json({ error: "No invoice PDF found" }, { status: 404 });
  }

  const { data: fileData } = await admin.storage.from("invoices").download(invoiceAttachment.storage_path as string);
  if (!fileData) {
    return NextResponse.json({ error: "Failed to download invoice" }, { status: 500 });
  }

  const originalBytes = new Uint8Array(await fileData.arrayBuffer());
  const pdf = await PDFDocument.load(originalBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fieldMap = (template as Record<string, unknown>).field_map as FieldMapping[];

  // Build values
  const values = new Map<string, string>();
  values.set("customer_name", customer.full_name as string || "");
  values.set("address", customer.address_line1 as string || "");
  values.set("city", customer.city as string || "");
  values.set("state", customer.state as string || "");
  values.set("zip_code", customer.zip as string || "");
  values.set("phone_number", customer.phone_primary as string || "");
  values.set("model_number", system.model ? `${system.model}${acTypeLabel}` : "");
  values.set("serial__", system.serial_number as string || "");
  values.set("btu_unit", system.btu_input ? String(system.btu_input) : "");
  values.set("sqft", system.sqft ? String(system.sqft) : "");
  values.set("labor", laborCost);
  values.set("parts", partsCost);
  values.set("total", totalCost);
  values.set("work_completed_date", installDate);
  values.set("date_tech", installDate);
  values.set("date_customer", installDate);
  values.set("name_tech", techName);
  values.set("warranty", "One Year");

  // Checkboxes
  const checkboxValues = new Map<string, boolean>();
  checkboxValues.set("check_box_1", true);
  checkboxValues.set("work_not_completed_check_box", false);
  checkboxValues.set("registration_warranty_checkbox", true);

  const writeFields = fieldMap.filter((f) => f.purpose === "write" || f.purpose === "both");

  for (const f of writeFields) {
    const page = pdf.getPage((f.page || 1) - 1);

    // Checkboxes
    if (f.kind === "checkbox") {
      if (checkboxValues.get(f.key)) {
        page.drawText("X", { x: f.x + 1, y: f.y + 1, size: (f.fontSize || 12) - 2, font, color: rgb(0, 0, 0) });
      }
      continue;
    }

    // Signatures
    if (f.kind === "signature" || f.key.includes("signature")) {
      const role = f.key.includes("customer") || f.key.includes("consumer") ? "customer" : "tech";
      const sig = ((job.signatures as Record<string, unknown>[]) || []).find((s) => s.signer_role === role);
      if (!sig?.image_path) continue;
      try {
        const { data: sigData } = await admin.storage.from("signatures").download(sig.image_path as string);
        if (sigData) {
          const pngImage = await pdf.embedPng(new Uint8Array(await sigData.arrayBuffer()));
          page.drawImage(pngImage, { x: f.x, y: f.y, width: f.width, height: f.height });
        }
      } catch {}
      continue;
    }

    // Text
    if (f.kind === "text" || f.kind === "date") {
      const value = values.get(f.key);
      if (value) {
        page.drawText(value, { x: f.x, y: f.y + 3, size: f.fontSize || 10, font, color: rgb(0, 0, 0) });
      }
    }
  }

  return await savePdf(admin, pdf, jobId, "HEAP");
}

// ─── Save PDF and return download URL ───
async function savePdf(
  admin: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  pdf: PDFDocument,
  jobId: string,
  program: string,
) {
  const pdfBytes = await pdf.save();
  const signedPath = `signed-pdfs/${jobId}.pdf`;

  await admin.storage.from("signed-pdfs").upload(signedPath, pdfBytes, { contentType: "application/pdf", upsert: true });

  // Upsert attachment — delete old and insert new
  await (admin as any).from("attachments").delete().eq("job_id", jobId).eq("kind", "invoice_signed");
  await (admin as any).from("attachments").insert({
    job_id: jobId,
    kind: "invoice_signed",
    storage_path: signedPath,
    mime_type: "application/pdf",
    byte_size: pdfBytes.length,
    original_filename: `signed-invoice-${jobId}.pdf`,
    ocr_status: "not_applicable",
  });

  // Update job
  await (admin as any).from("jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", jobId);

  const { data: signedUrl } = await admin.storage.from("signed-pdfs").createSignedUrl(signedPath, 3600);

  console.log(program, "PDF overlay complete");

  return NextResponse.json({ success: true, downloadUrl: signedUrl?.signedUrl });
}
