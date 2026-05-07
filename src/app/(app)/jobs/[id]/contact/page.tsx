"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, MessageSquare, Voicemail, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const OUTCOMES = [
  { value: "reached", label: "Reached", color: "bg-emerald-100 text-emerald-700" },
  { value: "no_answer", label: "No Answer", color: "bg-amber-100 text-amber-700" },
  { value: "left_voicemail", label: "Left Voicemail", color: "bg-blue-100 text-blue-700" },
  { value: "callback_requested", label: "Callback Requested", color: "bg-purple-100 text-purple-700" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-700" },
];

const CHANNELS = [
  { value: "call", label: "Call", icon: Phone },
  { value: "text", label: "Text", icon: MessageSquare },
  { value: "voicemail", label: "Voicemail", icon: Voicemail },
];

export default function ContactLogPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/contact-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: id,
          channel,
          direction: "outbound",
          outcome,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to log contact");
      return res.json();
    },
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setOutcome("");
      setNotes("");
    },
  });

  const customer = (job?.customer as Record<string, unknown>) || {};
  const contactLog = ((job?.contact_log as Record<string, unknown>[]) || []).sort(
    (a, b) => new Date(b.contacted_at as string).getTime() - new Date(a.contacted_at as string).getTime()
  );

  if (isLoading) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto">
      <Link
        href={`/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {String(customer.full_name || "Job")}
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">
        Contact Log
      </h1>

      {/* Log new contact */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Log a Contact Attempt</h2>

        {/* Channel */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-2">Channel</label>
          <div className="flex gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch.value}
                onClick={() => setChannel(ch.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  channel === ch.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <ch.icon className="h-4 w-4" />
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Outcome */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-2">Outcome</label>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => setOutcome(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  outcome === o.value
                    ? "ring-2 ring-blue-500 " + o.color
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            placeholder="Any notes about this contact attempt..."
          />
        </div>

        <Button
          onClick={() => logMutation.mutate()}
          disabled={saving || !outcome}
          className="w-full h-11 text-sm font-bold rounded-xl"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Log Contact"
          )}
        </Button>
      </div>

      {/* Contact history */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          History ({contactLog.length})
        </h2>
        {contactLog.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No contact attempts logged yet.</p>
        ) : (
          <div className="space-y-2">
            {contactLog.map((entry) => {
              const outcomeInfo = OUTCOMES.find((o) => o.value === entry.outcome) || {
                label: String(entry.outcome),
                color: "bg-slate-100 text-slate-600",
              };
              return (
                <div
                  key={entry.id as string}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${outcomeInfo.color}`}>
                        {outcomeInfo.label}
                      </span>
                      <span className="text-xs text-slate-400 font-medium capitalize">
                        {String(entry.channel)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.contacted_at as string).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {entry.notes ? (
                    <p className="text-sm text-slate-600 mt-1">{String(entry.notes)}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
