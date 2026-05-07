"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  FileDown,
  CheckCircle2,
  AirVent,
  PenTool,
  User,
  Camera,
  X,
  Image,
  Building2,
  Upload,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import SignaturePad, { type SignaturePadRef } from "@/components/signature/SignaturePad";

interface AcModel {
  id: string;
  brand: string;
  model_number: string;
  ac_type: string;
  btu: number;
}

export default function CompletePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"digital" | "upload">("digital");
  const [step, setStep] = useState<"details" | "signature" | "generating" | "done">("details");
  const [acModelId, setAcModelId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [sqft, setSqft] = useState("");
  const [techId, setTechId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [signerName, setSignerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState("");

  // Upload-mode state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [installDate, setInstallDate] = useState(() => new Date().toISOString().split("T")[0]);

  const customerSigRef = useRef<SignaturePadRef>(null);

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });

  const { data: modelsData } = useQuery({
    queryKey: ["ac-models"],
    queryFn: async () => {
      const res = await fetch("/api/ac-models");
      if (!res.ok) return [];
      return (await res.json()).models || [];
    },
  });

  const { data: techsData } = useQuery({
    queryKey: ["techs"],
    queryFn: async () => {
      const res = await fetch("/api/techs");
      if (!res.ok) return [];
      return (await res.json()).techs || [];
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

  interface TechProfile {
    id: string;
    full_name: string;
    signature_path?: string;
  }
  interface Company {
    id: string;
    name: string;
    phone?: string;
    county?: string;
  }
  const techs: TechProfile[] = techsData || [];
  const companies: Company[] = companiesData || [];

  const models: AcModel[] = modelsData || [];
  const customer = (job?.customer as Record<string, unknown>) || {};
  const systems = ((job?.systems as Record<string, unknown>[]) || []);
  const existingSystem = systems[0] || {};
  const programCode = String(((job?.program as Record<string, unknown>) || {}).code || "");
  const isDoh = programCode === "DOH";

  // Pre-fill from existing data
  useEffect(() => {
    if (existingSystem.ac_model_id) setAcModelId(String(existingSystem.ac_model_id));
    if (existingSystem.serial_number) setSerialNumber(String(existingSystem.serial_number));
    if (job?.company_id) setCompanyId(String(job.company_id));
  }, [existingSystem.ac_model_id, existingSystem.serial_number, job?.company_id]);

  async function handleSaveDetails() {
    if (!companyId) {
      setError("Pick a company — every job needs a vendor on file.");
      return;
    }
    setError("");
    setStep("signature");
  }

  async function handleUpload() {
    if (!uploadFile) {
      setError("Pick a scanned file to upload.");
      return;
    }
    if (!companyId) {
      setError("Pick a company — every job needs a vendor on file.");
      return;
    }
    setError("");
    setSaving(true);
    setStep("generating");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("job_id", id);
      formData.append("company_id", companyId);
      if (techId) formData.append("assigned_tech_id", techId);
      if (installDate) {
        formData.append("installed_at", new Date(installDate + "T12:00:00").toISOString());
      }

      const res = await fetch("/api/pdf/upload-signed", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      setDownloadUrl(json.downloadUrl || "");
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("details");
    } finally {
      setSaving(false);
    }
  }

  // Store signature data before switching steps
  const [signatureData, setSignatureData] = useState<string | null>(null);

  async function handleComplete() {
    // Grab signature data BEFORE changing step (which unmounts the canvas)
    const sigRef = customerSigRef.current;
    if (!sigRef || sigRef.isEmpty()) {
      setError("Customer signature is required");
      return;
    }
    const sigData = sigRef.toDataURL();
    setSignatureData(sigData);

    setSaving(true);
    setError("");
    setStep("generating");

    try {
      // Save AC details + mark installed
      const systemData: Record<string, unknown> = {
        serial_number: serialNumber || null,
      };
      if (acModelId) {
        const model = models.find((m) => m.id === acModelId);
        if (model) {
          systemData.ac_model_id = acModelId;
          systemData.make = model.brand;
          systemData.model = model.model_number;
          systemData.btu_input = model.btu;
          systemData.ac_type = model.ac_type;
        }
      }

      // Save system via schedule API (creates or updates job_systems)
      await fetch(`/api/jobs/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_at: job?.scheduled_at || new Date().toISOString(),
          ac_type: systemData.ac_type || null,
          btu: systemData.btu_input || null,
          ac_model_id: systemData.ac_model_id || null,
          serial_number: serialNumber || null,
          sqft: sqft || null,
        }),
      });

      // Mark as installed + assign tech + pin company
      await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installed_at: new Date().toISOString(),
          assigned_tech_id: techId || null,
          company_id: companyId || null,
        }),
      });

      // Save customer signature
      await fetch("/api/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: id,
          signer_name: signerName || String(customer.full_name || "Customer"),
          signer_role: "customer",
          image_data: sigData,
        }),
      });

      // Save tech signature from their profile
      if (techId) {
        const tech = techs.find((t) => t.id === techId);
        if (tech?.signature_path) {
          // Tech already has a saved signature — create a job signature record pointing to it
          await fetch("/api/signatures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: id,
              signer_name: tech.full_name,
              signer_role: "tech",
              image_data: "USE_PROFILE_SIG",
              profile_sig_path: tech.signature_path,
            }),
          });
        }
      }

      // Upload photos if any
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo);
        formData.append("job_id", id);
        formData.append("kind", "photo_after");
        await fetch("/api/jobs/upload-photo", { method: "POST", body: formData });
      }

      // Generate the signed PDF
      const pdfRes = await fetch("/api/pdf/overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: id }),
      });

      if (!pdfRes.ok) {
        const body = await pdfRes.json();
        throw new Error(body.error || "Failed to generate PDF");
      }

      const { downloadUrl: url } = await pdfRes.json();
      setDownloadUrl(url);

      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("signature");
    } finally {
      setSaving(false);
    }
  }

  // ─── Step 1: AC Details ───
  if (step === "details") {
    return (
      <div className="p-5 lg:p-8 max-w-xl mx-auto">
        <Link
          href={`/jobs/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {String(customer.full_name || "Job")}
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Complete Install
          </h1>
        </div>
        <p className="text-slate-500 mb-5">
          {mode === "digital"
            ? "Confirm what was installed, then get the customer signature."
            : "Already have a signed paper invoice? Upload the scan to mark this job complete."}
        </p>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setMode("digital"); setError(""); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "digital" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <PenTool className="h-4 w-4" />
            Fill out digitally
          </button>
          <button
            type="button"
            onClick={() => { setMode("upload"); setError(""); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "upload" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload signed scan
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium mb-5">
            {error}
          </div>
        )}

        {mode === "upload" && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Signed Invoice</h2>
              </div>

              {uploadFile ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(uploadFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setUploadFile(null)}
                    className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 cursor-pointer transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Choose file or take photo</p>
                    <p className="text-xs text-slate-400">PDF, JPG, or PNG of the signed invoice</p>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {/* Company (vendor) — required */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="h-5 w-5 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  Company<span className="text-red-500 font-bold ml-1">*</span>
                </h2>
              </div>
              {companies.length > 0 ? (
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Select company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-400">
                  No companies added.{" "}
                  <Link href="/settings/companies" className="text-blue-600 font-bold">Add companies</Link>
                </p>
              )}
            </div>

            {/* Tech + install date */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">
                  Technician <span className="text-slate-400 font-normal">Optional</span>
                </label>
                {techs.length > 0 ? (
                  <select
                    value={techId}
                    onChange={(e) => setTechId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select technician...</option>
                    {techs.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-400">No techs added.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Install Date</label>
                <input
                  type="date"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={saving || !uploadFile || !companyId}
              className="w-full h-13 text-base font-bold rounded-xl"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload & Mark Complete
                </span>
              )}
            </Button>
          </>
        )}

        {mode === "digital" && (<>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <AirVent className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">AC Installed</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">AC Model</label>
              {models.length > 0 ? (
                <select
                  value={acModelId}
                  onChange={(e) => setAcModelId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Select model...</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brand} {m.model_number} — {m.btu.toLocaleString()} BTU ({m.ac_type})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-400">
                  No models added.{" "}
                  <Link href="/settings/ac-models" className="text-blue-600 font-bold">Add models</Link>
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Serial Number</label>
              <input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Enter serial number from the unit"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Sq. Ft. of Cooling Room</label>
              <input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="e.g. 200"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Company (vendor) — required for DOH, optional for HEAP */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">
              Company
              <span className="text-red-500 font-bold ml-1">*</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {isDoh
              ? "Vendor info will be filled into the DOH invoice and used to sort jobs by company."
              : "HEAP forms come pre-printed with the vendor — we still tag the job so you can sort by company."}
          </p>
          {companies.length > 0 ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-400">
              No companies added.{" "}
              <Link href="/settings/companies" className="text-blue-600 font-bold">Add companies</Link>
            </p>
          )}
        </div>

        {/* Technician */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Technician</h2>
          </div>
          {techs.length > 0 ? (
            <select
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select technician...</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.signature_path ? " ✓ sig" : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-400">
              No techs added.{" "}
              <Link href="/settings/team" className="text-blue-600 font-bold">Add technicians</Link>
            </p>
          )}
          {techId && !techs.find(t => t.id === techId)?.signature_path && (
            <p className="text-xs text-amber-600 font-bold mt-2">
              This tech has no signature saved. Add one in Settings → Team.
            </p>
          )}
        </div>

        {/* Photos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <Camera className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">
              Photos <span className="text-slate-400 font-normal text-xs ml-1">Optional</span>
            </h2>
          </div>

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {photos.map((photo, i) => (
                <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 cursor-pointer transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Camera className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Take photo or upload</p>
              <p className="text-xs text-slate-400">Photo of installed unit</p>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  setPhotos([...photos, ...Array.from(e.target.files)]);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <Button
          onClick={handleSaveDetails}
          className="w-full h-13 text-base font-bold rounded-xl"
        >
          Next — Customer Signature
        </Button>
        </>)}
      </div>
    );
  }

  // ─── Step 2: Signature ───
  if (step === "signature") {
    return (
      <div className="p-5 lg:p-8 max-w-xl mx-auto">
        <button
          onClick={() => setStep("details")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Customer Signature
          </h1>
        </div>
        <p className="text-slate-500 mb-6">
          Have the customer sign below to confirm the installation.
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium mb-5">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-1.5">Customer Name</label>
          <input
            value={signerName || String(customer.full_name || "")}
            onChange={(e) => setSignerName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sign Here</span>
            </div>
            <button
              onClick={() => customerSigRef.current?.clear()}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Clear
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <SignaturePad ref={customerSigRef} height={220} />
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            I confirm the services above were completed.
          </p>
        </div>

        <Button
          onClick={handleComplete}
          disabled={saving}
          className="w-full h-13 text-base font-bold rounded-xl"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Invoice...
            </span>
          ) : (
            "Complete & Generate Invoice"
          )}
        </Button>
      </div>
    );
  }

  // ─── Step 3: Generating ───
  if (step === "generating") {
    return (
      <div className="p-5 lg:p-8 max-w-xl mx-auto text-center py-20">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-lg font-bold text-slate-900">Generating signed invoice...</p>
        <p className="text-sm text-slate-500 mt-1">Populating fields and embedding signature.</p>
      </div>
    );
  }

  // ─── Step 4: Done ───
  return (
    <div className="p-5 lg:p-8 max-w-xl mx-auto text-center py-12">
      <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Invoice Complete</h1>
      <p className="text-slate-500 mb-8">
        The signed invoice has been generated and saved to this job.
      </p>

      <div className="space-y-3">
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-13 rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-colors"
          >
            <FileDown className="h-5 w-5" />
            Download Signed Invoice
          </a>
        )}
        <Link
          href={`/jobs/${id}`}
          className="flex items-center justify-center gap-2 w-full h-13 rounded-xl border-2 border-slate-200 text-slate-700 text-base font-bold hover:bg-slate-50 transition-colors"
        >
          Back to Job
        </Link>
        <Link
          href="/jobs"
          className="flex items-center justify-center gap-2 w-full h-13 rounded-xl text-slate-500 text-sm font-bold hover:text-slate-700 transition-colors"
        >
          All Jobs
        </Link>
      </div>
    </div>
  );
}
