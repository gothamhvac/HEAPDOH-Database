import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import JSZip from "jszip";

// Build a zip of all signed invoices scheduled on `date`, grouped into
// folders by issuing company and program — `<Company>/<HEAP|DOH>/...`.
// Each customer's signed PDF goes in as a separate file (no longer
// merged into a single PDF the way the old version did).

function safeFolderName(name: string): string {
  return (name || "Unknown")
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Unknown";
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    const dayStart = date + "T00:00:00Z";
    const dayEnd = date + "T23:59:59Z";

    const { data: jobs, error } = await admin
      .from("jobs")
      .select(`
        id, status, scheduled_at, invoice_number,
        customer:customers(full_name),
        company:companies(name),
        program:programs(code),
        attachments:attachments(kind, storage_path, original_filename)
      `)
      .eq("org_id", orgId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    interface Entry {
      company: string;
      program: string;
      filename: string;
      storagePath: string;
    }

    const entries: Entry[] = [];
    for (const job of jobs || []) {
      const attachments = (job.attachments as Record<string, unknown>[]) || [];
      const signed = attachments.find((a) => a.kind === "invoice_signed");
      if (!signed?.storage_path) continue;

      const customerName = ((job.customer as Record<string, unknown>)?.full_name as string) || "Unknown";
      const companyName = ((job.company as Record<string, unknown>)?.name as string) || "Unassigned";
      const programCode = ((job.program as Record<string, unknown>)?.code as string) || "Other";

      const invoiceNum = (job.invoice_number as string) || (job.id as string).slice(0, 8);
      entries.push({
        company: safeFolderName(`${companyName} — ${date}`),
        program: safeFolderName(programCode),
        filename: `${date} — ${safeFolderName(customerName)} — ${invoiceNum}.pdf`,
        storagePath: String(signed.storage_path),
      });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "No completed invoices for this date" }, { status: 404 });
    }

    const zip = new JSZip();

    for (const entry of entries) {
      const downloadPath = entry.storagePath.replace(/^signed-pdfs\//, "");
      let { data: fileData } = await admin.storage.from("signed-pdfs").download(downloadPath);

      if (!fileData) {
        // Some legacy rows have the bucket name prefixed — retry as-is.
        const retry = await admin.storage.from("signed-pdfs").download(entry.storagePath);
        fileData = retry.data;
      }

      if (!fileData) {
        console.warn("calendar export: missing PDF for", entry.storagePath);
        continue;
      }

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      zip.folder(entry.company)?.folder(entry.program)?.file(entry.filename, bytes);
    }

    const zipBytes = await zip.generateAsync({ type: "nodebuffer" });
    const filename = `invoices-${date}.zip`;

    return new NextResponse(new Uint8Array(zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
