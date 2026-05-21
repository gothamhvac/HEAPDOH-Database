import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { PDFDocument } from "pdf-lib";

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const program = searchParams.get("program") || "HEAP";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const paid = searchParams.get("paid"); // 'yes' | 'no' | null
    const format = searchParams.get("format") || "json"; // json, pdf, csv

    // Get program ID
    const { data: prog } = await admin.from("programs").select("id").eq("code", program).single();
    if (!prog) return NextResponse.json({ error: "Program not found" }, { status: 404 });

    // Get completed jobs
    let query = admin
      .from("jobs")
      .select(`
        *, customer:customers(*), program:programs(code),
        systems:job_systems(*, ac_model:ac_models(*)),
        attachments:attachments(kind, storage_path)
      `)
      .eq("org_id", orgId)
      .eq("program_id", prog.id)
      .in("status", ["completed", "submitted"]);

    if (from) query = query.gte("completed_at", from);
    if (to) query = query.lte("completed_at", to + "T23:59:59");
    if (paid === "yes") query = query.not("paid_at", "is", null);
    else if (paid === "no") query = query.is("paid_at", null);

    const { data: jobs, error } = await query.order("completed_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (format === "json") {
      // Roll up payment totals so the page can show a summary without
      // re-summing on every render.
      let paidCount = 0;
      let unpaidCount = 0;
      let totalPaid = 0;
      for (const j of jobs || []) {
        if (j.paid_at) {
          paidCount++;
          if (j.check_amount != null) totalPaid += Number(j.check_amount);
        } else {
          unpaidCount++;
        }
      }
      return NextResponse.json({
        jobs,
        count: jobs?.length || 0,
        summary: { paidCount, unpaidCount, totalPaid },
      });
    }

    if (format === "csv") {
      const rows = [["Name", "Address", "City", "State", "Zip", "Phone", "Model", "Serial", "BTU", "Date Completed", "Status", "Paid Date", "Check #", "Amount", "Payment Notes"]];
      for (const job of jobs || []) {
        const c = job.customer || {};
        const sys = job.systems?.[0] || {};
        rows.push([
          c.full_name || "",
          c.address_line1 || "",
          c.city || "",
          c.state || "",
          c.zip || "",
          c.phone_primary || "",
          `${sys.make || ""} ${sys.model || ""}`.trim(),
          sys.serial_number || "",
          sys.btu_input ? String(sys.btu_input) : "",
          job.completed_at ? new Date(job.completed_at).toLocaleDateString() : "",
          job.status,
          job.paid_at ? new Date(job.paid_at).toLocaleDateString() : "",
          job.check_number || "",
          job.check_amount != null ? Number(job.check_amount).toFixed(2) : "",
          job.payment_notes || "",
        ]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${program}-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    if (format === "pdf") {
      // Merge all signed invoices into one PDF
      const mergedPdf = await PDFDocument.create();
      for (const job of jobs || []) {
        const signed = job.attachments?.find((a: Record<string, unknown>) => a.kind === "invoice_signed");
        if (!signed?.storage_path) continue;
        try {
          const path = (signed.storage_path as string).replace("signed-pdfs/", "");
          const { data: fileData } = await admin.storage.from("signed-pdfs").download(path);
          if (!fileData) continue;
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((p) => mergedPdf.addPage(p));
        } catch {}
      }

      if (mergedPdf.getPageCount() === 0) {
        return NextResponse.json({ error: "No invoices to merge" }, { status: 404 });
      }

      const pdfBytes = Buffer.from(await mergedPdf.save());
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${program}-invoices-${new Date().toISOString().split("T")[0]}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
