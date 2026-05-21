"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Calendar, Building2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { PdfPreview } from "@/components/PdfPreview";

const AC_TYPES = [
  { value: "portable", label: "Portable" },
  { value: "window", label: "Window" },
  { value: "wall", label: "Wall Unit" },
  { value: "fan", label: "Fan" },
];

const ROOMS = [
  { value: "living_room", label: "Living Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "den", label: "Den" },
  { value: "kitchen", label: "Kitchen" },
  { value: "dining_room", label: "Dining Room" },
  { value: "office", label: "Office" },
  { value: "basement", label: "Basement" },
  { value: "other", label: "Other" },
];

interface AcModel {
  id: string;
  brand: string;
  model_number: string;
  ac_type: string;
  btu: number;
  description?: string;
}

export default function SchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [date, setDate] = useState("");
  const [acType, setAcType] = useState("");
  const [room, setRoom] = useState("");
  const [btu, setBtu] = useState("");
  const [acModelId, setAcModelId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });

  const { data: modelsData } = useQuery({
    queryKey: ["ac-models"],
    queryFn: async () => {
      const res = await fetch("/api/ac-models");
      if (!res.ok) return [];
      const data = await res.json();
      return data.models || [];
    },
  });

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) return [];
      return (await res.json()).companies || [];
    },
  });

  interface Company {
    id: string;
    name: string;
  }
  const companies: Company[] = companiesData || [];
  const models: AcModel[] = modelsData || [];

  // Filter models by selected AC type
  const filteredModels = acType
    ? models.filter((m) => m.ac_type === acType)
    : models;

  // When a model is selected, auto-fill BTU
  useEffect(() => {
    if (acModelId) {
      const model = models.find((m) => m.id === acModelId);
      if (model) {
        setBtu(String(model.btu));
        if (!acType) setAcType(model.ac_type);
      }
    }
  }, [acModelId, models, acType]);

  // Pre-fill from existing schedule
  useEffect(() => {
    if (job?.scheduled_at) {
      setDate(new Date(job.scheduled_at as string).toISOString().split("T")[0]);
    }
    if (job?.company_id) setCompanyId(String(job.company_id));
    const systems = (job?.systems as Record<string, unknown>[]) || [];
    if (systems.length > 0) {
      const sys = systems[0];
      if (sys.ac_type) setAcType(String(sys.ac_type));
      if (sys.install_location) setRoom(String(sys.install_location));
      if (sys.btu_input) setBtu(String(sys.btu_input));
      if (sys.ac_model_id) setAcModelId(String(sys.ac_model_id));
    }
  }, [job]);

  async function handleSchedule() {
    if (!date) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/jobs/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_at: new Date(date + "T09:00:00").toISOString(),
          ac_type: acType || null,
          room: room || null,
          btu: btu || null,
          ac_model_id: acModelId || null,
          company_id: companyId || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to schedule");
      }

      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      router.push(`/jobs/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const customer = (job?.customer as Record<string, unknown>) || {};

  if (isLoading) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-xl mx-auto">
      <Link
        href={`/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {String(customer.full_name || "Job")}
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">
        Schedule Install
      </h1>

      {(() => {
        const attachments = (job?.attachments as Record<string, unknown>[] | undefined) || [];
        const original = attachments.find((a) => a.kind === "invoice_original");
        if (!original?.storage_path) return null;
        return (
          <div className="mb-5">
            <PdfPreview
              path={String(original.storage_path)}
              label="Uploaded HEAP Invoice"
              height={420}
            />
          </div>
        );
      })()}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-5 font-medium">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Date */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">
            Install Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Company (vendor) */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-slate-500" />
              Company
            </span>
            <span className="text-slate-400 font-normal ml-1.5 text-xs">Optional now, required at completion</span>
          </label>
          {companies.length > 0 ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
              No companies added yet.{" "}
              <Link href="/settings/companies" className="text-blue-600 font-bold hover:underline">
                Add companies
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
            AC Details
          </h3>
        </div>

        {/* AC Type */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2">AC Type</label>
          <div className="flex gap-2">
            {AC_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setAcType(t.value);
                  setAcModelId(""); // reset model when type changes
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  acType === t.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* AC Model */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">
            AC Model
            <span className="text-slate-400 font-normal ml-1.5 text-xs">Optional</span>
          </label>
          {filteredModels.length > 0 ? (
            <select
              value={acModelId}
              onChange={(e) => setAcModelId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select a model...</option>
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand} {m.model_number} — {m.btu.toLocaleString()} BTU ({m.ac_type})
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
              No models added yet.{" "}
              <Link href="/settings/ac-models" className="text-blue-600 font-bold hover:underline">
                Add AC models
              </Link>
            </div>
          )}
        </div>

        {/* Room */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">Room</label>
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">Select room...</option>
            {ROOMS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* BTU */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">BTU</label>
          <input
            type="number"
            value={btu}
            onChange={(e) => setBtu(e.target.value)}
            placeholder="e.g. 8000"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="pt-3">
          <Button
            onClick={handleSchedule}
            disabled={saving || !date}
            className="w-full h-13 text-base font-bold rounded-xl"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Scheduling...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule Install
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
