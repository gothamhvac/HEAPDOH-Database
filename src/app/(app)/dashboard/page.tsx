"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  AirVent,
  Calendar,
  PhoneCall,
  Wrench,
  FileText,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Briefcase }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700", icon: Briefcase },
  contact_attempted: { label: "Contact Attempted", color: "bg-amber-100 text-amber-700", icon: PhoneCall },
  contacted: { label: "Contacted", color: "bg-purple-100 text-purple-700", icon: PhoneCall },
  scheduled: { label: "Scheduled", color: "bg-cyan-100 text-cyan-700", icon: Calendar },
  installed: { label: "Installed", color: "bg-orange-100 text-orange-700", icon: Wrench },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  submitted: { label: "Submitted", color: "bg-slate-100 text-slate-600", icon: FileText },
  on_hold: { label: "On Hold", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600", icon: XCircle },
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const statusCounts: Record<string, number> = data?.statusCounts || {};
  const cityCounts: Record<string, { total: number; pending: number; completed: number; cancelled: number }> = data?.cityCounts || {};
  const modelCounts: Record<string, { count: number; ac_type: string; btu: number }> = data?.modelCounts || {};
  const programCounts: Record<string, { total: number; pending: number; completed: number; cancelled: number }> = data?.programCounts || {
    HEAP: { total: 0, pending: 0, completed: 0, cancelled: 0 },
    DOH: { total: 0, pending: 0, completed: 0, cancelled: 0 },
  };
  const totalJobs = data?.totalJobs || 0;
  const financials = data?.financials || { totalRevenue: 0, totalCost: 0, grossProfit: 0, completedJobs: 0 };

  const pendingCount = (statusCounts.new || 0) + (statusCounts.contact_attempted || 0) + (statusCounts.contacted || 0) + (statusCounts.scheduled || 0) + (statusCounts.installed || 0);
  const completedCount = (statusCounts.completed || 0) + (statusCounts.submitted || 0);
  const cancelledCount = statusCounts.cancelled || 0;

  const cityEntries = Object.entries(cityCounts).sort((a, b) => b[1].total - a[1].total);
  const modelEntries = Object.entries(modelCounts).sort((a, b) => b[1].count - a[1].count);

  if (isLoading) {
    return (
      <div className="p-5 lg:p-8 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Dashboard</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Jobs" value={totalJobs} icon={Briefcase} color="bg-slate-100 text-slate-700" />
        <StatCard label="Pending" value={pendingCount} icon={Clock} color="bg-amber-100 text-amber-700" />
        <StatCard label="Completed" value={completedCount} icon={CheckCircle2} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Cancelled" value={cancelledCount} icon={XCircle} color="bg-red-100 text-red-600" />
      </div>

      {/* Program breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <ProgramCard code="HEAP" counts={programCounts.HEAP} />
        <ProgramCard code="DOH" counts={programCounts.DOH} />
      </div>

      {/* Financials */}
      {financials.completedJobs > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Financials ({financials.completedJobs} completed jobs)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-blue-50">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Revenue</p>
              <p className="text-2xl font-bold text-blue-900">${financials.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unit Cost</p>
              <p className="text-2xl font-bold text-slate-900">${financials.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Brackets</p>
              <p className="text-2xl font-bold text-amber-900">${(financials.bracketCost || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-xl ${financials.grossProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${financials.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>Gross Profit</p>
              <p className={`text-2xl font-bold ${financials.grossProfit >= 0 ? "text-emerald-900" : "text-red-900"}`}>
                ${financials.grossProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4">By Status</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = statusCounts[key] || 0;
            if (count === 0) return null;
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{count}</p>
                  <p className="text-xs text-slate-500">{config.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By City */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">By City</h2>
          </div>
          {cityEntries.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No data yet</p>
          ) : (
            <div className="space-y-2">
              {cityEntries.map(([city, counts]) => (
                <div key={city} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm font-bold text-slate-800">{city}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-slate-700">{counts.total} total</span>
                    {counts.completed > 0 && (
                      <span className="text-emerald-600 font-bold">{counts.completed} done</span>
                    )}
                    {counts.pending > 0 && (
                      <span className="text-amber-600 font-bold">{counts.pending} pending</span>
                    )}
                    {counts.cancelled > 0 && (
                      <span className="text-red-500 font-bold">{counts.cancelled} cancelled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Units installed by model */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <AirVent className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Units Installed</h2>
          </div>
          {modelEntries.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No installs yet</p>
          ) : (
            <div className="space-y-2">
              {modelEntries.map(([model, info]) => (
                <div key={model} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div>
                    <span className="text-sm font-bold text-slate-800">{model}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      {info.ac_type && <span className="capitalize">{info.ac_type}</span>}
                      {info.btu > 0 && <span>{info.btu.toLocaleString()} BTU</span>}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{info.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
    </div>
  );
}

function ProgramCard({
  code,
  counts,
}: {
  code: string;
  counts: { total: number; pending: number; completed: number; cancelled: number };
}) {
  const isHeap = code === "HEAP";
  return (
    <div className={`rounded-2xl border-2 p-5 ${isHeap ? "border-blue-200 bg-blue-50/30" : "border-emerald-200 bg-emerald-50/30"}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isHeap ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
            {code}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {isHeap ? "Home Energy Assistance" : "Dept. of Health"}
          </span>
        </div>
        <span className="text-2xl font-bold text-slate-900">{counts.total}</span>
      </div>
      <div className="flex items-center gap-4 text-xs font-bold">
        <span className="text-amber-600">{counts.pending} pending</span>
        <span className="text-emerald-600">{counts.completed} completed</span>
        {counts.cancelled > 0 && <span className="text-red-500">{counts.cancelled} cancelled</span>}
      </div>
    </div>
  );
}
