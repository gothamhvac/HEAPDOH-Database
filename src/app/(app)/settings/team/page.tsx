"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2, User, PenTool, Check, X, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";
import SignaturePad, { type SignaturePadRef } from "@/components/signature/SignaturePad";

interface Tech {
  id: string;
  full_name: string;
  role: string;
  phone?: string;
  signature_path?: string;
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingTechId, setSigningTechId] = useState<string | null>(null);
  const [savingSig, setSavingSig] = useState(false);
  const sigRef = useRef<SignaturePadRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: techsData, isLoading } = useQuery({
    queryKey: ["techs"],
    queryFn: async () => {
      const res = await fetch("/api/techs");
      if (!res.ok) return [];
      return (await res.json()).techs || [];
    },
  });

  const techs: Tech[] = techsData || [];

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/techs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newName, phone: newPhone }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["techs"] });
      setNewName("");
      setNewPhone("");
      setShowAdd(false);
    },
  });

  async function saveDrawnSignature(techId: string) {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    setSavingSig(true);
    try {
      const sigData = sigRef.current.toDataURL();
      await fetch(`/api/techs/${techId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: sigData }),
      });
      queryClient.invalidateQueries({ queryKey: ["techs"] });
      setSigningTechId(null);
    } finally {
      setSavingSig(false);
    }
  }

  async function uploadSignature(techId: string, file: File) {
    setSavingSig(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      await fetch(`/api/techs/${techId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: dataUrl }),
      });
      queryClient.invalidateQueries({ queryKey: ["techs"] });
    } finally {
      setSavingSig(false);
    }
  }

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6">
        <ArrowLeft className="h-4 w-4" />Settings
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage technicians and their signatures.</p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)} className="rounded-xl font-bold">
            <Plus className="h-4 w-4 mr-1.5" />Add Tech
          </Button>
        )}
      </div>

      {/* Add tech form */}
      {showAdd && (
        <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">New Technician</h2>
          <div className="space-y-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone (optional)" type="tel"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            <div className="flex gap-3">
              <Button onClick={() => setShowAdd(false)} variant="outline" className="flex-1 rounded-xl font-bold">Cancel</Button>
              <Button onClick={() => addMutation.mutate()} disabled={saving || !newName.trim()} className="flex-1 rounded-xl font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tech list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}</div>
      ) : techs.length === 0 && !showAdd ? (
        <div className="text-center py-16">
          <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No technicians added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {techs.map((tech) => (
            <div key={tech.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-slate-900">{tech.full_name}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="capitalize">{tech.role}</span>
                    {tech.phone && <span>{tech.phone}</span>}
                    {tech.signature_path ? (
                      <span className="text-emerald-600 font-bold">Signature saved</span>
                    ) : (
                      <span className="text-amber-600 font-bold">No signature</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSigningTechId(signingTechId === tech.id ? null : tech.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    signingTechId === tech.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <PenTool className="h-3.5 w-3.5" />
                  {tech.signature_path ? "Update Sig" : "Add Sig"}
                </button>
              </div>

              {/* Signature panel */}
              {signingTechId === tech.id && (
                <div className="border-t border-slate-200 p-4 bg-slate-50">
                  <p className="text-xs font-bold text-slate-500 mb-3">Draw signature or upload an image</p>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-3">
                    <SignaturePad ref={sigRef} height={150} />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => sigRef.current?.clear()}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5"
                    >
                      Clear
                    </button>
                    <div className="flex-1" />

                    {/* Upload option */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadSignature(tech.id, file);
                        e.target.value = "";
                      }}
                    />

                    <Button
                      onClick={() => saveDrawnSignature(tech.id)}
                      disabled={savingSig}
                      className="rounded-lg font-bold text-xs"
                      size="sm"
                    >
                      {savingSig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Save Signature</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
