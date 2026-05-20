"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2, Building2, Pencil, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface InvoiceOverrides {
  model_suffix_window?: string;
  model_suffix_wall?: string;
  model_suffix_portable?: string;
  doh_materials_window?: string;
  doh_materials_wall?: string;
  doh_materials_portable?: string;
  font_family?: string;
  btu_format?: string;
  check_mark_style?: string;
}

interface Company {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  license_number?: string;
  notes?: string;
  invoice_overrides?: InvoiceOverrides;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
    </div>
  );
}

function CompanyForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Company;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [address1, setAddress1] = useState(initial?.address_line1 || "");
  const [address2, setAddress2] = useState(initial?.address_line2 || "");
  const [city, setCity] = useState(initial?.city || "");
  const [state, setState] = useState(initial?.state || "");
  const [zip, setZip] = useState(initial?.zip || "");
  const [county, setCounty] = useState(initial?.county || "");
  const [licenseNumber, setLicenseNumber] = useState(initial?.license_number || "");
  const [notes, setNotes] = useState(initial?.notes || "");

  const ov = initial?.invoice_overrides || {};
  const [modelSuffixWindow, setModelSuffixWindow] = useState(ov.model_suffix_window || "");
  const [modelSuffixWall, setModelSuffixWall] = useState(ov.model_suffix_wall || "");
  const [modelSuffixPortable, setModelSuffixPortable] = useState(ov.model_suffix_portable || "");
  const [dohMatWindow, setDohMatWindow] = useState(ov.doh_materials_window || "");
  const [dohMatWall, setDohMatWall] = useState(ov.doh_materials_wall || "");
  const [dohMatPortable, setDohMatPortable] = useState(ov.doh_materials_portable || "");
  const [fontFamily, setFontFamily] = useState(ov.font_family || "");
  const [btuFormat, setBtuFormat] = useState(ov.btu_format || "");
  const [checkMarkStyle, setCheckMarkStyle] = useState(ov.check_mark_style || "");
  const [showOverrides, setShowOverrides] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 mb-4">
      <h2 className="text-sm font-bold text-slate-900 mb-4">
        {initial ? "Edit Company" : "New Company"}
      </h2>
      <div className="space-y-4">
        <Field label="Company Name *" value={name} onChange={setName} placeholder="e.g. Acme HVAC LLC" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="(555) 123-4567" type="tel" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="ops@company.com" type="email" />
        </div>

        <Field label="Address Line 1" value={address1} onChange={setAddress1} placeholder="123 Main St" />
        <Field label="Address Line 2" value={address2} onChange={setAddress2} placeholder="Suite 100" />

        <div className="grid grid-cols-3 gap-3">
          <Field label="City" value={city} onChange={setCity} />
          <Field label="State" value={state} onChange={setState} placeholder="NY" />
          <Field label="ZIP" value={zip} onChange={setZip} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="County" value={county} onChange={setCounty} placeholder="Bronx" />
          <Field label="License #" value={licenseNumber} onChange={setLicenseNumber} />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOverrides((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <span>Invoice text overrides (per company)</span>
            <span className="text-slate-400">{showOverrides ? "Hide" : "Show"}</span>
          </button>
          {showOverrides && (
            <div className="border-t border-slate-200 p-4 space-y-4 bg-white">
              <p className="text-xs text-slate-500">
                Leave blank to use the defaults. These differentiate invoices for this company on the
                rendered PDF. Suffix is appended to the model number (e.g. <code>{` (Window AC)`}</code>).
              </p>

              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Display</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Font</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Helvetica (default)</option>
                      <option value="HelveticaBold">Helvetica Bold</option>
                      <option value="TimesRoman">Times Roman</option>
                      <option value="TimesRomanBold">Times Roman Bold</option>
                      <option value="Courier">Courier</option>
                      <option value="CourierBold">Courier Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">BTU format</label>
                    <select
                      value={btuFormat}
                      onChange={(e) => setBtuFormat(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">8000 (full)</option>
                      <option value="k">8k (compact)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">HEAP checkbox mark</label>
                    <select
                      value={checkMarkStyle}
                      onChange={(e) => setCheckMarkStyle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">X (default)</option>
                      <option value="check">✓ check mark</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Model suffix by AC type</p>
                <Field label="Window" value={modelSuffixWindow} onChange={setModelSuffixWindow} placeholder=" (window)" />
                <Field label="Wall" value={modelSuffixWall} onChange={setModelSuffixWall} placeholder=" (wall)" />
                <Field label="Portable" value={modelSuffixPortable} onChange={setModelSuffixPortable} placeholder=" (portable)" />
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">DOH installation materials</p>
                <Field label="Window install" value={dohMatWindow} onChange={setDohMatWindow} placeholder="Bracket, screws" />
                <Field label="Wall install" value={dohMatWall} onChange={setDohMatWall} placeholder="Liner, foam insulation, screws" />
                <Field label="Portable install" value={dohMatPortable} onChange={setDohMatPortable} placeholder="" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline" className="flex-1 rounded-xl font-bold">Cancel</Button>
          <Button
            onClick={() => {
              const overrides: InvoiceOverrides = {};
              if (modelSuffixWindow) overrides.model_suffix_window = modelSuffixWindow;
              if (modelSuffixWall) overrides.model_suffix_wall = modelSuffixWall;
              if (modelSuffixPortable) overrides.model_suffix_portable = modelSuffixPortable;
              if (dohMatWindow) overrides.doh_materials_window = dohMatWindow;
              if (dohMatWall) overrides.doh_materials_wall = dohMatWall;
              if (dohMatPortable) overrides.doh_materials_portable = dohMatPortable;
              if (fontFamily) overrides.font_family = fontFamily;
              if (btuFormat) overrides.btu_format = btuFormat;
              if (checkMarkStyle) overrides.check_mark_style = checkMarkStyle;

              onSave({
                name,
                phone: phone || null,
                email: email || null,
                address_line1: address1 || null,
                address_line2: address2 || null,
                city: city || null,
                state: state || null,
                zip: zip || null,
                county: county || null,
                license_number: licenseNumber || null,
                notes: notes || null,
                invoice_overrides: overrides,
              });
            }}
            disabled={saving || !name}
            className="flex-1 rounded-xl font-bold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Save</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: companiesData, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) return [];
      return (await res.json()).companies || [];
    },
  });

  const companies: Company[] = companiesData || [];

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
    },
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setShowForm(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/companies/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6">
        <ArrowLeft className="h-4 w-4" />Settings
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pick one of these as the vendor when completing a DOH invoice.
          </p>
        </div>
        {!showForm && !editingId && (
          <Button onClick={() => setShowForm(true)} className="rounded-xl font-bold">
            <Plus className="h-4 w-4 mr-1.5" />Add Company
          </Button>
        )}
      </div>

      {showForm && (
        <CompanyForm onSave={(d) => addMutation.mutate(d)} onCancel={() => setShowForm(false)} saving={saving} />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : companies.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No companies yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((c) =>
            editingId === c.id ? (
              <CompanyForm
                key={c.id}
                initial={c}
                onSave={(d) => editMutation.mutate({ id: c.id, data: d })}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] mt-0.5 text-slate-500">
                      {c.phone && <span>{c.phone}</span>}
                      {c.county && <span>{c.county} County</span>}
                      {c.license_number && <span>Lic. {c.license_number}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingId(c.id)}
                      className="h-8 w-8 rounded-lg hover:bg-blue-50 flex items-center justify-center"
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${c.name}?`)) deleteMutation.mutate(c.id);
                      }}
                      className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center"
                    >
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
