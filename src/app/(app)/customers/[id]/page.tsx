"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Briefcase, DollarSign, Calendar } from "lucide-react";
import { PdfPreview } from "@/components/PdfPreview";

interface Attachment {
  id: string;
  kind: string;
  storage_path: string;
  original_filename: string | null;
  created_at: string;
}

interface Job {
  id: string;
  status: string;
  invoice_number: string | null;
  scheduled_at: string | null;
  installed_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  check_amount: number | null;
  program: { code: string; name: string } | null;
  company: { id: string; name: string } | null;
  attachments: Attachment[];
  systems: { make: string; model: string; btu_input: number; ac_type: string }[];
}

interface Customer {
  id: string;
  full_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email: string | null;
  jobs: Job[];
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contact_attempted: "Attempted",
  contacted: "Contacted",
  scheduled: "Scheduled",
  installed: "Installed",
  completed: "Completed",
  submitted: "Submitted",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery<{ customer: Customer }>({
    queryKey: ["customer", id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error("Failed to load customer");
      return res.json();
    },
  });

  const customer = data?.customer;

  if (isLoading) {
    return (
      <div className="p-5 lg:p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-5 lg:p-8 max-w-3xl mx-auto text-center py-20">
        <p className="text-slate-400 font-medium">Customer not found.</p>
        <Link href="/customers" className="text-blue-600 text-sm font-bold hover:underline mt-3 inline-block">
          Back to Customers
        </Link>
      </div>
    );
  }

  const jobs = (customer.jobs || []).slice().sort((a, b) => {
    const da = a.scheduled_at || a.completed_at || "";
    const db = b.scheduled_at || b.completed_at || "";
    return db.localeCompare(da);
  });

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Customers
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{customer.full_name}</h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} on file
        </p>
      </div>

      {/* Contact info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5 space-y-2 text-sm">
        {(customer.address_line1 || customer.city) && (
          <div className="flex items-start gap-2 text-slate-700">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
            <span>
              {[customer.address_line1, customer.address_line2, customer.city, customer.state, customer.zip]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
        {customer.phone_primary && (
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
            <a href={`tel:${customer.phone_primary}`} className="hover:text-blue-600">
              {customer.phone_primary}
            </a>
            {customer.phone_secondary && (
              <span className="text-slate-400">· {customer.phone_secondary}</span>
            )}
          </div>
        )}
        {customer.email && (
          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
            <a href={`mailto:${customer.email}`} className="hover:text-blue-600">
              {customer.email}
            </a>
          </div>
        )}
      </div>

      {/* Jobs */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-slate-200 bg-white">
          <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No jobs yet for this customer.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {jobs.map((job) => {
            const original = (job.attachments || []).find((a) => a.kind === "invoice_original");
            const signed = (job.attachments || []).find((a) => a.kind === "invoice_signed");
            const sys = job.systems?.[0];
            const dateLabel = job.completed_at || job.scheduled_at || null;
            return (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Link href={`/jobs/${job.id}`} className="text-sm font-bold text-slate-900 hover:text-blue-600">
                      {job.invoice_number ? `#${job.invoice_number}` : "Job"}
                    </Link>
                    {job.program?.code && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        job.program.code === "HEAP" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {job.program.code}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                    {job.paid_at && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                        <DollarSign className="h-3 w-3" />
                        {job.check_amount != null ? `$${Number(job.check_amount).toFixed(2)}` : "Paid"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {dateLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(dateLabel).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {sys?.make || sys?.model ? (
                      <span>{[sys.make, sys.model].filter(Boolean).join(" ")}{sys.btu_input ? ` · ${sys.btu_input.toLocaleString()} BTU` : ""}</span>
                    ) : null}
                    {job.company?.name && <span>{job.company.name}</span>}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {original?.storage_path ? (
                    <PdfPreview
                      path={String(original.storage_path)}
                      label="Original uploaded invoice"
                      height={460}
                    />
                  ) : (
                    <p className="text-xs text-slate-400">No uploaded invoice for this job.</p>
                  )}
                  {signed?.storage_path && (
                    <PdfPreview
                      path={String(signed.storage_path)}
                      label="Signed / completed invoice"
                      height={460}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
