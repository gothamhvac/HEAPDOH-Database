import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// X-coordinate of the "Installation Status" column on the standard
// Vendor Assignment Notice layout (PDF points, bottom-left origin).
// Tunable here if a future template variant moves the column.
const STATUS_COLUMN_X = 460;

function statusLabel(status: string | undefined, scheduledAt?: string, installedAt?: string): string {
  switch (status) {
    case "scheduled":
      return scheduledAt
        ? `Scheduled ${new Date(scheduledAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`
        : "Scheduled";
    case "installed":
      return installedAt
        ? `Installed ${new Date(installedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`
        : "Installed";
    case "completed":
    case "submitted":
      return "Invoice Submitted";
    case "cancelled":
      return "Cancelled";
    case "on_hold":
      return "On Hold";
    case "contact_attempted":
    case "contacted":
      return "Pending Contact";
    case "new":
      return "New — In Queue";
    default:
      return "";
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();

    const { data: sheet, error: sheetErr } = await admin
      .from("doh_running_sheets")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    if (sheetErr || !sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: rows } = await admin
      .from("doh_running_sheet_rows")
      .select("*")
      .eq("sheet_id", id);

    const sheetRows = (rows || []) as Array<Record<string, unknown>>;
    const appIds = sheetRows.map((r) => String(r.application_id));
    const { data: jobs } = await admin
      .from("jobs")
      .select("id, invoice_number, status, scheduled_at, installed_at")
      .eq("org_id", orgId)
      .in("invoice_number", appIds.length ? appIds : ["__none__"]);

    const jobByAppId = new Map<string, Record<string, unknown>>();
    for (const j of jobs || []) {
      if (j.invoice_number) jobByAppId.set(String(j.invoice_number), j);
    }

    // Load the original PDF
    const { data: file } = await admin.storage
      .from("running-sheets")
      .download(sheet.storage_path);
    if (!file) return NextResponse.json({ error: "Original PDF missing" }, { status: 500 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);

    for (const row of sheetRows) {
      const job = jobByAppId.get(String(row.application_id));
      const label = statusLabel(
        job?.status as string | undefined,
        job?.scheduled_at as string | undefined,
        job?.installed_at as string | undefined,
      );
      if (!label) continue;

      const page = pdf.getPage((row.page_index as number | undefined) || 0);
      const pageHeight = page.getHeight();
      // mupdf gives row_y in top-left-origin (pixels-from-top). pdf-lib draws
      // in the page's user-space, which is bottom-left-origin for normal pages
      // (height > 0) but top-left-origin when the MediaBox is flipped
      // (height < 0, common in some publisher tools — incl. NYS DOH).
      const flipped = pageHeight < 0;
      const y = flipped
        ? -Number(row.row_y) - 2
        : pageHeight - Number(row.row_y) - 2;

      page.drawText(label, {
        x: STATUS_COLUMN_X,
        y,
        size: 9,
        font,
        color: rgb(0.1, 0.4, 0.1),
      });
    }

    const outBytes = await pdf.save();
    const outPath = `${sheet.org_id}/${id}-annotated.pdf`;
    await admin.storage
      .from("running-sheets")
      .upload(outPath, outBytes, { contentType: "application/pdf", upsert: true });

    const { data: signed } = await admin.storage
      .from("running-sheets")
      .createSignedUrl(outPath, 3600);

    return NextResponse.json({ success: true, downloadUrl: signed?.signedUrl });
  } catch (err) {
    console.error("Running sheet annotate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
