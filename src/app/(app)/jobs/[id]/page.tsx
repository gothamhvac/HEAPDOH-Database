"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJob, updateJob } from "@/lib/api";
import { extractApartment } from "@/lib/address-utils";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Mail,
  User,
  Loader2,
  FileText,
  Clock,
  Pencil,
  Check,
  X,
  Calendar,
  PhoneOff,
  PhoneCall,
  MessageSquare,
  Wrench,
  CheckCircle2,
  XCircle,
  FileDown,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  contact_attempted: { label: "Contact Attempted", color: "bg-amber-100 text-amber-700" },
  contacted: { label: "Contacted", color: "bg-purple-100 text-purple-700" },
  scheduled: { label: "Scheduled", color: "bg-cyan-100 text-cyan-700" },
  installed: { label: "Installed", color: "bg-orange-100 text-orange-700" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
  submitted: { label: "Submitted", color: "bg-slate-100 text-slate-600" },
  on_hold: { label: "On Hold", color: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600" },
};

const CONTACT_OUTCOMES = [
  { value: "reached", label: "Reached", color: "bg-emerald-100 text-emerald-700" },
  { value: "no_answer", label: "No Answer", color: "bg-amber-100 text-amber-700" },
  { value: "left_voicemail", label: "Voicemail", color: "bg-blue-100 text-blue-700" },
  { value: "callback_requested", label: "Callback", color: "bg-purple-100 text-purple-700" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-700" },
];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: job, isLoading, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });

  // Derive state before hooks
  const customer = (job?.customer as Record<string, unknown> | null) ?? null;
  const program = (job?.program as Record<string, unknown> | null) ?? null;
  const attachments = ((job?.attachments as Record<string, unknown>[]) ?? []);
  const contactLog = ((job?.contact_log as Record<string, unknown>[]) ?? []).sort(
    (a, b) => new Date(b.contacted_at as string).getTime() - new Date(a.contacted_at as string).getTime()
  );
  const systems = ((job?.systems as Record<string, unknown>[]) ?? []);
  const invoiceAttachment = attachments.find((a) => a.kind === "invoice_original");
  const ocrStatus = invoiceAttachment ? String(invoiceAttachment.ocr_status || "") : "";
  const isOcrProcessing = ocrStatus === "pending" || ocrStatus === "processing";

  useEffect(() => {
    if (!isOcrProcessing) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
    }, 3000);
    return () => clearInterval(interval);
  }, [isOcrProcessing, id, queryClient]);

  // Contact log state
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactOutcome, setContactOutcome] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [contactChannel, setContactChannel] = useState("call");
  const [savingContact, setSavingContact] = useState(false);


  // Cancel state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [savingCancel, setSavingCancel] = useState(false);
  const [cancelDownloadUrl, setCancelDownloadUrl] = useState("");

  if (isLoading) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto text-center py-20">
        <p className="text-slate-400 font-medium">Job not found.</p>
        <Link href="/jobs" className="text-blue-600 text-sm font-bold hover:underline mt-3 inline-block">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[job.status as string] || { label: job.status, color: "bg-slate-100 text-slate-600" };
  const isPendingOcr = String(customer?.full_name || "") === "Pending OCR";
  const isHeap = (program?.code as string) === "HEAP";
  const hasInvoice = !!invoiceAttachment;
  const customerName = isPendingOcr ? null : String(customer?.full_name || "");

  async function logContact() {
    if (!contactOutcome) return;
    setSavingContact(true);
    try {
      await fetch("/api/contact-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: id,
          channel: contactChannel,
          direction: "outbound",
          outcome: contactOutcome,
          notes: contactNotes || null,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setContactOutcome("");
      setContactNotes("");
      setShowContactForm(false);
    } finally {
      setSavingContact(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    setSavingCancel(true);
    try {
      // Update job status to cancelled with reason
      await updateJob(id, { status: "cancelled", hold_reason: cancelReason });

      // Generate cancelled invoice with the reason populated
      const res = await fetch("/api/pdf/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: id, reason: cancelReason }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl) setCancelDownloadUrl(data.downloadUrl);
      }

      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowCancelForm(false);
    } finally {
      setSavingCancel(false);
    }
  }


  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Jobs
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {customerName || "New HEAP Job"}
        </h1>
        <div className="flex items-center gap-2.5 mt-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isHeap ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
            {program?.code as string}
          </span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {job.invoice_number ? (
            <span className="text-xs text-slate-400 font-medium">#{String(job.invoice_number)}</span>
          ) : null}
        </div>
      </div>

      {/* OCR banners */}
      {isHeap && hasInvoice && isOcrProcessing && (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 mb-5">
          <div className="flex items-start gap-4">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-blue-900">Extracting data from invoice...</p>
              <p className="text-sm text-blue-700 mt-1">Reading customer details. This takes a few seconds.</p>
            </div>
          </div>
        </div>
      )}

      {/* Customer card */}
      <CustomerCard
        customer={customer}
        isPendingOcr={isPendingOcr}
        jobId={id}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["job", id] });
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }}
      />

      {/* ─── COMPLETED STATE ─── */}
      {(job.status === "completed" || job.status === "submitted") && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="font-bold text-emerald-900">Job Completed</p>
          </div>
          <div className="flex gap-3">
            {(() => {
              const signedInvoice = attachments.find((a) => a.kind === "invoice_signed");
              if (signedInvoice) {
                return (
                  <a
                    href={`/api/pdf/download?path=${encodeURIComponent(String(signedInvoice.storage_path))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
                  >
                    <FileDown className="h-4 w-4" />
                    View Invoice
                  </a>
                );
              }
              return null;
            })()}
            <Link
              href={`/jobs/${id}/complete`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit & Regenerate
            </Link>
          </div>
        </div>
      )}

      {/* ─── ACTION BUTTONS (only for non-completed jobs) ─── */}
      {job.status !== "completed" && job.status !== "submitted" && job.status !== "cancelled" && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Contact */}
          <button
            onClick={() => setShowContactForm(!showContactForm)}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
              showContactForm ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <PhoneCall className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Log Contact</p>
              <p className="text-xs text-slate-500">{contactLog.length} logged</p>
            </div>
          </button>

          {/* Schedule */}
          <Link
            href={`/jobs/${id}/schedule`}
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-cyan-300 transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Schedule</p>
              <p className="text-xs text-slate-500">
                {job.scheduled_at
                  ? new Date(job.scheduled_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "Not set"}
              </p>
            </div>
          </Link>

          {/* Complete — signature + invoice */}
          <Link
            href={`/jobs/${id}/complete`}
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-300 transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Complete</p>
              <p className="text-xs text-slate-500">Sign & generate invoice</p>
            </div>
          </Link>

          {/* Cancel */}
          <button
            onClick={() => setShowCancelForm(!showCancelForm)}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
              showCancelForm ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-red-300"
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Cancel Job</p>
              <p className="text-xs text-slate-500">Not completed with reason</p>
            </div>
          </button>
        </div>
      )}

      {/* ─── CANCEL FORM ─── */}
      {showCancelForm && job.status !== "cancelled" && (
        <div className="rounded-2xl border-2 border-red-200 bg-white p-5 mb-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Cancel Job</h2>
          <p className="text-xs text-slate-500 mb-3">This will mark the job as cancelled and generate the invoice with the "Work could not be completed" checkbox and your reason.</p>

          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 block mb-2">Reason</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              placeholder="e.g. Customer non-responsive, unable to schedule..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowCancelForm(false)} variant="outline" className="flex-1 rounded-xl font-bold">
              Back
            </Button>
            <button
              onClick={handleCancel}
              disabled={savingCancel || !cancelReason.trim()}
              className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {savingCancel ? "Generating..." : "Cancel & Generate Invoice"}
            </button>
          </div>
        </div>
      )}

      {/* Cancel download */}
      {cancelDownloadUrl && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-5">
          <a
            href={cancelDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 hover:underline"
          >
            <FileDown className="h-4 w-4" />
            Download Cancelled Invoice
          </a>
        </div>
      )}

      {/* ─── CONTACT FORM (inline) ─── */}
      {showContactForm && (
        <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 mb-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Log Contact Attempt</h2>

          {/* Channel */}
          <div className="flex gap-2 mb-4">
            {[
              { value: "call", label: "Call", icon: Phone },
              { value: "text", label: "Text", icon: MessageSquare },
            ].map((ch) => (
              <button
                key={ch.value}
                onClick={() => setContactChannel(ch.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  contactChannel === ch.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <ch.icon className="h-4 w-4" />
                {ch.label}
              </button>
            ))}
          </div>

          {/* Outcome */}
          <div className="flex flex-wrap gap-2 mb-4">
            {CONTACT_OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => setContactOutcome(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  contactOutcome === o.value ? "ring-2 ring-blue-500 " + o.color : "bg-slate-100 text-slate-500"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Notes */}
          <textarea
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none mb-3"
            placeholder="Notes about this contact..."
          />

          <div className="flex gap-2">
            <Button
              onClick={() => setShowContactForm(false)}
              variant="outline"
              className="flex-1 rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={logContact}
              disabled={savingContact || !contactOutcome}
              className="flex-1 rounded-xl font-bold"
            >
              {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* ─── SYSTEM DETAILS ─── */}
      {systems.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            AC Details
          </h2>
          {systems.map((sys, i) => (
            <div key={i} className="space-y-1 text-sm">
              {sys.ac_type ? (
                <p><span className="font-bold text-slate-700">Type:</span> <span className="text-slate-600 capitalize">{String(sys.ac_type)}</span></p>
              ) : null}
              {sys.make ? (
                <p><span className="font-bold text-slate-700">Model:</span> <span className="text-slate-600">{String(sys.make)} {String(sys.model || "")}</span></p>
              ) : null}
              {sys.btu_input ? (
                <p><span className="font-bold text-slate-700">BTU:</span> <span className="text-slate-600">{Number(sys.btu_input).toLocaleString()}</span></p>
              ) : null}
              {sys.install_location ? (
                <p><span className="font-bold text-slate-700">Room:</span> <span className="text-slate-600 capitalize">{String(sys.install_location).replace(/_/g, " ")}</span></p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* ─── CONTACT LOG HISTORY ─── */}
      {contactLog.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Contact History ({contactLog.length})
          </h2>
          <div className="space-y-2">
            {contactLog.map((entry) => {
              const outcomeInfo = CONTACT_OUTCOMES.find((o) => o.value === entry.outcome) || {
                label: String(entry.outcome), color: "bg-slate-100 text-slate-600",
              };
              return (
                <div key={entry.id as string} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className={`mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
                    entry.outcome === "reached" ? "bg-emerald-100" :
                    entry.outcome === "no_answer" ? "bg-amber-100" :
                    entry.outcome === "declined" ? "bg-red-100" : "bg-slate-100"
                  }`}>
                    {entry.outcome === "reached" ? <PhoneCall className="h-3 w-3 text-emerald-600" /> :
                     entry.outcome === "no_answer" ? <PhoneOff className="h-3 w-3 text-amber-600" /> :
                     <Phone className="h-3 w-3 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${outcomeInfo.color}`}>
                        {outcomeInfo.label}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">{String(entry.channel)}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(entry.contacted_at as string).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {entry.notes ? <p className="text-xs text-slate-600 mt-1">{String(entry.notes)}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-slate-400 font-medium space-y-1">
        <p>Created {new Date(job.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        {job.scheduled_at ? <p>Scheduled {new Date(job.scheduled_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p> : null}
        {job.installed_at ? <p>Installed {new Date(job.installed_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p> : null}
      </div>
    </div>
  );
}

// ─── Customer Card ───
function CustomerCard({
  customer,
  isPendingOcr,
  jobId,
  onSaved,
}: {
  customer: Record<string, unknown> | null;
  isPendingOcr: boolean;
  jobId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(isPendingOcr);
  const [saving, setSaving] = useState(false);

  // When opening the edit form, if line2 is empty but line1 looks like it has
  // an apartment baked in, auto-split so the user sees clean fields.
  const initial = (() => {
    const line1Raw = String(customer?.address_line1 || "");
    const line2Raw = String(customer?.address_line2 || "");
    if (line1Raw && !line2Raw) {
      const { street, unit } = extractApartment(line1Raw);
      if (unit) return { line1: street, line2: unit };
    }
    return { line1: line1Raw, line2: line2Raw };
  })();

  const [form, setForm] = useState({
    full_name: isPendingOcr ? "" : String(customer?.full_name || ""),
    address_line1: initial.line1,
    address_line2: initial.line2,
    city: String(customer?.city || ""),
    state: String(customer?.state || ""),
    zip: String(customer?.zip || ""),
    phone_primary: String(customer?.phone_primary || ""),
    email: String(customer?.email || ""),
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveCustomer() {
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${String(customer?.id || "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setEditing(false); onSaved(); }
    } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
            {isPendingOcr ? "Enter Customer Details" : "Edit Customer"}
          </h2>
          {!isPendingOcr && (
            <button onClick={() => setEditing(false)} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
        <div className="space-y-3">
          <input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Full name *" autoFocus
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <input value={form.address_line1} onChange={(e) => updateField("address_line1", e.target.value)} placeholder="Street address"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <input value={form.address_line2} onChange={(e) => updateField("address_line2", e.target.value)} placeholder="Apt / Unit / Floor (optional)"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <div className="grid grid-cols-5 gap-2">
            <input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="City" className="col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            <input value={form.state} onChange={(e) => updateField("state", e.target.value)} placeholder="NY" maxLength={2} className="col-span-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            <input value={form.zip} onChange={(e) => updateField("zip", e.target.value)} placeholder="ZIP" className="col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <input value={form.phone_primary} onChange={(e) => updateField("phone_primary", e.target.value)} placeholder="Phone" type="tel"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <input value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="Email" type="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <Button onClick={saveCustomer} disabled={saving || !form.full_name.trim()} className="w-full h-11 rounded-xl font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" />Save</>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</h2>
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700">
          <Pencil className="h-3 w-3" />Edit
        </button>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-start gap-3"><User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /><span className="text-sm font-medium text-slate-800">{String(customer?.full_name || "—")}</span></div>
        {customer?.address_line1 ? <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /><div className="text-sm font-medium text-slate-800"><div>{String(customer.address_line1)}{customer.address_line2 ? <span className="text-slate-500"> &middot; {String(customer.address_line2)}</span> : null}</div><div className="text-xs text-slate-500 font-normal">{customer.city ? `${String(customer.city)}` : ""}{customer.state ? `, ${String(customer.state)}` : ""}{customer.zip ? ` ${String(customer.zip)}` : ""}</div></div></div> : null}
        {customer?.phone_primary ? <div className="flex items-start gap-3"><Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /><a href={`tel:${String(customer.phone_primary)}`} className="text-sm font-medium text-blue-600 hover:underline">{String(customer.phone_primary)}</a></div> : null}
        {customer?.email ? <div className="flex items-start gap-3"><Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /><a href={`mailto:${String(customer.email)}`} className="text-sm font-medium text-blue-600 hover:underline">{String(customer.email)}</a></div> : null}
      </div>
    </div>
  );
}
