import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Star } from "lucide-react";
import { useEffect, useRef } from "react";
import { UserAvatar } from "@/components/UserAvatar";

export type WorkerMapPoint = {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  role: string | null;
  city: string | null;
  rating: number | null;
  badge: string | null;
  avatarUrl: string | null;
  initials: string;
  link?: string;
  known?: boolean;
  completedShifts?: number | null;
  reliabilityPct?: number | null;
  punctualityPct?: number | null;
  professionalismAvg?: number | null;
  lastReviewComment?: string | null;
  lastReviewRating?: number | null;
};

function avatarIcon(p: WorkerMapPoint) {
  const size = 44;
  const fallback = (p.initials || (p.name ? p.name.slice(0, 2) : "?")).toUpperCase().slice(0, 2);
  const borderColor = p.known ? "#10b981" : "#FF2EA8";
  const inner = `
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#fff;border:3px solid ${borderColor};
      box-shadow:0 4px 12px rgba(0,0,0,.35);
      overflow:hidden;display:flex;align-items:center;justify-content:center;
      font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:14px;color:#111;
    ">
      ${
        p.avatarUrl
          ? `<img src="${p.avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.parentNode.innerHTML='<span>${fallback}</span>';" />`
          : `<span>${fallback}</span>`
      }
    </div>
    ${
      p.rating != null
        ? `<div style="
            position:absolute;bottom:-4px;right:-4px;
            background:#111;color:#fff;border:2px solid #fff;
            border-radius:9999px;padding:1px 5px;font-size:10px;font-weight:700;
            font-family:Inter,system-ui,sans-serif;line-height:1.2;
            display:flex;align-items:center;gap:2px;
          ">★ ${Number(p.rating).toFixed(1)}</div>`
        : ""
    }
    ${
      p.known
        ? `<div style="
            position:absolute;top:-10px;left:50%;transform:translateX(-50%);
            background:#10b981;color:#fff;border:1px solid #fff;
            border-radius:9999px;padding:1px 6px;font-size:9px;font-weight:700;
            font-family:Inter,system-ui,sans-serif;line-height:1.2;white-space:nowrap;
            box-shadow:0 2px 4px rgba(0,0,0,.2);
          ">✓ Già collaborato</div>`
        : ""
    }
  `;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function WorkersMapInner({
  points,
  height,
  center,
  onInvite,
  inviteLabel,
  inviteDisabled,
  focusId,
  focusNonce,
  onViewProfile,
  onOpenChat,
}: {
  points: WorkerMapPoint[];
  height: number;
  center: [number, number];
  onInvite?: (workerId: string) => void;
  inviteLabel?: string;
  inviteDisabled?: boolean;
  focusId?: string | null;
  focusNonce?: number;
  onViewProfile?: (workerId: string) => void;
  onOpenChat?: (workerId: string) => void;
}) {
  const zoom = points.length > 0 ? 11 : 6;
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FocusController
          points={points}
          focusId={focusId ?? null}
          focusNonce={focusNonce ?? 0}
          markerRefs={markerRefs}
        />
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={avatarIcon(p)}
            ref={(ref) => {
              markerRefs.current[p.id] = ref;
            }}
          >
            <Popup>
              <div style={{ minWidth: 200, fontFamily: "Inter, system-ui, sans-serif" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <UserAvatar userId={p.id} name={p.name} className="h-11 w-11 flex-shrink-0" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{p.name ?? "Lavoratore"}</div>
                    {p.role && (
                      <div style={{ fontSize: 12, color: "#555", textTransform: "capitalize" }}>{p.role}</div>
                    )}
                  </div>
                </div>
                {p.city && (
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>📍 {p.city}</div>
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  {p.rating != null && (
                    <span style={{ fontSize: 12, color: "#111", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Star size={12} fill="#facc15" color="#facc15" /> {Number(p.rating).toFixed(1)}
                    </span>
                  )}
                  {p.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        fontWeight: 600,
                        background: "rgba(255,46,168,0.12)",
                        color: "#c0288a",
                        padding: "2px 6px",
                        borderRadius: 9999,
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {onInvite && (
                    <button
                      type="button"
                      onClick={() => onInvite(p.id)}
                      disabled={inviteDisabled}
                      style={{
                        flex: 1,
                        background: inviteDisabled ? "#9ca3af" : "#111",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: inviteDisabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {inviteLabel ?? "Messaggia"}
                    </button>
                  )}
                  {(onViewProfile || p.link) && (
                    onViewProfile ? (
                      <button
                        type="button"
                        onClick={() => onViewProfile(p.id)}
                        style={{
                          flex: 1,
                          background: "#fff",
                          color: "#111",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          textAlign: "center",
                          cursor: "pointer",
                        }}
                      >
                        Vedi profilo
                      </button>
                    ) : (
                      <a
                        href={p.link!}
                        style={{
                          flex: 1,
                          background: "#fff",
                          color: "#111",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          textAlign: "center",
                          textDecoration: "none",
                        }}
                      >
                        Vedi profilo
                      </a>
                    )
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function FocusController({
  points,
  focusId,
  focusNonce,
  markerRefs,
}: {
  points: WorkerMapPoint[];
  focusId: string | null;
  focusNonce: number;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusId) return;
    const p = points.find((x) => x.id === focusId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    const t = setTimeout(() => {
      const m = markerRefs.current[focusId];
      if (m) m.openPopup();
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusNonce]);
  return null;
}