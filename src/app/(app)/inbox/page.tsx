"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchJobs } from "@/lib/api";
import { Phone, MapPin, ChevronRight, InboxIcon } from "lucide-react";

export default function InboxPage() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs", "inbox"],
    queryFn: () => fetchJobs(["new", "contact_attempted"]),
  });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Jobs awaiting contact ({jobs?.length ?? 0})
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-20">
          <InboxIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Inbox is empty.</p>
          <p className="text-xs text-muted-foreground mt-1">
            New jobs will appear here when they need to be contacted.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job: Record<string, unknown>) => {
            const customer = job.customer as Record<string, unknown> | null;
            const program = job.program as Record<string, unknown> | null;
            const isNew = job.status === "new";
            return (
              <Link
                key={job.id as string}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
              >
                <div
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isNew ? "bg-blue-500" : "bg-amber-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground truncate">
                      {(customer?.full_name as string) || "No Name"}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        (program?.code as string) === "HEAP"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {program?.code as string}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {customer?.phone_primary ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {String(customer.phone_primary)}
                      </span>
                    ) : null}
                    {customer?.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {String(customer.city)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
