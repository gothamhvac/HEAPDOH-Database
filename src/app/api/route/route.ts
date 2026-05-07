import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { cleanStreetAddress } from "@/lib/address-utils";

interface Coordinate {
  lat: number;
  lng: number;
}

interface Stop {
  jobId: string;
  customerName: string;
  address: string;
  city: string;
  phone: string;
  acType: string;
  coords: Coordinate | null;
  order?: number;
}

const UA = "HEAP-DOH-JobManager/1.0";
const NOMINATIM_GAP_MS = 1100; // Nominatim is 1 req/sec.

async function nominatimQuery(query: string): Promise<Coordinate | null> {
  const q = query.trim().replace(/,\s*,/g, ",").replace(/^,\s*/, "");
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=us`;
    console.log("Geocoding:", q);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocode failed for:", q, e);
  }
  return null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Geocode a free-form address. Used for the start/end pins where the user
// types whatever they want.
async function geocodeFreeform(input: string): Promise<Coordinate | null> {
  if (!input.trim()) return null;
  return nominatimQuery(input);
}

// Geocode a structured customer address. Tries the full address first; if
// that fails (common for NYC neighborhoods like Bayside, Astoria, Riverdale
// where the "city" is a borough, not a place name Nominatim recognizes), it
// retries without the city and then with just zip+state. Only the first call
// is rate-limit-paid by the parent loop; retries pay their own delay.
async function geocodeStructured(
  address: string,
  city: string,
  state: string,
  zip: string,
): Promise<Coordinate | null> {
  const cleanAddr = cleanStreetAddress(address);
  const cleanCity = (city || "").trim();
  const cleanState = (state || "NY").trim();
  const cleanZip = (zip || "").trim();

  const candidates = [
    [cleanAddr, cleanCity, `${cleanState} ${cleanZip}`.trim()].filter(Boolean).join(", "),
    // Drop city — the zip + state is enough for NYC neighborhoods.
    cleanAddr && cleanZip ? `${cleanAddr}, ${cleanState} ${cleanZip}` : "",
    // Drop zip — for cases where zip is wrong but city is known.
    cleanAddr && cleanCity ? `${cleanAddr}, ${cleanCity}, ${cleanState}` : "",
  ].filter(Boolean);

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0) await sleep(NOMINATIM_GAP_MS); // pay rate limit on retries only
    const result = await nominatimQuery(candidates[i]);
    if (result) return result;
  }
  return null;
}

/**
 * Get optimized route from OSRM. With both start and end fixed, the trip
 * solver visits all middle stops in the optimal order between the two.
 */
async function optimizeRoute(
  coords: Coordinate[],
  hasStart: boolean,
  hasEnd: boolean,
): Promise<{
  orderedIndices: number[];
  geometry: string;
  totalDistance: number;
  totalDuration: number;
} | null> {
  if (coords.length < 2) return null;

  const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    roundtrip: "false",
  });
  if (hasStart) params.set("source", "first");
  if (hasEnd) params.set("destination", "last");

  try {
    const res = await fetch(
      `https://router.project-osrm.org/trip/v1/driving/${coordStr}?${params}`
    );
    const data = await res.json();
    if (data.code !== "Ok" || !data.trips?.[0]) return null;

    const trip = data.trips[0];
    const orderedIndices = (data.waypoints as { waypoint_index: number }[])
      .map((w, i) => ({ original: i, order: w.waypoint_index }))
      .sort((a, b) => a.order - b.order)
      .map((w) => w.original);

    return {
      orderedIndices,
      geometry: trip.geometry,
      totalDistance: Math.round(trip.distance / 1609.34 * 10) / 10,
      totalDuration: Math.round(trip.duration / 60),
    };
  } catch (e) {
    console.error("OSRM route optimization failed:", e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const startAddress = searchParams.get("start") || "";
    const endAddressRaw = searchParams.get("end") || "";
    // If no end is given, return to the start so the route loops home
    // (otherwise OSRM happily ends at the farthest stop).
    const endAddress = endAddressRaw || startAddress;

    if (!date) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    const dayStart = date + "T00:00:00Z";
    const dayEnd = date + "T23:59:59Z";

    const { data: jobs } = await admin
      .from("jobs")
      .select(`
        id, status, scheduled_at,
        customer:customers(full_name, address_line1, city, state, zip, phone_primary),
        systems:job_systems(ac_type)
      `)
      .eq("org_id", orgId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd)
      .not("status", "eq", "cancelled");

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ stops: [], route: null, unresolved: [] });
    }

    // Geocode start (free-form) — pace alongside customer addresses.
    let startCoord: Coordinate | null = null;
    if (startAddress) {
      startCoord = await geocodeFreeform(startAddress);
      await sleep(NOMINATIM_GAP_MS);
    }

    // Geocode each job address.
    const stops: Stop[] = [];
    const unresolved: { customerName: string; address: string }[] = [];

    for (const job of jobs) {
      const rawCustomer = job.customer;
      const c = (Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer) as Record<string, unknown> || {};
      const sys = ((job.systems as Record<string, unknown>[]) || [])[0] || {};

      const coords = await geocodeStructured(
        (c.address_line1 as string) || "",
        (c.city as string) || "",
        (c.state as string) || "NY",
        (c.zip as string) || "",
      );
      const stop: Stop = {
        jobId: job.id,
        customerName: (c.full_name as string) || "Unknown",
        address: (c.address_line1 as string) || "",
        city: (c.city as string) || "",
        phone: (c.phone_primary as string) || "",
        acType: (sys.ac_type as string) || "",
        coords,
      };
      stops.push(stop);
      if (!coords) {
        unresolved.push({ customerName: stop.customerName, address: `${stop.address}, ${stop.city}` });
      }
      await sleep(NOMINATIM_GAP_MS);
    }

    // Geocode end (free-form), if any. Reuse the start coord when they match
    // so we don't double-pay Nominatim's rate limit.
    let endCoord: Coordinate | null = null;
    if (endAddress) {
      endCoord = endAddress === startAddress ? startCoord : await geocodeFreeform(endAddress);
    }

    const validStops = stops.filter((s) => s.coords !== null);

    // Build coordinate array: [start?, ...stops, end?]
    const allCoords: Coordinate[] = [];
    if (startCoord) allCoords.push(startCoord);
    validStops.forEach((s) => allCoords.push(s.coords!));
    if (endCoord) allCoords.push(endCoord);

    let route = null;
    if (allCoords.length >= 2) {
      route = await optimizeRoute(allCoords, !!startCoord, !!endCoord);

      if (route) {
        // Strip start (index 0) and end (last index) from the ordered list,
        // map remaining indices back to validStops.
        const startOffset = startCoord ? 1 : 0;
        const endIndex = endCoord ? allCoords.length - 1 : -1;

        const orderedStops = route.orderedIndices
          .filter((i) => i >= startOffset && i !== endIndex)
          .map((i, order) => {
            const stop = validStops[i - startOffset];
            return { ...stop, order: order + 1 };
          });

        return NextResponse.json({
          stops: orderedStops,
          startCoord,
          endCoord,
          unresolved,
          route: {
            geometry: route.geometry,
            totalDistance: route.totalDistance,
            totalDuration: route.totalDuration,
          },
        });
      }
    }

    return NextResponse.json({
      stops: validStops.map((s, i) => ({ ...s, order: i + 1 })),
      startCoord,
      endCoord,
      unresolved,
      route: null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
