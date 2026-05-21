import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const companyFilter = searchParams.get("company_id");
    const programFilter = searchParams.get("program"); // e.g. "HEAP" | "DOH"
    const dateFrom = searchParams.get("date_from");    // YYYY-MM-DD, inclusive
    const dateTo = searchParams.get("date_to");        // YYYY-MM-DD, inclusive
    const q = searchParams.get("q")?.trim() || "";     // free text
    const paidFilter = searchParams.get("paid");       // 'yes' | 'no' | null

    // Resolve program code → id so we can filter the jobs table without a
    // foreign-table filter (Supabase quirks).
    let programId: string | null = null;
    if (programFilter) {
      const { data: prog } = await admin
        .from("programs")
        .select("id")
        .eq("code", programFilter)
        .single();
      programId = prog?.id ?? "__no_match__";
    }

    // For text search we resolve customer-side matches in a separate query
    // (Supabase .or() can't span embedded resources cleanly), then OR them
    // with jobs.invoice_number on the main query.
    let customerIds: string[] = [];
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
      const { data: matches } = await admin
        .from("customers")
        .select("id")
        .eq("org_id", orgId)
        .or(
          [
            `full_name.ilike.${pattern}`,
            `address_line1.ilike.${pattern}`,
            `address_line2.ilike.${pattern}`,
            `city.ilike.${pattern}`,
            `zip.ilike.${pattern}`,
            `phone_primary.ilike.${pattern}`,
            `phone_secondary.ilike.${pattern}`,
            `email.ilike.${pattern}`,
          ].join(",")
        );
      customerIds = ((matches || []) as { id: string }[]).map((r) => r.id);
    }

    let query = admin
      .from("jobs")
      .select(`*, customer:customers(id, full_name, address_line1, city, state, zip, phone_primary), program:programs(id, code, name), company:companies(id, name), assigned_tech:profiles(id, full_name)`)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.in("status", statusFilter.split(","));
    }
    if (companyFilter) {
      if (companyFilter === "unassigned") {
        query = query.is("company_id", null);
      } else {
        query = query.eq("company_id", companyFilter);
      }
    }
    if (programId) {
      query = query.eq("program_id", programId);
    }
    if (dateFrom) {
      query = query.gte("scheduled_at", `${dateFrom}T00:00:00Z`);
    }
    if (dateTo) {
      query = query.lte("scheduled_at", `${dateTo}T23:59:59Z`);
    }
    if (paidFilter === "yes") {
      query = query.not("paid_at", "is", null);
    } else if (paidFilter === "no") {
      query = query.is("paid_at", null);
    }

    if (q) {
      const pattern = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
      const parts = [`invoice_number.ilike.${pattern}`];
      if (customerIds.length > 0) {
        parts.push(`customer_id.in.(${customerIds.join(",")})`);
      }
      query = query.or(parts.join(","));
    }

    const { data: jobs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
