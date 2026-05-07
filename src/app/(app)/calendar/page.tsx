"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  X,
  Download,
  Route,
  MapPin,
  Phone,
  AirVent,
  Wrench,
  Package,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Job {
  id: string;
  status: string;
  scheduled_at: string;
  customer: {
    id: string;
    full_name: string;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
    phone_primary: string;
  };
  program: { code: string };
  systems: {
    ac_type: string;
    make: string;
    model: string;
    btu_input: number;
    install_location: string;
    ac_model: { brand: string; model_number: string; ac_type: string; btu: number } | null;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#0891b2",
  installed: "#ea580c",
  completed: "#16a34a",
  new: "#2563eb",
  contact_attempted: "#d97706",
  contacted: "#7c3aed",
};

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calRange, setCalRange] = useState({ start: "", end: "" });

  const { data: jobsData } = useQuery({
    queryKey: ["calendar-jobs", calRange.start, calRange.end],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (calRange.start) params.set("start", calRange.start);
      if (calRange.end) params.set("end", calRange.end);
      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.jobs || [];
    },
    enabled: !!calRange.start,
  });

  const jobs: Job[] = jobsData || [];

  // FullCalendar events
  const events = jobs.map((job) => ({
    id: job.id,
    title: job.customer?.full_name || "No Name",
    start: job.scheduled_at,
    backgroundColor: STATUS_COLORS[job.status] || "#64748b",
    borderColor: STATUS_COLORS[job.status] || "#64748b",
    extendedProps: { job },
  }));

  // Jobs for selected date
  const dayJobs = useMemo(() => {
    if (!selectedDate) return [];
    return jobs.filter((j) => {
      const jobDate = new Date(j.scheduled_at).toISOString().split("T")[0];
      return jobDate === selectedDate;
    });
  }, [selectedDate, jobs]);

  // Inventory summary for the day
  const inventory = useMemo(() => {
    const items: { type: string; count: number; models: string[]; needsBracket: boolean }[] = [];
    const typeMap = new Map<string, { count: number; models: Set<string>; needsBracket: boolean }>();

    for (const job of dayJobs) {
      for (const sys of job.systems || []) {
        const acType = sys.ac_type || "unknown";
        const modelName = sys.make && sys.model
          ? `${sys.make} ${sys.model}`
          : sys.ac_model
          ? `${sys.ac_model.brand} ${sys.ac_model.model_number}`
          : "Unspecified";
        const btu = sys.btu_input || sys.ac_model?.btu || 0;
        const key = `${acType}-${modelName}-${btu}`;

        if (!typeMap.has(key)) {
          typeMap.set(key, { count: 0, models: new Set(), needsBracket: acType === "window" });
        }
        const entry = typeMap.get(key)!;
        entry.count++;
        entry.models.add(`${modelName}${btu ? ` (${btu.toLocaleString()} BTU)` : ""}`);
      }
    }

    typeMap.forEach((val, key) => {
      items.push({
        type: key.split("-")[0],
        count: val.count,
        models: Array.from(val.models),
        needsBracket: val.needsBracket,
      });
    });

    return items;
  }, [dayJobs]);

  // City breakdown
  const cityBreakdown = useMemo(() => {
    const cities = new Map<string, Job[]>();
    for (const job of dayJobs) {
      const city = job.customer?.city || "Unknown";
      if (!cities.has(city)) cities.set(city, []);
      cities.get(city)!.push(job);
    }
    return Array.from(cities.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [dayJobs]);

  // Export day plan
  function exportDayPlan() {
    if (!selectedDate || dayJobs.length === 0) return;

    const dateStr = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    let text = `INSTALL PLAN — ${dateStr}\n`;
    text += `${"=".repeat(60)}\n\n`;
    text += `Total Jobs: ${dayJobs.length}\n\n`;

    // Inventory
    text += `INVENTORY NEEDED\n${"-".repeat(40)}\n`;
    for (const item of inventory) {
      text += `  ${item.count}x ${item.type.toUpperCase()}`;
      if (item.models[0] !== "Unspecified") text += ` — ${item.models.join(", ")}`;
      text += `\n`;
      if (item.needsBracket) {
        text += `  ${item.count}x WINDOW BRACKET (required)\n`;
      }
    }
    if (inventory.length === 0) text += `  No AC details specified yet\n`;

    // City breakdown
    text += `\nBY CITY\n${"-".repeat(40)}\n`;
    for (const [city, cityJobs] of cityBreakdown) {
      text += `  ${city}: ${cityJobs.length} job${cityJobs.length > 1 ? "s" : ""}\n`;
    }

    // Job details
    text += `\nJOB DETAILS\n${"-".repeat(40)}\n`;
    for (let i = 0; i < dayJobs.length; i++) {
      const job = dayJobs[i];
      const sys = job.systems?.[0];
      text += `\n${i + 1}. ${job.customer?.full_name || "No Name"}\n`;
      text += `   Address: ${job.customer?.address_line1 || "—"}, ${job.customer?.city || ""} ${job.customer?.state || ""} ${job.customer?.zip || ""}\n`;
      text += `   Phone: ${job.customer?.phone_primary || "—"}\n`;
      if (sys) {
        const modelStr = sys.make ? `${sys.make} ${sys.model || ""}` : sys.ac_model ? `${sys.ac_model.brand} ${sys.ac_model.model_number}` : "—";
        text += `   AC: ${(sys.ac_type || "—").toUpperCase()} — ${modelStr}`;
        if (sys.btu_input || sys.ac_model?.btu) text += ` (${(sys.btu_input || sys.ac_model?.btu || 0).toLocaleString()} BTU)`;
        text += `\n`;
        if (sys.install_location) text += `   Room: ${sys.install_location.replace(/_/g, " ")}\n`;
        if (sys.ac_type === "window") text += `   ** NEEDS BRACKET **\n`;
      }
      text += `   Program: ${job.program?.code || "—"}\n`;
    }

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `install-plan-${selectedDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Calendar</h1>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            eventClick={(info) => {
              const job = info.event.extendedProps.job as Job;
              setSelectedDate(new Date(job.scheduled_at).toISOString().split("T")[0]);
            }}
            datesSet={(info) => {
              setCalRange({
                start: info.startStr,
                end: info.endStr,
              });
            }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            height="auto"
            dayMaxEvents={3}
            eventDisplay="block"
            eventClassNames="rounded-md text-xs font-bold px-1.5 py-0.5 cursor-pointer"
          />
        </div>

        {/* Day panel */}
        {selectedDate && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h2>
                <div className="flex items-center gap-2">
                  {dayJobs.length > 0 && (
                    <>
                      <Link
                        href={`/calendar/route-planner?date=${selectedDate}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                      >
                        <Route className="h-3.5 w-3.5" />
                        Route
                      </Link>
                      <a
                        href={`/api/calendar/export?date=${selectedDate}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Invoices
                      </a>
                      <button
                        onClick={exportDayPlan}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-600 text-white text-xs font-bold hover:bg-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Plan
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              </div>

              {dayJobs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No installs scheduled.</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-700 mb-3">
                    {dayJobs.length} install{dayJobs.length !== 1 ? "s" : ""}
                  </p>

                  {/* Inventory needed */}
                  {inventory.length > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Inventory Needed</span>
                      </div>
                      {inventory.map((item, i) => (
                        <div key={i} className="text-sm text-amber-900 mb-1">
                          <span className="font-bold">{item.count}x</span>{" "}
                          <span className="capitalize">{item.type}</span>
                          {item.models[0] !== "Unspecified" && (
                            <span className="text-amber-700"> — {item.models[0]}</span>
                          )}
                          {item.needsBracket && (
                            <div className="text-xs text-amber-700 ml-5 font-bold">
                              + {item.count}x bracket
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* City breakdown */}
                  {cityBreakdown.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {cityBreakdown.map(([city, cityJobs]) => (
                        <span key={city} className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                          {city}: {cityJobs.length}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Job list */}
                  <div className="space-y-2">
                    {dayJobs.map((job) => {
                      const sys = job.systems?.[0];
                      return (
                        <Link
                          key={job.id}
                          href={`/jobs/${job.id}`}
                          className="block p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-900">
                              {job.customer?.full_name || "No Name"}
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                          </div>
                          <div className="space-y-0.5 text-xs text-slate-500">
                            {job.customer?.address_line1 && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {job.customer.address_line1}, {job.customer.city}
                              </div>
                            )}
                            {job.customer?.phone_primary && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                {job.customer.phone_primary}
                              </div>
                            )}
                            {sys && (
                              <div className="flex items-center gap-1">
                                <AirVent className="h-3 w-3 shrink-0" />
                                <span className="capitalize">{sys.ac_type || "AC"}</span>
                                {sys.btu_input ? ` — ${sys.btu_input.toLocaleString()} BTU` : ""}
                                {sys.install_location ? ` — ${sys.install_location.replace(/_/g, " ")}` : ""}
                                {sys.ac_type === "window" && (
                                  <span className="text-amber-600 font-bold ml-1">+bracket</span>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
