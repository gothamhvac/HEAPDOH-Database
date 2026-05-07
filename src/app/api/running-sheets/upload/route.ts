import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { parseRunningSheet } from "@/lib/running-sheet/parse";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId, admin } = await getAuthContext();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Running sheet must be a PDF" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseRunningSheet(bytes);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "Couldn't find a consumer table in this PDF. Is it a Vendor Assignment Notice?" },
        { status: 400 },
      );
    }

    // Store original PDF
    const sheetId = crypto.randomUUID();
    const storagePath = `${orgId}/${sheetId}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from("running-sheets")
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      return NextResponse.json(
        { error: "Storage upload failed: " + uploadErr.message },
        { status: 500 },
      );
    }

    // Persist sheet
    const { data: sheet, error: sheetErr } = await admin
      .from("doh_running_sheets")
      .insert({
        id: sheetId,
        org_id: orgId,
        storage_path: storagePath,
        source_filename: file.name,
        vendor_name: parsed.vendorName,
        sheet_date: parsed.sheetDate,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (sheetErr || !sheet) {
      return NextResponse.json({ error: "Save failed: " + sheetErr?.message }, { status: 500 });
    }

    // Auto-match the parsed vendor name against the org's companies list so the
    // UI can pre-select it (the sheet itself states which vendor it's for).
    // Match tolerates leading/trailing/inner-whitespace and case differences.
    let matchedCompany: { id: string; name: string } | null = null;
    if (parsed.vendorName) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const target = norm(parsed.vendorName);
      const { data: cs } = await admin
        .from("companies")
        .select("id, name")
        .eq("org_id", orgId);
      const hits = ((cs || []) as Array<{ id: string; name: string }>).filter((c) => norm(c.name) === target);
      if (hits.length === 1) matchedCompany = hits[0];
    }

    // Match rows against existing jobs by application_id (stored in jobs.invoice_number)
    const appIds = parsed.rows.map((r) => r.applicationId);
    const { data: existingJobs } = await admin
      .from("jobs")
      .select("id, invoice_number, status")
      .eq("org_id", orgId)
      .in("invoice_number", appIds);

    const matchByAppId = new Map<string, { id: string; status: string }>();
    for (const j of existingJobs || []) {
      if (j.invoice_number) {
        matchByAppId.set(String(j.invoice_number), { id: j.id, status: j.status });
      }
    }

    // Persist rows
    const rowInserts = parsed.rows.map((r) => ({
      sheet_id: sheet.id,
      application_id: r.applicationId,
      consumer_name: r.consumerName,
      assignment_date: r.assignmentDate,
      paper_mail: r.paperMail,
      page_index: r.pageIndex,
      row_y: r.rowY,
      matched_job_id: matchByAppId.get(r.applicationId)?.id ?? null,
    }));
    const { error: rowsErr } = await admin
      .from("doh_running_sheet_rows")
      .insert(rowInserts);

    if (rowsErr) {
      return NextResponse.json({ error: "Row save failed: " + rowsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      sheet,
      matchedCompany,
      rows: parsed.rows.map((r) => ({
        ...r,
        matchedJob: matchByAppId.get(r.applicationId) ?? null,
      })),
    });
  } catch (err) {
    console.error("Running sheet parse error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 },
    );
  }
}
