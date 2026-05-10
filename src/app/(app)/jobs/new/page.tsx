"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobCreateSchema, type JobCreateFormData } from "@/lib/validators/job";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Upload,
  FileText,
  Camera,
  X,
  File,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";

type Step = "program" | "heap_upload" | "doh_form";

interface InvoiceFile {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  jobId?: string;
  customerName?: string;
  error?: string;
}

export default function NewJobPage() {
  const [step, setStep] = useState<Step>("program");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invoiceFiles, setInvoiceFiles] = useState<InvoiceFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobCreateFormData>({
    resolver: zodResolver(jobCreateSchema),
    defaultValues: {
      program: "DOH",
      customer: { full_name: "" },
    },
  });

  function addFiles(files: FileList | File[]) {
    const newFiles: InvoiceFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      status: "pending" as const,
    }));
    setInvoiceFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setInvoiceFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  // Process all HEAP invoices — create job + upload + OCR for each
  async function submitAllHeapInvoices() {
    if (invoiceFiles.length === 0) return;
    setError("");
    setSubmitting(true);
    setProcessedCount(0);

    const updatedFiles = [...invoiceFiles];

    for (let i = 0; i < updatedFiles.length; i++) {
      const inv = updatedFiles[i];
      if (inv.status === "done") {
        setProcessedCount((c) => c + 1);
        continue;
      }

      // Mark as processing
      updatedFiles[i] = { ...inv, status: "processing" };
      setInvoiceFiles([...updatedFiles]);

      try {
        // Create job
        const jobRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ program_code: "HEAP" }),
        });
        if (!jobRes.ok) {
          const body = await jobRes.json();
          throw new Error(body.error || "Failed to create job");
        }
        const { job } = await jobRes.json();

        // Upload invoice
        const formData = new FormData();
        formData.append("file", inv.file);
        formData.append("job_id", job.id);
        formData.append("program_code", "HEAP");

        const uploadRes = await fetch("/api/jobs/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json();
          throw new Error(body.error || "Failed to upload");
        }

        // Run OCR in the browser, then post the extracted fields to the
        // server. Serverless tesseract.js doesn't survive Vercel's bundler.
        let customerName = "Pending";
        try {
          const { ocrInvoiceInBrowser } = await import("@/lib/ocr/browser");
          const ocrResult = await ocrInvoiceInBrowser(inv.file);

          await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: job.id,
              customerData: ocrResult.customerData,
              raw_text: ocrResult.rawText,
            }),
          });

          customerName = ocrResult.customerData.full_name || "Extracted";
        } catch (ocrErr) {
          // OCR failed — still mark the attachment so the UI doesn't sit
          // on "Pending" forever, but let the user enter details manually.
          await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: job.id,
              error: ocrErr instanceof Error ? ocrErr.message : "OCR failed",
            }),
          });
          customerName = "Pending";
        }

        updatedFiles[i] = {
          ...inv,
          status: "done",
          jobId: job.id,
          customerName,
        };
      } catch (err: unknown) {
        updatedFiles[i] = {
          ...inv,
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        };
      }

      setInvoiceFiles([...updatedFiles]);
      setProcessedCount((c) => c + 1);
    }

    setSubmitting(false);
  }

  const allDone = invoiceFiles.length > 0 && invoiceFiles.every((f) => f.status === "done" || f.status === "error");
  const doneCount = invoiceFiles.filter((f) => f.status === "done").length;
  const errorCount = invoiceFiles.filter((f) => f.status === "error").length;

  // DOH: Manual entry
  async function submitDohJob(formData: JobCreateFormData) {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_code: "DOH",
          customer: formData.customer,
          invoice_number: formData.invoice_number,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create job");
      }

      const { job } = await res.json();
      router.push(`/jobs/${job.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // ─── STEP 1: Pick Program ───
  if (step === "program") {
    return (
      <div className="p-5 lg:p-8 max-w-xl mx-auto">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          New Job
        </h1>
        <p className="text-slate-500 mt-1 mb-8">
          Select the program to get started.
        </p>

        <div className="grid gap-4">
          <button
            onClick={() => setStep("heap_upload")}
            className="flex items-start gap-5 p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-left group"
          >
            <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">HEAP</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Upload one or multiple invoices. The system extracts customer info automatically.
              </p>
            </div>
          </button>

          <button
            onClick={() => setStep("doh_form")}
            className="flex items-start gap-5 p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/5 transition-all text-left group"
          >
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
              <FileText className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">DOH — Manual entry</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Enter customer info manually. The system fills in the DOH invoice as data is added.
              </p>
            </div>
          </button>

          <Link
            href="/running-sheets"
            className="flex items-start gap-5 p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/5 transition-all text-left group"
          >
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
              <Upload className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">DOH — Upload running sheet</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Drop in the Vendor Assignment Notice PDF. We parse the table and create skeleton jobs in bulk.
              </p>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ─── STEP 2a: HEAP — Batch Upload ───
  if (step === "heap_upload") {
    return (
      <div className="p-5 lg:p-8 max-w-xl mx-auto">
        <button
          onClick={() => {
            setStep("program");
            setInvoiceFiles([]);
            setProcessedCount(0);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Upload HEAP Invoices
          </h1>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            HEAP
          </span>
        </div>
        <p className="text-slate-500 mb-6">
          Upload one or more invoices. Each one becomes a separate job with customer data extracted automatically.
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-5 font-medium">
            {error}
          </div>
        )}

        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed bg-white cursor-pointer transition-all mb-5 ${
            dragOver
              ? "border-blue-400 bg-blue-50/50 shadow-lg shadow-blue-500/5"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Camera className="h-6 w-6 text-blue-600" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Upload className="h-6 w-6 text-slate-500" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-900">
              {invoiceFiles.length > 0 ? "Add more invoices" : "Upload invoices"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              PDF or images — select multiple files at once
            </p>
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            capture="environment"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        {/* File list */}
        {invoiceFiles.length > 0 && (
          <div className="space-y-2 mb-5">
            {invoiceFiles.map((inv) => (
              <div
                key={inv.id}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  inv.status === "done"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : inv.status === "error"
                    ? "border-red-200 bg-red-50/50"
                    : inv.status === "processing"
                    ? "border-blue-200 bg-blue-50/50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {inv.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : inv.status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : inv.status === "processing" ? (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  ) : (
                    <File className="h-5 w-5 text-slate-400" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {inv.status === "done" && inv.customerName
                      ? inv.customerName
                      : inv.file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {inv.status === "done"
                      ? "Job created"
                      : inv.status === "error"
                      ? inv.error || "Failed"
                      : inv.status === "processing"
                      ? "Extracting..."
                      : `${(inv.file.size / 1024).toFixed(0)} KB`}
                  </p>
                </div>

                {/* Actions */}
                {inv.status === "done" && inv.jobId ? (
                  <Link
                    href={`/jobs/${inv.jobId}`}
                    className="text-xs font-bold text-blue-600 hover:underline shrink-0"
                  >
                    View
                  </Link>
                ) : inv.status === "pending" ? (
                  <button
                    onClick={() => removeFile(inv.id)}
                    className="h-7 w-7 rounded-lg hover:bg-red-100 flex items-center justify-center shrink-0"
                  >
                    <X className="h-4 w-4 text-slate-400 hover:text-red-500" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Summary after processing */}
        {allDone && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
            <p className="text-sm font-bold text-emerald-800">
              {doneCount} job{doneCount !== 1 ? "s" : ""} created
              {errorCount > 0 ? `, ${errorCount} failed` : ""}
            </p>
            <div className="flex gap-3 mt-3">
              <Link
                href="/jobs"
                className="text-sm font-bold text-emerald-700 hover:underline"
              >
                View all jobs
              </Link>
              <button
                onClick={() => {
                  setInvoiceFiles([]);
                  setProcessedCount(0);
                }}
                className="text-sm font-bold text-emerald-700 hover:underline"
              >
                Upload more
              </button>
            </div>
          </div>
        )}

        {/* Progress bar during processing */}
        {submitting && (
          <div className="mb-5">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>Processing invoices...</span>
              <span>{processedCount} / {invoiceFiles.length}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(processedCount / invoiceFiles.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!allDone && (
          <Button
            onClick={submitAllHeapInvoices}
            disabled={submitting || invoiceFiles.length === 0}
            className="w-full h-13 text-base font-bold rounded-xl"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing {processedCount + 1} of {invoiceFiles.length}...
              </span>
            ) : (
              `Upload ${invoiceFiles.length === 0 ? "" : invoiceFiles.length + " "}Invoice${invoiceFiles.length !== 1 ? "s" : ""}`
            )}
          </Button>
        )}
      </div>
    );
  }

  // ─── STEP 2b: DOH — Manual Entry ───
  return (
    <div className="p-5 lg:p-8 max-w-xl mx-auto">
      <button
        onClick={() => setStep("program")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          New DOH Job
        </h1>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
          DOH
        </span>
      </div>
      <p className="text-slate-500 mb-8">
        Enter whatever info you have. You can always add more later.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(submitDohJob)} className="space-y-5">
        <input type="hidden" {...register("program")} value="DOH" />

        <InputField
          label="Case / Application ID"
          optional
          id="invoice_number"
          placeholder="e.g. APP-12345"
          register={register("invoice_number")}
        />

        <div className="pt-2 pb-1">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Customer
          </h3>
        </div>

        <InputField
          label="Full Name"
          required
          id="full_name"
          placeholder="Customer full name"
          register={register("customer.full_name")}
          error={errors.customer?.full_name?.message}
        />

        <InputField
          label="Address"
          id="address"
          placeholder="Street address"
          register={register("customer.address_line1")}
        />

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2">
            <InputField
              label="City"
              id="city"
              placeholder="City"
              register={register("customer.city")}
            />
          </div>
          <div className="col-span-1">
            <InputField
              label="State"
              id="state"
              placeholder="NY"
              maxLength={2}
              register={register("customer.state")}
            />
          </div>
          <div className="col-span-2">
            <InputField
              label="ZIP"
              id="zip"
              placeholder="12345"
              inputMode="numeric"
              register={register("customer.zip")}
            />
          </div>
        </div>

        <InputField
          label="Phone"
          id="phone"
          type="tel"
          placeholder="(555) 123-4567"
          register={register("customer.phone_primary")}
        />

        <InputField
          label="Email"
          id="email"
          type="email"
          placeholder="customer@email.com"
          register={register("customer.email")}
        />

        <div className="pt-4">
          <Button
            type="submit"
            className="w-full h-13 text-base font-bold rounded-xl"
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Job"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function InputField({
  label,
  id,
  required,
  optional,
  error,
  register,
  ...props
}: {
  label: string;
  id: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  register: ReturnType<typeof import("react-hook-form").useForm>["register"] extends (...args: infer A) => infer R ? R : never;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 block mb-1.5" htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && (
          <span className="text-slate-400 font-normal ml-1.5 text-xs">Optional</span>
        )}
      </label>
      <input
        id={id}
        {...register}
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
      />
      {error && <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>}
    </div>
  );
}
