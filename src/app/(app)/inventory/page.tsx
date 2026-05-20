"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Minus, Package, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

interface InventoryItem {
  id: string;
  brand: string;
  model_number: string;
  ac_type: string;
  btu: number;
  description: string | null;
  current_stock: number;
  scheduled_demand: number;
  recommended_order: number;
}

type AdjustMode = "delta" | "set";

interface AdjustState {
  mode: AdjustMode;
  delta: string;
  target: string;
  reason: "manual" | "restock" | "correction" | "initial";
  notes: string;
}

const REASON_LABELS: Record<AdjustState["reason"], string> = {
  manual: "Manual adjustment",
  restock: "Restock (received order)",
  correction: "Correction (fix a mistake)",
  initial: "Initial stock count",
};

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, setState] = useState<AdjustState>({
    mode: "delta",
    delta: "",
    target: "",
    reason: "manual",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) return { items: [] as InventoryItem[] };
      return (await res.json()) as { items: InventoryItem[] };
    },
  });

  const items = data?.items || [];
  const needsOrder = items.filter((i) => i.recommended_order > 0);

  const adjust = useMutation({
    mutationFn: async ({ id, delta, reason, notes }: { id: string; delta: number; reason: string; notes: string }) => {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ac_model_id: id, delta, reason, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Adjust failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditingId(null);
      setState({ mode: "delta", delta: "", target: "", reason: "manual", notes: "" });
    },
  });

  function openEdit(item: InventoryItem) {
    setEditingId(item.id);
    setState({ mode: "delta", delta: "", target: String(item.current_stock), reason: "manual", notes: "" });
  }

  function submitAdjust(item: InventoryItem) {
    let delta = 0;
    if (state.mode === "delta") {
      delta = parseInt(state.delta, 10);
    } else {
      const target = parseInt(state.target, 10);
      if (!Number.isFinite(target)) return;
      delta = target - item.current_stock;
    }
    if (!Number.isFinite(delta) || delta === 0) return;
    adjust.mutate({ id: item.id, delta, reason: state.reason, notes: state.notes });
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stock per AC model, scheduled demand for the next 30 days, and what to order.
          </p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory"] })}
          variant="outline"
          className="rounded-xl font-bold"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {needsOrder.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-5">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Order needed for {needsOrder.length} model{needsOrder.length === 1 ? "" : "s"}
          </div>
          <ul className="space-y-1">
            {needsOrder.map((i) => (
              <li key={i.id} className="text-xs text-amber-800">
                <span className="font-bold">{i.brand} {i.model_number}</span>
                {" — "}order {i.recommended_order} (stock {i.current_stock}, scheduled {i.scheduled_demand})
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            No AC models yet. Add some on the AC Models page.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <div>Model</div>
            <div className="text-right">In stock</div>
            <div className="text-right">Scheduled</div>
            <div className="text-right">Order</div>
            <div></div>
          </div>
          {items.map((item) => {
            const lowStock = item.recommended_order > 0;
            return (
              <div key={item.id} className="border-b border-slate-100 last:border-0">
                <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-3 items-center px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {item.brand} {item.model_number}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      <span className="capitalize">{item.ac_type}</span>
                      {" · "}
                      {item.btu.toLocaleString()} BTU
                    </p>
                  </div>
                  <div className={`text-right text-sm font-bold ${item.current_stock <= 0 ? "text-red-600" : "text-slate-900"}`}>
                    {item.current_stock}
                  </div>
                  <div className="text-right text-sm font-medium text-slate-600">
                    {item.scheduled_demand}
                  </div>
                  <div className={`text-right text-sm font-bold ${lowStock ? "text-amber-700" : "text-slate-300"}`}>
                    {item.recommended_order || "—"}
                  </div>
                  <div className="flex justify-end">
                    {editingId === item.id ? (
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1"
                      >
                        Cancel
                      </button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => openEdit(item)}
                        className="rounded-xl h-8 text-xs font-bold"
                      >
                        Adjust
                      </Button>
                    )}
                  </div>
                </div>

                {editingId === item.id && (
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-4 space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setState({ ...state, mode: "delta" })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          state.mode === "delta" ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
                        }`}
                      >
                        Add or remove
                      </button>
                      <button
                        onClick={() => setState({ ...state, mode: "set" })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          state.mode === "set" ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
                        }`}
                      >
                        Set exact count
                      </button>
                    </div>

                    {state.mode === "delta" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setState({ ...state, delta: String((parseInt(state.delta || "0") || 0) - 1) })}
                          className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                        >
                          <Minus className="h-4 w-4 text-slate-600" />
                        </button>
                        <input
                          type="number"
                          value={state.delta}
                          onChange={(e) => setState({ ...state, delta: e.target.value })}
                          placeholder="e.g. +5 or -2"
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <button
                          onClick={() => setState({ ...state, delta: String((parseInt(state.delta || "0") || 0) + 1) })}
                          className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                        >
                          <Plus className="h-4 w-4 text-slate-600" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={state.target}
                        onChange={(e) => setState({ ...state, target: e.target.value })}
                        placeholder="New stock count"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reason</label>
                      <select
                        value={state.reason}
                        onChange={(e) => setState({ ...state, reason: e.target.value as AdjustState["reason"] })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {Object.entries(REASON_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <input
                      value={state.notes}
                      onChange={(e) => setState({ ...state, notes: e.target.value })}
                      placeholder="Notes (optional) — e.g. PO #1234"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />

                    <Button
                      onClick={() => submitAdjust(item)}
                      disabled={adjust.isPending || (state.mode === "delta" ? !state.delta || parseInt(state.delta) === 0 : !state.target)}
                      className="w-full rounded-xl font-bold"
                    >
                      {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save adjustment"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
