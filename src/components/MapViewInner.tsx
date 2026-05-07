import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapCategory = "restaurant" | "worker" | "announcement";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  category: MapCategory;
  title: string;
  subtitle?: string;
  city?: string | null;
  status?: string | null;
  link?: string;
};

const COLORS: Record<MapCategory, string> = {
  restaurant: "#4f46e5", // indigo
  worker: "#22c55e",     // green
  announcement: "#06b6d4", // cyan
};

const makeIcon = (category: MapCategory) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${COLORS[category]};width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });

export default function MapViewInner({ points, height, center, me, radiusKm }: { points: MapPoint[]; height: number; center: [number, number]; me?: { lat: number; lng: number } | null; radiusKm?: number | null }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ height }}>
      <MapContainer center={center} zoom={6} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {me && (
          <>
            <CircleMarker
              center={[me.lat, me.lng]}
              radius={7}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
            >
              <Popup>La tua posizione</Popup>
            </CircleMarker>
            {radiusKm && radiusKm > 0 && (
              <Circle
                center={[me.lat, me.lng]}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#2563eb", weight: 2, fillColor: "#2563eb", fillOpacity: 0.08 }}
              />
            )}
          </>
        )}
        {points.map((p) => (
          <Marker key={`${p.category}-${p.id}`} position={[p.lat, p.lng]} icon={makeIcon(p.category)}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                {p.subtitle && <div style={{ fontSize: 12, color: "#555" }}>{p.subtitle}</div>}
                {p.city && <div style={{ fontSize: 12, color: "#555" }}>{p.city}</div>}
                {p.status && <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>Stato: {p.status}</div>}
                {p.link && (
                  <a href={p.link} style={{ color: COLORS[p.category], fontSize: 12, marginTop: 6, display: "inline-block" }}>
                    Apri dettaglio →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}