"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Table, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Job {
  id: string;
  status: string;
  completed_at: string;
  customer: { full_name: string; address_line1: string; city: string; state: string; zip: string; phone_primary: string };
  program: { code: string };
  systems: { make: string; model: string; serial_number: string; btu_input: number }[];
}

export default function ReportsPage() {
  const [program, setProgram] = useState("HEAP");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams({ program, format: "json" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", program, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) return { jobs: [], count: 0 };
      return res.json();
    },
  });

  const jobs: Job[] = data?.jobs || [];

  function downloadUrl(format: string) {
    const p = new URLSearchParams({ program, format });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/api/reports?${p}`;
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Reports</h1>
      <p className="text-sm text-slate-500 font-medium mb-6">Generate submission reports for HEAP and DOH.</p>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Program */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-2">Program</label>
            <div className="flex gap-2">
              <button
                onClick={() => setProgram("HEAP")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  program === "HEAP" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                HEAP
              </button>
              <button
                onClick={() => setProgram("DOH")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  program === "DOH" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                DOH
              </button>
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-2">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-2">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex-1" />

          {/* Export buttons */}
          <div className="flex gap-2">
            <a
              href={downloadUrl("csv")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <Table className="h-4 w-4" />
              CSV
            </a>
            <a
              href={downloadUrl("pdf")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              All Invoices PDF
            </a>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-bold text-slate-900">
          {jobs.length} completed job{jobs.length !== 1 ? "s" : ""}
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
          program === "HEAP" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
        }`}>
          {program}
        </span>
        {from || to ? (
          <span className="text-xs text-slate-400">
            {from || "..."} — {to || "..."}
          </span>
        ) : null}
      </div>

      {/* Jobs table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white border border-slate-200 animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No completed jobs for this period.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">City</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serial</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">BTU</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const sys = job.systems?.[0] || {};
                  return (
                    <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{job.customer?.full_name || "—"}</span>
                        {job.customer?.phone_primary ? (
                          <span className="block text-xs text-slate-400 mt-0.5">{job.customer.phone_primary}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{job.customer?.city || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{`${sys.make || ""} ${sys.model || ""}`.trim() || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{sys.serial_number || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{sys.btu_input ? sys.btu_input.toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {job.completed_at ? new Date(job.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
