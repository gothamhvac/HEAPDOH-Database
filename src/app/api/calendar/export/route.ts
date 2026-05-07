import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { PDFDocument } from "pdf-lib";

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    // Get all completed jobs for this date that have signed invoices
    const dayStart = date + "T00:00:00Z";
    const dayEnd = date + "T23:59:59Z";

    const { data: jobs, error } = await admin
      .from("jobs")
      .select(`
        id, status, scheduled_at,
        customer:customers(full_name),
        attachments:attachments(kind, storage_path)
      `)
      .eq("org_id", orgId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Collect all signed invoice paths
    const invoicePaths: { path: string; name: string }[] = [];
    for (const job of jobs || []) {
      const attachments = (job.attachments as Record<string, unknown>[]) || [];
      const signed = attachments.find((a) => a.kind === "invoice_signed");
      if (signed?.storage_path) {
        const customerName = (job.customer as Record<string, unknown>)?.full_name as string || "Unknown";
        invoicePaths.push({
          path: signed.storage_path as string,
          name: customerName,
        });
      }
    }

    if (invoicePaths.length === 0) {
      return NextResponse.json({ error: "No completed invoices for this date" }, { status: 404 });
    }

    // Merge all PDFs into one
    const mergedPdf = await PDFDocument.create();

    for (const invoice of invoicePaths) {
      try {
        const { data: fileData } = await admin.storage
          .from("signed-pdfs")
          .download(invoice.path.replace("signed-pdfs/", ""));

        if (!fileData) {
          // Try full path
          const { data: fileData2 } = await admin.storage
            .from("signed-pdfs")
            .download(invoice.path);
          if (!fileData2) continue;
          const bytes = new Uint8Array(await fileData2.arrayBuffer());
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
          continue;
        }

        const bytes = new Uint8Array(await fileData.arrayBuffer());
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (e) {
        console.error("Failed to merge invoice for", invoice.name, e);
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json({ error: "Could not merge any invoices" }, { status: 500 });
    }

    const pdfBytes = Buffer.from(await mergedPdf.save());
    const filename = `invoices-${date}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
