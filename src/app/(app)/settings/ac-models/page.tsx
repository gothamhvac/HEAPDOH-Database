"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2, AirVent, Pencil, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const AC_TYPES = [
  { value: "portable", label: "Portable" },
  { value: "window", label: "Window" },
  { value: "wall", label: "Wall Unit" },
];

interface AcModel {
  id: string;
  brand: string;
  model_number: string;
  ac_type: string;
  btu: number;
  description?: string;
  heap_labor_cost?: number;
  heap_parts_cost?: number;
  heap_total_cost?: number;
  doh_labor_cost?: number;
  doh_parts_cost?: number;
  doh_total_cost?: number;
  our_cost?: number;
  bracket_cost?: number;
}

function CostInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 block mb-1">{label}</label>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
    </div>
  );
}

function ModelForm({ initial, onSave, onCancel, saving }: {
  initial?: AcModel;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [brand, setBrand] = useState(initial?.brand || "");
  const [modelNumber, setModelNumber] = useState(initial?.model_number || "");
  const [acType, setAcType] = useState(initial?.ac_type || "window");
  const [btu, setBtu] = useState(initial?.btu ? String(initial.btu) : "");
  const [description, setDescription] = useState(initial?.description || "");
  const [heapLabor, setHeapLabor] = useState(initial?.heap_labor_cost != null ? String(initial.heap_labor_cost) : "");
  const [heapParts, setHeapParts] = useState(initial?.heap_parts_cost != null ? String(initial.heap_parts_cost) : "");
  const [heapTotal, setHeapTotal] = useState(initial?.heap_total_cost != null ? String(initial.heap_total_cost) : "");
  const [dohLabor, setDohLabor] = useState(initial?.doh_labor_cost != null ? String(initial.doh_labor_cost) : "");
  const [dohParts, setDohParts] = useState(initial?.doh_parts_cost != null ? String(initial.doh_parts_cost) : "");
  const [dohTotal, setDohTotal] = useState(initial?.doh_total_cost != null ? String(initial.doh_total_cost) : "");
  const [ourCost, setOurCost] = useState(initial?.our_cost != null ? String(initial.our_cost) : "");
  const [bracketCost, setBracketCost] = useState(initial?.bracket_cost != null ? String(initial.bracket_cost) : "");

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 mb-4">
      <h2 className="text-sm font-bold text-slate-900 mb-4">{initial ? "Edit AC Model" : "New AC Model"}</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Brand</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. LG, Friedrich"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Model #</label>
            <input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} placeholder="e.g. LP0821GSSM"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 block mb-2">Type</label>
          <div className="flex gap-2">
            {AC_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setAcType(t.value)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold transition-all ${acType === t.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">BTU</label>
            <input type="number" value={btu} onChange={(e) => setBtu(e.target.value)} placeholder="e.g. 8000"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
        </div>

        {/* HEAP Pricing */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">HEAP Pricing</h3>
          <div className="grid grid-cols-3 gap-3">
            <CostInput label="Labor $" value={heapLabor} onChange={setHeapLabor} />
            <CostInput label="Parts $" value={heapParts} onChange={setHeapParts} />
            <CostInput label="Total $" value={heapTotal} onChange={setHeapTotal} />
          </div>
        </div>

        {/* DOH Pricing */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">DOH Pricing</h3>
          <div className="grid grid-cols-3 gap-3">
            <CostInput label="Labor $" value={dohLabor} onChange={setDohLabor} />
            <CostInput label="Unit Cost $" value={dohParts} onChange={setDohParts} />
            <CostInput label="Total $" value={dohTotal} onChange={setDohTotal} />
          </div>
        </div>

        {/* Our Cost */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Our Cost</h3>
          <div className="grid grid-cols-3 gap-3">
            <CostInput label="Unit + Install $" value={ourCost} onChange={setOurCost} />
            <CostInput label="Bracket $ (window)" value={bracketCost} onChange={setBracketCost} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline" className="flex-1 rounded-xl font-bold">Cancel</Button>
          <Button
            onClick={() => onSave({
              brand, model_number: modelNumber, ac_type: acType, btu: parseInt(btu) || 0,
              description: description || null,
              heap_labor_cost: heapLabor ? parseFloat(heapLabor) : null,
              heap_parts_cost: heapParts ? parseFloat(heapParts) : null,
              heap_total_cost: heapTotal ? parseFloat(heapTotal) : null,
              doh_labor_cost: dohLabor ? parseFloat(dohLabor) : null,
              doh_parts_cost: dohParts ? parseFloat(dohParts) : null,
              doh_total_cost: dohTotal ? parseFloat(dohTotal) : null,
              our_cost: ourCost ? parseFloat(ourCost) : null,
              bracket_cost: bracketCost ? parseFloat(bracketCost) : null,
            })}
            disabled={saving || !brand || !modelNumber || !btu}
            className="flex-1 rounded-xl font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Save</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AcModelsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: modelsData, isLoading } = useQuery({
    queryKey: ["ac-models"],
    queryFn: async () => {
      const res = await fetch("/api/ac-models");
      if (!res.ok) return [];
      return (await res.json()).models || [];
    },
  });

  const models: AcModel[] = modelsData || [];

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/ac-models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
    },
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ac-models"] }); setShowForm(false); },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/ac-models/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
    },
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ac-models"] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/ac-models/${id}`, { method: "DELETE" }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ac-models"] }),
  });

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6">
        <ArrowLeft className="h-4 w-4" />Settings
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AC Models</h1>
          <p className="text-sm text-slate-500 mt-0.5">Units with HEAP/DOH pricing and your costs.</p>
        </div>
        {!showForm && !editingId && (
          <Button onClick={() => setShowForm(true)} className="rounded-xl font-bold">
            <Plus className="h-4 w-4 mr-1.5" />Add Model
          </Button>
        )}
      </div>

      {showForm && <ModelForm onSave={(d) => addMutation.mutate(d)} onCancel={() => setShowForm(false)} saving={saving} />}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}</div>
      ) : models.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <AirVent className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No AC models yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((model) =>
            editingId === model.id ? (
              <ModelForm key={model.id} initial={model} onSave={(d) => editMutation.mutate({ id: model.id, data: d })} onCancel={() => setEditingId(null)} saving={saving} />
            ) : (
              <div key={model.id} className="rounded-2xl border border-slate-200 bg-white p-4 group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <AirVent className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{model.brand} {model.model_number}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">{model.ac_type}</span>
                      <span className="text-[10px] font-bold text-slate-400">{model.btu.toLocaleString()} BTU</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] mt-1">
                      {model.heap_total_cost != null && (
                        <span className="text-blue-600 font-bold">HEAP: ${Number(model.heap_total_cost).toFixed(2)}</span>
                      )}
                      {model.doh_total_cost != null && (
                        <span className="text-emerald-600 font-bold">DOH: ${Number(model.doh_total_cost).toFixed(2)}</span>
                      )}
                      {model.our_cost != null && (
                        <span className="text-slate-500 font-bold">Cost: ${Number(model.our_cost).toFixed(2)}</span>
                      )}
                      {model.bracket_cost != null && model.ac_type === "window" && (
                        <span className="text-slate-500 font-bold">Bracket: ${Number(model.bracket_cost).toFixed(2)}</span>
                      )}
                      {model.our_cost != null && model.heap_total_cost != null && (
                        <span className="text-amber-600 font-bold">
                          HEAP Profit: ${(Number(model.heap_total_cost) - Number(model.our_cost)).toFixed(2)}
                        </span>
                      )}
                      {model.our_cost != null && model.doh_total_cost != null && (
                        <span className="text-amber-600 font-bold">
                          DOH Profit: ${(Number(model.doh_total_cost) - Number(model.our_cost)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingId(model.id)} className="h-8 w-8 rounded-lg hover:bg-blue-50 flex items-center justify-center">
                      <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600" />
                    </button>
                    <button onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(model.id); }} className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
