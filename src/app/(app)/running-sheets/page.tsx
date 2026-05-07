"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Building2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParsedRow {
  consumerName: string;
  applicationId: string;
  assignmentDate: string | null;
  paperMail: boolean;
  matchedJob: { id: string; status: string } | null;
}

interface SheetSummary {
  id: string;
  source_filename: string | null;
  vendor_name: string | null;
  sheet_date: string | null;
  imported_at: string | null;
  created_at: string;
  rows: { id: string; matched_job_id: string | null; created_job_id: string | null }[];
}

interface Company {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contact_attempted: "Attempted",
  contacted: "Contacted",
  scheduled: "Scheduled",
  installed: "Installed",
  completed: "Completed",
  submitted: "Submitted",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export default function RunningSheetsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<{
    sheetId: string;
    rows: ParsedRow[];
    vendorName: string | null;
    matchedCompany: Company | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; matched: number; total: number; backfilled?: number } | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState("");

  const { data: sheetsData } = useQuery({
    queryKey: ["running-sheets"],
    queryFn: async () => {
      const res = await fetch("/api/running-sheets");
      if (!res.ok) return [];
      return (await res.json()).sheets || [];
    },
  });
  const sheets: SheetSummary[] = sheetsData || [];

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) return [];
      return (await res.json()).companies || [];
    },
  });
  const companies: Company[] = companiesData || [];

  async function handleUpload(file: File) {
    setError("");
    setParsed(null);
    setImportResult(null);
    setAnnotatedUrl("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/running-sheets/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setParsed({
        sheetId: json.sheet.id,
        rows: json.rows,
        vendorName: json.sheet.vendor_name || null,
        matchedCompany: json.matchedCompany || null,
      });
      // Pre-select the matched company so the user doesn't have to pick the
      // vendor that's literally printed on the PDF.
      setCompanyId(json.matchedCompany?.id || "");
      queryClient.invalidateQueries({ queryKey: ["running-sheets"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("No sheet");
      const res = await fetch(`/api/running-sheets/${parsed.sheetId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      return json as { created: number; matched: number; total: number; backfilled?: number };
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["running-sheets"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Import failed"),
  });

  const annotateMutation = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("No sheet");
      const res = await fetch(`/api/running-sheets/${parsed.sheetId}/annotate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Annotate failed");
      return json.downloadUrl as string;
    },
    onSuccess: (url) => setAnnotatedUrl(url),
    onError: (err) => setError(err instanceof Error ? err.message : "Annotate failed"),
  });

  const newCount = parsed ? parsed.rows.filter((r) => !r.matchedJob).length : 0;
  const existingCount = parsed ? parsed.rows.length - newCount : 0;

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">DOH Running Sheets</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Upload a Vendor Assignment Notice. The system pulls every consumer from the table, tells you
        which ones are already in the system, and creates skeleton jobs for the new ones.
      </p>

      {/* Upload card */}
      {!parsed && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors disabled:opacity-50"
          >
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-base font-bold text-slate-900">
                {uploading ? "Reading sheet..." : "Choose running sheet PDF"}
              </p>
              <p className="text-xs text-slate-500">
                NYS EPCP Vendor Assignment Notice
              </p>
            </div>
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium mb-5">
          {error}
        </div>
      )}

      {/* Parsed preview */}
      {parsed && (
        <div className="rounded-2xl border border-slate-200 bg-white mb-6 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900">
                {parsed.rows.length} consumer{parsed.rows.length === 1 ? "" : "s"} found
              </h2>
              <button
                onClick={() => { setParsed(null); setImportResult(null); setAnnotatedUrl(""); setCompanyId(""); }}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                Upload a different sheet
              </button>
            </div>
            {parsed.vendorName && (
              <div className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <Building2 className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">
                    Sheet vendor: {parsed.vendorName}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    {parsed.matchedCompany ? (
                      <>Matched to <span className="font-bold text-emerald-700">{parsed.matchedCompany.name}</span> in your Companies list — pre-selected below.</>
                    ) : (
                      <>
                        No matching company in your list.{" "}
                        <Link href="/settings/companies" className="text-blue-600 font-bold hover:underline">
                          Add it
                        </Link>{" "}
                        so future sheets auto-tag.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 font-bold">
                {newCount} new
              </span>
              <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-bold">
                {existingCount} already in system
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {parsed.rows.map((row) => {
              const job = row.matchedJob;
              return (
                <div
                  key={row.applicationId}
                  className="flex items-center gap-3 p-3 px-5 hover:bg-slate-50"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    job ? "bg-blue-50" : "bg-emerald-50"
                  }`}>
                    {job ? (
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-slate-900 truncate">
                        {row.paperMail && <span className="text-amber-600">*</span>}
                        {row.consumerName}
                      </span>
                      <span className="text-xs font-mono text-slate-400">#{row.applicationId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      {row.assignmentDate && <span>Assigned {row.assignmentDate}</span>}
                      {job ? (
                        <span className="font-bold text-blue-600">
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600">Will be created</span>
                      )}
                    </div>
                  </div>
                  {job && (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      Open
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="p-5 border-t border-slate-100 space-y-4">
            {!importResult && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">
                    Tag new jobs to a company
                    {parsed.matchedCompany && (
                      <span className="text-emerald-600 font-bold ml-1.5">Pre-filled from sheet</span>
                    )}
                  </label>
                  {companies.length > 0 ? (
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">No company (assign later)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-400">
                      <Link href="/settings/companies" className="text-blue-600 font-bold hover:underline">
                        Add companies in Settings
                      </Link>{" "}
                      to tag bulk-imported jobs.
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || newCount === 0}
                  className="w-full h-13 text-base font-bold rounded-xl"
                >
                  {importMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" /> Creating jobs...
                    </span>
                  ) : newCount === 0 ? (
                    "No new jobs to create"
                  ) : (
                    `Create ${newCount} new job${newCount === 1 ? "" : "s"}`
                  )}
                </Button>
              </>
            )}

            {importResult && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm font-bold text-emerald-800">
                  ✓ {importResult.created} new job{importResult.created === 1 ? "" : "s"} created.
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {importResult.matched} consumer{importResult.matched === 1 ? " was" : "s were"} already in the system.
                  {importResult.backfilled ? ` Tagged ${importResult.backfilled} existing job${importResult.backfilled === 1 ? "" : "s"} to the sheet's vendor.` : ""}
                </p>
              </div>
            )}

            <Button
              onClick={() => annotateMutation.mutate()}
              disabled={annotateMutation.isPending}
              variant="outline"
              className="w-full h-12 font-bold rounded-xl"
            >
              {annotateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating annotated sheet...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" /> Download annotated sheet
                </span>
              )}
            </Button>
            {annotatedUrl && (
              <a
                href={annotatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-blue-600 font-bold underline"
              >
                Open annotated PDF →
              </a>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {sheets.length > 0 && !parsed && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Past sheets</h2>
          <div className="space-y-2">
            {sheets.map((s) => (
              <SheetRow key={s.id} sheet={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SheetRow({ sheet }: { sheet: SheetSummary }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"download" | "resync" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const total = sheet.rows.length;
  const created = sheet.rows.filter((r) => r.created_job_id).length;

  async function downloadAnnotated() {
    setBusy("download");
    setMsg(null);
    try {
      const res = await fetch(`/api/running-sheets/${sheet.id}/annotate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.downloadUrl) throw new Error(json.error || "Annotate failed");
      window.open(json.downloadUrl, "_blank", "noopener");
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  async function resyncCompanies() {
    setBusy("resync");
    setMsg(null);
    try {
      const res = await fetch(`/api/running-sheets/${sheet.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Re-sync failed");
      const parts: string[] = [];
      if (json.created) parts.push(`${json.created} created`);
      if (json.backfilled) parts.push(`${json.backfilled} tagged to vendor`);
      setMsg({
        kind: "ok",
        text: parts.length ? `Re-synced — ${parts.join(", ")}.` : "Already in sync.",
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["running-sheets"] });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white group">
      <div className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900 truncate">
              {sheet.source_filename || "Running sheet"}
            </p>
            {sheet.imported_at && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                IMPORTED
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
            {sheet.vendor_name && (
              <span className="inline-flex items-center gap-1 font-bold">
                <Building2 className="h-3 w-3" /> {sheet.vendor_name}
              </span>
            )}
            {sheet.sheet_date && <span>{sheet.sheet_date}</span>}
            <span>{total} consumer{total === 1 ? "" : "s"}</span>
            {created > 0 && <span className="text-emerald-600 font-bold">{created} created</span>}
          </div>
        </div>
        <button
          onClick={() => {
            if (!confirm("Delete this running sheet? Jobs already created from it will stay.")) return;
            fetch(`/api/running-sheets/${sheet.id}`, { method: "DELETE" })
              .then(() => queryClient.invalidateQueries({ queryKey: ["running-sheets"] }));
          }}
          className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
          title="Delete sheet"
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
        </button>
      </div>

      {/* Per-row actions */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 border-t border-slate-100 pt-3">
        <button
          onClick={downloadAnnotated}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "download" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
          Annotated PDF
        </button>
        <button
          onClick={resyncCompanies}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Re-tag jobs from this sheet to the vendor it was issued to"
        >
          {busy === "resync" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Building2 className="h-3 w-3" />}
          Re-sync vendor tags
        </button>
        {msg && (
          <span className={`text-[11px] font-bold ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
