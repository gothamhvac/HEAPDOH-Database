import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { extractApartment } from "@/lib/address-utils";

// One-shot backfill: for any customer whose address_line1 has an apartment
// designator baked in but address_line2 is empty, split them apart. Never
// overwrites existing line2 values. Idempotent — safe to run repeatedly.
export async function POST() {
  try {
    const { orgId, admin } = await getAuthContext();

    const { data: customers, error } = await admin
      .from("customers")
      .select("id, address_line1, address_line2")
      .eq("org_id", orgId)
      .not("address_line1", "is", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let updated = 0;
    let skipped = 0;
    for (const c of customers || []) {
      if (c.address_line2 && c.address_line2.trim()) {
        skipped++;
        continue;
      }
      const { street, unit } = extractApartment(String(c.address_line1));
      if (!unit || street === c.address_line1) {
        skipped++;
        continue;
      }
      const { error: updErr } = await admin
        .from("customers")
        .update({ address_line1: street, address_line2: unit })
        .eq("id", c.id)
        .eq("org_id", orgId);
      if (!updErr) updated++;
    }

    return NextResponse.json({
      total: (customers || []).length,
      updated,
      skipped,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
