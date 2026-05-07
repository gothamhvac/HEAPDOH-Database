import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};

function mimeAndFilename(path: string): { mime: string; filename: string } {
  const ext = (path.split(".").pop() || "pdf").toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  return { mime, filename: `invoice.${ext}` };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const admin = createServiceClient();
    const bucket = path.startsWith("signed-pdfs") ? "signed-pdfs" : "invoices";
    const storagePath = path.startsWith("signed-pdfs/") ? path.replace("signed-pdfs/", "") : path;
    const { mime, filename } = mimeAndFilename(storagePath);

    const { data, error } = await admin.storage
      .from(bucket)
      .download(path.startsWith("signed-pdfs/") ? storagePath : path);

    if (error || !data) {
      // Try the full path as a fallback
      const { data: data2, error: error2 } = await admin.storage.from(bucket).download(path);
      if (error2 || !data2) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const bytes = await data2.arrayBuffer();
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    const bytes = await data.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
