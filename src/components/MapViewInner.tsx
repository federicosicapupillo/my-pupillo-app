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
  meta?: {
    secondaryRoles?: string[];
    rating?: number | null;
    reliability?: number | null;
    completedShifts?: number | null;
    hourlyRate?: number | null;
    availability?: string[];
    badge?: string | null;
    distanceKm?: number | null;
    contactName?: string | null;
    contactRole?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    coordSource?: "job" | "location" | "profile" | "service_area";
  };
};

// Pupillo neon palette
const COLORS: Record<MapCategory, string> = {
  restaurant: "#FF2EA8",   // magenta
  worker: "#D8FF36",       // lime
  announcement: "#22E0CF", // cyan
};

const makeIcon = (category: MapCategory) => {
  const c = COLORS[category];
  if (category === "worker") {
    return L.divIcon({
      className: "",
      html: `<div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:${c};opacity:.25;filter:blur(6px);"></div>
        <div style="position:relative;width:22px;height:22px;border-radius:50%;background:${c};border:2px solid #07060B;box-shadow:0 0 0 2px ${c}66, 0 4px 10px rgba(0,0,0,.5);"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;inset:-6px;border-radius:50%;background:${c};opacity:.3;filter:blur(8px);"></div>
      <div style="position:relative;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:2px solid #07060B;box-shadow:0 0 0 2px ${c}55, 0 4px 12px rgba(0,0,0,.6);"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
};

export default function MapViewInner({ points, height, center, me, radiusKm }: { points: MapPoint[]; height: number; center: [number, number]; me?: { lat: number; lng: number } | null; radiusKm?: number | null }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.7)]" style={{ height }}>
      <MapContainer center={center} zoom={6} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
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
                {p.meta && (
                  <div style={{ fontSize: 12, color: "#444", marginTop: 4, lineHeight: 1.5 }}>
                    {p.meta.secondaryRoles && p.meta.secondaryRoles.length > 0 && (
                      <div>Anche: {p.meta.secondaryRoles.join(", ")}</div>
                    )}
                    {p.meta.rating != null && <div>⭐ {Number(p.meta.rating).toFixed(1)}</div>}
                    {p.meta.reliability != null && <div>Affidabilità: {p.meta.reliability}%</div>}
                    {p.meta.completedShifts != null && <div>Turni: {p.meta.completedShifts}</div>}
                    {p.meta.hourlyRate != null && <div>Tariffa: € {Number(p.meta.hourlyRate).toFixed(0)}/h</div>}
                    {p.meta.availability && p.meta.availability.length > 0 && (
                      <div>Disponibile: {p.meta.availability.join(", ")}</div>
                    )}
                    {p.meta.distanceKm != null && (
                      <div>📍 {p.meta.distanceKm < 1 ? `${Math.round(p.meta.distanceKm * 1000)} m` : `${p.meta.distanceKm.toFixed(1)} km`} da te</div>
                    )}
                    {p.meta.contactName && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Referente:</strong> {p.meta.contactName}
                        {p.meta.contactRole ? ` (${p.meta.contactRole})` : ""}
                      </div>
                    )}
                    {p.meta.contactPhone && (
                      <div>📞 <a href={`tel:${p.meta.contactPhone}`} style={{ color: COLORS[p.category] }}>{p.meta.contactPhone}</a></div>
                    )}
                    {p.meta.contactEmail && (
                      <div>✉️ <a href={`mailto:${p.meta.contactEmail}`} style={{ color: COLORS[p.category] }}>{p.meta.contactEmail}</a></div>
                    )}
                    {p.meta.coordSource && (
                      <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 10, color: "#7c3aed" }}>
                        🛠 coord: {p.meta.coordSource}
                      </div>
                    )}
                  </div>
                )}
                {p.status && <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>Stato: {p.status}</div>}
                {p.link && (
                  <a href={p.link} style={{ color: COLORS[p.category], fontSize: 12, marginTop: 6, display: "inline-block" }}>
                    {p.category === "worker" ? "Vedi profilo →" : "Apri dettaglio →"}
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