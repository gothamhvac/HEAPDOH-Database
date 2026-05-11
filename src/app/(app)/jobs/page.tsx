"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchJobs } from "@/lib/api";
import { PlusCircle, Phone, MapPin, ChevronRight, Building2, Tag, Calendar, X } from "lucide-react";
import { useState } from "react";

const COLUMNS = [
  {
    id: "new",
    label: "New",
    statuses: ["new"],
    color: "border-blue-400",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  {
    id: "contacting",
    label: "Contacting",
    statuses: ["contact_attempted", "contacted"],
    color: "border-amber-400",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    statuses: ["scheduled", "installed"],
    color: "border-cyan-400",
    badge: "bg-cyan-100 text-cyan-700",
    dot: "bg-cyan-500",
  },
  {
    id: "completed",
    label: "Completed",
    statuses: ["completed", "submitted"],
    color: "border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    statuses: ["cancelled"],
    color: "border-red-400",
    badge: "bg-red-100 text-red-600",
    dot: "bg-red-400",
  },
];

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

interface Company {
  id: string;
  name: string;
}

export default function JobsPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [programFilter, setProgramFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const hasActiveFilters = !!(companyFilter || programFilter || dateFrom || dateTo);
  function clearFilters() {
    setCompanyFilter("");
    setProgramFilter("");
    setDateFrom("");
    setDateTo("");
  }

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) return [];
      return (await res.json()).companies || [];
    },
  });
  const companies: Company[] = companiesData || [];

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs", "all", companyFilter, programFilter, dateFrom, dateTo],
    queryFn: () =>
      fetchJobs({
        companyId: companyFilter || undefined,
        program: programFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const allJobs: Record<string, unknown>[] = jobs || [];

  // Group jobs by column
  const grouped = COLUMNS.map((col) => ({
    ...col,
    jobs: allJobs.filter((j) => col.statuses.includes(j.status as string)),
  }));

  return (
    <div className="p-5 lg:p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Jobs</h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            {allJobs.length} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {companies.length > 0 && (
            <div className="relative">
              <Building2 className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="unassigned">— No company —</option>
              </select>
              <ChevronRight className="h-3 w-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          )}

          <div className="relative">
            <Tag className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All programs</option>
              <option value="HEAP">HEAP</option>
              <option value="DOH">DOH</option>
            </select>
            <ChevronRight className="h-3 w-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              className="w-[120px] text-xs font-bold text-slate-700 outline-none bg-transparent"
            />
            <span className="text-slate-300 text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              className="w-[120px] text-xs font-bold text-slate-700 outline-none bg-transparent"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            <button
              onClick={() => setView("board")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                view === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                view === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              List
            </button>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            New Job
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : view === "board" ? (
        /* ─── KANBAN BOARD ─── */
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {grouped.map((col) => (
            <div
              key={col.id}
              className={`flex-1 min-w-[260px] max-w-[340px] flex flex-col rounded-2xl bg-slate-50 border-t-4 ${col.color}`}
            >
              {/* Column header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                  <span className="text-sm font-bold text-slate-800">{col.label}</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${col.badge}`}>
                  {col.jobs.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                {col.jobs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No jobs</p>
                ) : (
                  col.jobs.map((job) => <JobCard key={job.id as string} job={job} />)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="flex-1 overflow-y-auto space-y-2">
          {allJobs.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 text-sm font-medium">No jobs found.</p>
              <Link href="/jobs/new" className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 font-bold hover:underline">
                <PlusCircle className="h-4 w-4" />Create your first job
              </Link>
            </div>
          ) : (
            allJobs.map((job) => (
              <Link
                key={job.id as string}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {((job.customer as Record<string, unknown>)?.full_name as string) === "Pending OCR"
                        ? "New Job — Awaiting Details"
                        : ((job.customer as Record<string, unknown>)?.full_name as string) || "No Name"}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      ((job.program as Record<string, unknown>)?.code as string) === "HEAP"
                        ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {(job.program as Record<string, unknown>)?.code as string}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {STATUS_LABELS[job.status as string] || String(job.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                    {(job.company as Record<string, unknown>)?.name ? (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {String((job.company as Record<string, unknown>).name)}
                      </span>
                    ) : null}
                    {(job.customer as Record<string, unknown>)?.address_line1 ? (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {String((job.customer as Record<string, unknown>).address_line1)}
                        {(job.customer as Record<string, unknown>).city ? `, ${String((job.customer as Record<string, unknown>).city)}` : ""}
                      </span>
                    ) : null}
                    {(job.customer as Record<string, unknown>)?.phone_primary ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        {String((job.customer as Record<string, unknown>).phone_primary)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Record<string, unknown> }) {
  const customer = (job.customer as Record<string, unknown>) || {};
  const program = (job.program as Record<string, unknown>) || {};
  const company = (job.company as Record<string, unknown>) || {};
  const name = String(customer.full_name || "") === "Pending OCR"
    ? "Awaiting Details"
    : String(customer.full_name || "No Name");

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-slate-900 truncate">{name}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-2 ${
          (program.code as string) === "HEAP" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
        }`}>
          {program.code as string}
        </span>
      </div>
      <div className="space-y-0.5 text-[11px] text-slate-500">
        {company.name ? (
          <div className="flex items-center gap-1 font-bold text-slate-600">
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{String(company.name)}</span>
          </div>
        ) : null}
        {customer.address_line1 || customer.city ? (
          <div className="flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {[customer.address_line1, customer.city].filter(Boolean).map(String).join(", ")}
            </span>
          </div>
        ) : null}
        {customer.phone_primary ? (
          <div className="flex items-center gap-1">
            <Phone className="h-2.5 w-2.5 shrink-0" />
            {String(customer.phone_primary)}
          </div>
        ) : null}
      </div>
      {job.scheduled_at ? (
        <div className="mt-2 text-[10px] font-bold text-slate-400">
          {new Date(job.scheduled_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      ) : null}
    </Link>
  );
}
