"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Phone, Navigation, Clock, Route } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false });

interface Stop {
  jobId: string;
  customerName: string;
  address: string;
  city: string;
  phone: string;
  acType: string;
  coords: { lat: number; lng: number } | null;
  order: number;
}

function RoutePlannerContent() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || "";
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [savedStart, setSavedStart] = useState("");
  const [savedEnd, setSavedEnd] = useState("");
  const [saving, setSaving] = useState(false);

  // Load saved addresses
  const { data: savedAddresses } = useQuery({
    queryKey: ["route-addresses"],
    queryFn: async () => {
      const res = await fetch("/api/settings/route-addresses");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Pre-fill from saved
  useEffect(() => {
    if (savedAddresses && !startAddress && !endAddress) {
      if (savedAddresses.route_start_address) {
        setStartAddress(savedAddresses.route_start_address);
        setSavedStart(savedAddresses.route_start_address);
      }
      if (savedAddresses.route_end_address) {
        setEndAddress(savedAddresses.route_end_address);
        setSavedEnd(savedAddresses.route_end_address);
      }
    }
  }, [savedAddresses]);

  async function saveAddresses() {
    setSaving(true);
    await fetch("/api/settings/route-addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_start_address: startAddress, route_end_address: endAddress }),
    });
    setSavedStart(startAddress);
    setSavedEnd(endAddress);
    setSaving(false);
  }

  const addressesChanged = startAddress !== savedStart || endAddress !== savedEnd;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["route", date, startAddress, endAddress],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (startAddress) params.set("start", startAddress);
      if (endAddress) params.set("end", endAddress);
      const res = await fetch(`/api/route?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!date && submitted,
  });

  const stops: Stop[] = data?.stops || [];
  const route = data?.route || null;
  const startCoord = data?.startCoord || null;
  const endCoord = data?.endCoord || null;
  const unresolved: { customerName: string; address: string }[] = data?.unresolved || [];

  const dateLabel = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  function handlePlan() {
    setSubmitted(true);
    refetch();
  }

  return (
    <div className="p-5 lg:p-8 h-full flex flex-col">
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Calendar
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Route Planner</h1>
        {date && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700">
            {dateLabel}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Optimized driving route for the day&apos;s installs.
      </p>

      {/* Addresses */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">Start Location</label>
            <input
              value={startAddress}
              onChange={(e) => { setStartAddress(e.target.value); setSubmitted(false); }}
              placeholder="e.g. 480 Austin Place, Bronx, NY"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">End Location <span className="text-slate-400 font-normal">Optional</span></label>
            <input
              value={endAddress}
              onChange={(e) => { setEndAddress(e.target.value); setSubmitted(false); }}
              placeholder="Returns to start if empty"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Empty = roundtrip back to start. Use this for an end that&apos;s different (e.g. supplier pickup).
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={handlePlan}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
            Plan Route
          </button>
          {addressesChanged && (
            <button
              onClick={saveAddresses}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              {saving ? "Saving..." : "Save Addresses"}
            </button>
          )}
          {!addressesChanged && savedStart && (
            <span className="text-xs text-slate-400 font-medium">Addresses saved</span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Geocoding addresses & optimizing route...</p>
          <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
        </div>
      )}

      {!isLoading && submitted && (startAddress && !startCoord) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 font-medium mb-4">
          Couldn&apos;t geocode the start address &mdash; route planned without it. Try including the city and zip
          (e.g. &ldquo;480 Austin Place, Bronx, NY 10455&rdquo;).
        </div>
      )}

      {!isLoading && submitted && (endAddress && !endCoord) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 font-medium mb-4">
          Couldn&apos;t geocode the end address &mdash; route planned without it.
        </div>
      )}

      {!isLoading && submitted && unresolved.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4">
          <p className="text-sm font-bold text-amber-800 mb-1">
            {unresolved.length} address{unresolved.length === 1 ? "" : "es"} couldn&apos;t be geocoded:
          </p>
          <ul className="text-xs text-amber-700 list-disc pl-5">
            {unresolved.map((u, i) => (
              <li key={i}>{u.customerName} &mdash; {u.address}</li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-700 mt-1.5">
            Open the customer record and check the address/zip is filled in correctly.
          </p>
        </div>
      )}

      {!isLoading && submitted && stops.length > 0 && (
        <div className="flex gap-5 flex-1 flex-col lg:flex-row min-h-0">
          {/* Map */}
          <div className="flex-1 rounded-2xl border border-slate-200 overflow-hidden min-h-[400px]">
            <RouteMap stops={stops.filter(s => s.coords) as (Stop & { coords: { lat: number; lng: number } })[]} route={route} startCoord={startCoord} endCoord={endCoord} />
          </div>

          {/* Stop list */}
          <div className="w-full lg:w-80 shrink-0">
            {/* Route summary */}
            {route && (
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Navigation className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-blue-900">{route.totalDistance} miles</p>
                    <p className="text-xs text-blue-700">
                      <Clock className="h-3 w-3 inline mr-1" />
                      ~{route.totalDuration} min driving
                    </p>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-sm font-bold text-slate-900 mb-3">
              {stops.length} Stop{stops.length !== 1 ? "s" : ""}
            </h2>

            <div className="space-y-2 overflow-y-auto max-h-[500px]">
              {stops.map((stop) => (
                <Link
                  key={stop.jobId}
                  href={`/jobs/${stop.jobId}`}
                  className="block p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        stop.order <= 3 ? "bg-emerald-600" : stop.order <= 6 ? "bg-amber-600" : "bg-red-600"
                      }`}
                    >
                      {stop.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{stop.customerName}</p>
                      <div className="text-[11px] text-slate-500 space-y-0.5 mt-0.5">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{stop.address}, {stop.city}</span>
                        </div>
                        {stop.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5 shrink-0" />
                            {stop.phone}
                          </div>
                        )}
                        {stop.acType && (
                          <span className="text-[10px] font-bold text-slate-400 capitalize">{stop.acType} AC</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && submitted && stops.length === 0 && (
        <div className="text-center py-16">
          <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No scheduled jobs for this date.</p>
        </div>
      )}
    </div>
  );
}

export default function RoutePlannerPage() {
  return (
    <Suspense fallback={<div className="p-5"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
      <RoutePlannerContent />
    </Suspense>
  );
}
