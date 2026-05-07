"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Stop {
  jobId: string;
  customerName: string;
  address: string;
  city: string;
  phone: string;
  acType: string;
  coords: { lat: number; lng: number };
  order: number;
}

interface RouteData {
  geometry: { type: string; coordinates: number[][] };
  totalDistance: number;
  totalDuration: number;
}

interface Props {
  stops: Stop[];
  route: RouteData | null;
  startCoord: { lat: number; lng: number } | null;
  endCoord?: { lat: number; lng: number } | null;
}

export default function RouteMap({ stops, route, startCoord, endCoord }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || stops.length === 0) return;

    // Clean up existing map
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    // Start marker
    if (startCoord) {
      const startIcon = L.divIcon({
        html: `<div style="background:#3b82f6;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">S</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: "",
      });
      L.marker([startCoord.lat, startCoord.lng], { icon: startIcon })
        .addTo(map)
        .bindPopup("<b>Start</b>");
      bounds.extend([startCoord.lat, startCoord.lng]);
    }

    // End marker
    if (endCoord) {
      const endIcon = L.divIcon({
        html: `<div style="background:#0f172a;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">E</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: "",
      });
      L.marker([endCoord.lat, endCoord.lng], { icon: endIcon })
        .addTo(map)
        .bindPopup("<b>End</b>");
      bounds.extend([endCoord.lat, endCoord.lng]);
    }

    // Stop markers with numbered pins
    stops.forEach((stop) => {
      if (!stop.coords) return;

      const color = stop.order <= 3 ? "#16a34a" : stop.order <= 6 ? "#d97706" : "#dc2626";
      const icon = L.divIcon({
        html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${stop.order}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: "",
      });

      L.marker([stop.coords.lat, stop.coords.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<b>#${stop.order} ${stop.customerName}</b><br>${stop.address}, ${stop.city}<br>${stop.phone}<br><span style="text-transform:capitalize">${stop.acType || "AC"}</span>`
        );

      bounds.extend([stop.coords.lat, stop.coords.lng]);
    });

    // Route line
    if (route?.geometry?.coordinates) {
      const coords = route.geometry.coordinates.map(
        (c: number[]) => [c[1], c[0]] as L.LatLngTuple
      );
      L.polyline(coords, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
    }

    map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [stops, route, startCoord, endCoord]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: "400px", borderRadius: "16px" }} />;
}
