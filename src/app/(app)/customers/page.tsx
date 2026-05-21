"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Phone, ChevronRight, Users, Search, Trash2, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Customer {
  id: string;
  full_name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone_primary?: string;
  email?: string;
  jobs: { id: string; status: string; program: { code: string } }[];
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tidying, setTidying] = useState(false);
  const [tidyResult, setTidyResult] = useState<{ updated: number; skipped: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  async function handleTidy() {
    setTidying(true);
    setTidyResult(null);
    try {
      const res = await fetch("/api/customers/tidy-addresses", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setTidyResult(json);
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    } finally {
      setTidying(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/customers/${id}/delete`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } finally {
      setDeleting(false);
      setDeleteId(null);
      setDeleteConfirm(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers/list");
      if (!res.ok) return [];
      return (await res.json()).customers || [];
    },
  });

  const customers: Customer[] = data || [];

  const filtered = search
    ? customers.filter((c) =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.city?.toLowerCase().includes(search.toLowerCase()) ||
        c.address_line1?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_primary?.includes(search)
      )
    : customers;

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Customers</h1>
          <p className="text-sm text-slate-500 font-medium">{customers.length} total</p>
        </div>
        <button
          onClick={handleTidy}
          disabled={tidying}
          title="Split apartment numbers out of address line 1 into a clean apt field"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {tidying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Tidy addresses
        </button>
      </div>

      {tidyResult && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 font-medium mb-5">
          Cleaned {tidyResult.updated} address{tidyResult.updated === 1 ? "" : "es"} (split apt out of street).
          {tidyResult.skipped > 0 && <span className="text-emerald-700 font-normal"> {tidyResult.skipped} were already clean.</span>}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, city, address, phone..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {search ? "No customers match your search" : "No customers yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const completedJobs = c.jobs.filter((j) => j.status === "completed" || j.status === "submitted").length;
            const totalJobs = c.jobs.length;
            return (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 group hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-4">
                  <Link href={`/customers/${c.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-blue-700">{c.full_name}</span>
                      {c.jobs.map((j) => (
                        <span key={j.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          (j.program as { code: string })?.code === "HEAP" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {(j.program as { code: string })?.code}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {c.address_line1 ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {c.address_line1}{c.address_line2 ? ` ${c.address_line2}` : ""}{c.city ? `, ${c.city}` : ""}{c.state ? ` ${c.state}` : ""}{c.zip ? ` ${c.zip}` : ""}
                        </span>
                      ) : null}
                      {c.phone_primary ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {c.phone_primary}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold">
                      <span className="text-slate-400">{totalJobs} job{totalJobs !== 1 ? "s" : ""}</span>
                      {completedJobs > 0 && <span className="text-emerald-600">{completedJobs} completed</span>}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/customers/${c.id}`}
                      className="h-8 w-8 rounded-lg hover:bg-blue-50 flex items-center justify-center"
                      title="Open portfolio"
                    >
                      <ChevronRight className="h-4 w-4 text-slate-400 hover:text-blue-600" />
                    </Link>
                    <button
                      onClick={() => { setDeleteId(c.id); setDeleteConfirm(false); }}
                      className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (() => {
        const customer = customers.find((c) => c.id === deleteId);
        if (!customer) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              {!deleteConfirm ? (
                <>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">Delete Customer?</h2>
                  <p className="text-sm text-slate-500 mb-1">
                    Are you sure you want to delete <strong>{customer.full_name}</strong>?
                  </p>
                  <p className="text-xs text-red-500 font-medium mb-5">
                    This will also delete {customer.jobs.length} job{customer.jobs.length !== 1 ? "s" : ""} and all associated invoices, contacts, and signatures.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setDeleteId(null); setDeleteConfirm(false); }}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-red-600 mb-2">Are you absolutely sure?</h2>
                  <p className="text-sm text-slate-500 mb-5">
                    This action <strong>cannot be undone</strong>. All data for <strong>{customer.full_name}</strong> will be permanently deleted.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setDeleteId(null); setDeleteConfirm(false); }}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(deleteId)}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete Permanently"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
