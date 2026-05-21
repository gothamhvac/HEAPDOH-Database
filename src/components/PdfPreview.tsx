"use client";

import { ExternalLink, FileText } from "lucide-react";

interface PdfPreviewProps {
  path: string;
  label?: string;
  height?: number;
}

// Inline PDF viewer used on the job detail, schedule, and customer
// portfolio pages. The /api/pdf/download route serves the file with
// Content-Disposition: inline so browsers render it in the iframe.
export function PdfPreview({ path, label = "Invoice", height = 600 }: PdfPreviewProps) {
  const url = `/api/pdf/download?path=${encodeURIComponent(path)}`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <FileText className="h-4 w-4 text-slate-400" />
          {label}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </a>
      </div>
      <iframe
        src={url}
        className="w-full bg-white block"
        style={{ height }}
        title={label}
      />
    </div>
  );
}
