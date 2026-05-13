import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";

const workerIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:22px;height:22px;">
    <div style="position:absolute;inset:-6px;border-radius:50%;background:#22c55e;opacity:.35;filter:blur(6px);"></div>
    <div style="position:relative;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#22c55e;border:2px solid #ffffff;box-shadow:0 0 0 2px #22c55e66, 0 4px 10px rgba(0,0,0,.35);"></div>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function Recenter({ lat, lng, radiusM }: { lat: number; lng: number; radiusM: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(lat, lng).toBounds(radiusM * 2.4);
    map.fitBounds(bounds, { padding: [16, 16], animate: true });
  }, [lat, lng, radiusM, map]);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function WorkerServiceAreaMapInner({
  lat, lng, radiusM, height,
}: { lat: number; lng: number; radiusM: number; height: number }) {
  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);
  return (
    <div className="relative overflow-hidden rounded-2xl border" style={{ height }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <Recenter lat={lat} lng={lng} radiusM={radiusM} />
        <Circle
          center={center}
          radius={radiusM}
          pathOptions={{ color: "#22c55e", weight: 2, fillColor: "#22c55e", fillOpacity: 0.12 }}
        />
        <Marker position={center} icon={workerIcon} />
      </MapContainer>
      {/* Radar pulse overlay (purely decorative, ignores pointer events). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="block h-6 w-6 rounded-full bg-emerald-500/30 animate-ping" />
      </div>
    </div>
  );
}
