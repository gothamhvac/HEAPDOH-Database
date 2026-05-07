import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orgId, admin } = await getAuthContext();
    const body = await request.json().catch(() => ({}));
    let companyId: string | null = body.company_id || null;

    const { data: sheet, error: sheetErr } = await admin
      .from("doh_running_sheets")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    if (sheetErr || !sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If the caller didn't pick a company, fall back to the vendor named on
    // the sheet itself — that's authoritative since the program issued it
    // to that specific vendor. Match tolerates whitespace + case.
    if (!companyId && sheet.vendor_name) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const target = norm(String(sheet.vendor_name));
      const { data: cs } = await admin
        .from("companies")
        .select("id, name")
        .eq("org_id", orgId);
      const hits = ((cs || []) as Array<{ id: string; name: string }>).filter((c) => norm(c.name) === target);
      if (hits.length === 1) companyId = hits[0].id;
    }

    const { data: rows, error: rowsErr } = await admin
      .from("doh_running_sheet_rows")
      .select("*")
      .eq("sheet_id", id);
    if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

    const { data: dohProgram } = await admin
      .from("programs")
      .select("id")
      .eq("code", "DOH")
      .single();
    if (!dohProgram) return NextResponse.json({ error: "DOH program not found" }, { status: 500 });

    // Re-check existing jobs by application_id so we don't double-create.
    const sheetRows = (rows || []) as Array<Record<string, unknown>>;
    const appIds = sheetRows.map((r) => String(r.application_id));
    const { data: existingJobs } = await admin
      .from("jobs")
      .select("id, invoice_number, company_id")
      .eq("org_id", orgId)
      .in("invoice_number", appIds.length ? appIds : ["__none__"]);

    const existingByAppId = new Map<string, { id: string; company_id: string | null }>();
    for (const j of (existingJobs || []) as Array<{ id: string; invoice_number: string | null; company_id: string | null }>) {
      if (j.invoice_number) {
        existingByAppId.set(String(j.invoice_number), { id: j.id, company_id: j.company_id });
      }
    }

    let created = 0;
    let matched = 0;
    let backfilled = 0;

    for (const row of sheetRows) {
      // If already matched/created, skip but make sure the link is current.
      const existing = existingByAppId.get(String(row.application_id));
      if (existing) {
        if (row.matched_job_id !== existing.id) {
          await admin
            .from("doh_running_sheet_rows")
            .update({ matched_job_id: existing.id })
            .eq("id", row.id);
        }
        // Backfill company on jobs that don't have one yet — never overwrite
        // a manual choice the user already made.
        if (companyId && !existing.company_id) {
          await admin.from("jobs").update({ company_id: companyId }).eq("id", existing.id);
          backfilled++;
        }
        matched++;
        continue;
      }

      // Create skeleton customer + job. Name on the sheet is "First L." — store
      // it as full_name so the job is recognizable in lists; actual customer
      // details get filled in later.
      const { data: customer, error: custErr } = await admin
        .from("customers")
        .insert({ org_id: orgId, full_name: row.consumer_name })
        .select()
        .single();
      if (custErr || !customer) continue;

      const { data: job, error: jobErr } = await admin
        .from("jobs")
        .insert({
          org_id: orgId,
          program_id: dohProgram.id,
          customer_id: customer.id,
          invoice_number: row.application_id,
          status: "new",
          company_id: companyId,
          invoice_received_at: sheet.sheet_date,
        })
        .select()
        .single();
      if (jobErr || !job) continue;

      await admin
        .from("doh_running_sheet_rows")
        .update({ matched_job_id: job.id, created_job_id: job.id })
        .eq("id", row.id);

      created++;
    }

    await admin
      .from("doh_running_sheets")
      .update({ imported_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      created,
      matched,
      backfilled,
      total: (rows || []).length,
      companyId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
