"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Upload, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Template {
  id: string;
  name: string;
  version: number;
  page_count: number;
  active: boolean;
  created_at: string;
  field_map: { key: string; kind: string; purpose: string }[];
  program: { code: string; name: string };
}

export default function PdfTemplatesPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ["pdf-templates"],
    queryFn: async () => {
      const res = await fetch("/api/pdf-templates");
      if (!res.ok) return [];
      return (await res.json()).templates || [];
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess("");

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch("/api/pdf-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      if (res.ok) {
        setUploadSuccess(`Template "${json.program}" uploaded with ${json.fields?.length || 0} fields`);
        refetch();
      }
    } catch {
      setUploadSuccess("Invalid JSON file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const templateList: Template[] = templates || [];

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">PDF Templates</h1>
      <p className="text-sm text-slate-500 mb-6">
        Upload template JSONs from the template mapper tool. These define where fields are placed on invoices.
      </p>

      {/* Upload */}
      <label className="flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:border-blue-400 transition-all cursor-pointer mb-6">
        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <Upload className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Upload Template JSON</p>
          <p className="text-xs text-slate-500">From the PDF Template Mapper tool</p>
        </div>
        <input type="file" accept=".json" onChange={handleUpload} className="hidden" />
      </label>

      {uploadSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-medium mb-5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {uploadSuccess}
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : templateList.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No templates uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templateList.map((t) => {
            const writeFields = t.field_map.filter((f) => f.purpose === "write" || f.purpose === "both");
            const readFields = t.field_map.filter((f) => f.purpose === "read" || f.purpose === "both");
            return (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{t.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      t.program?.code === "HEAP" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {t.program?.code}
                    </span>
                    {t.active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">Active</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">v{t.version}</span>
                </div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>{t.field_map.length} fields total</span>
                  <span>{readFields.length} read</span>
                  <span>{writeFields.length} write</span>
                  <span>{t.page_count} page{t.page_count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
