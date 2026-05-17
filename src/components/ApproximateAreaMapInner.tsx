import { MapContainer, TileLayer, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";

function Recenter({ lat, lng, radiusM }: { lat: number; lng: number; radiusM: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(lat, lng).toBounds(radiusM * 2.4);
    map.fitBounds(bounds, { padding: [16, 16], animate: false });
  }, [lat, lng, radiusM, map]);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function ApproximateAreaMapInner({
  lat, lng, radiusM, height,
}: { lat: number; lng: number; radiusM: number; height: number }) {
  // Snap to ~0.01° (≈1.1 km) so the exact venue position cannot be derived
  // from the visible circle centre. Add a small deterministic jitter based
  // on the coordinates so the centre is not perfectly aligned to a grid.
  const center = useMemo<[number, number]>(() => {
    const snap = (v: number) => Math.round(v * 100) / 100;
    const jitter = (v: number) => {
      const s = Math.sin(v * 12.9898) * 43758.5453;
      return (s - Math.floor(s) - 0.5) * 0.004; // ±~220 m
    };
    return [snap(lat) + jitter(lat), snap(lng) + jitter(lng)];
  }, [lat, lng]);

  return (
    <div className="relative overflow-hidden rounded-2xl border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <Recenter lat={center[0]} lng={center[1]} radiusM={radiusM} />
        <Circle
          center={center}
          radius={radiusM}
          pathOptions={{ color: "hsl(var(--primary))", weight: 2, fillColor: "hsl(var(--primary))", fillOpacity: 0.15 }}
        />
      </MapContainer>
    </div>
  );
}