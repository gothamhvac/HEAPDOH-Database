import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";

export async function GET() {
  try {
    const { admin } = await getAuthContext();

    const { data: templates, error } = await admin
      .from("pdf_overlay_templates")
      .select("*, program:programs(code, name)")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await getAuthContext();
    const body = await request.json();

    // body is the template JSON from the mapper tool
    const programCode = body.program; // "HEAP" or "DOH"

    const { data: program } = await admin
      .from("programs")
      .select("id")
      .eq("code", programCode)
      .single();

    if (!program) {
      return NextResponse.json({ error: `Program ${programCode} not found` }, { status: 404 });
    }

    // Deactivate old templates for this program
    await admin
      .from("pdf_overlay_templates")
      .update({ active: false })
      .eq("program_id", program.id);

    // Insert new template
    const { data: template, error } = await admin
      .from("pdf_overlay_templates")
      .insert({
        program_id: program.id,
        name: `${programCode} Invoice Template`,
        version: body.version || 1,
        page_count: body.totalPages || 1,
        field_map: body.fields,
        active: true,
      })
      .select("*, program:programs(code, name)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
