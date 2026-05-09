import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

const makeIcon = (selected: boolean) => {
  const c = selected ? "#D8FF36" : "#8B5CF6"; // lime when selected, violet otherwise
  const size = selected ? 26 : 18;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:${selected ? -8 : -4}px;border-radius:50%;background:${c};opacity:${selected ? 0.45 : 0.25};filter:blur(${selected ? 10 : 5}px);"></div>
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:2px solid #07060B;box-shadow:0 0 0 ${selected ? 3 : 2}px ${c}66, 0 4px 10px rgba(0,0,0,.55);"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
};

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

export type MapMarker = { id: string; lat: number; lng: number; address?: string };

export default function AnnouncementMapInner({ lat, lng, address, height, markers, selectedId, onSelect }: { lat: number; lng: number; address?: string; height: number; markers?: MapMarker[]; selectedId?: string; onSelect?: (id: string) => void }) {
  const list: MapMarker[] = markers && markers.length > 0 ? markers : [{ id: "_", lat, lng, address }];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <Recenter lat={lat} lng={lng} />
        {list.map((m) => {
          const isSel = selectedId ? m.id === selectedId : m.lat === lat && m.lng === lng;
          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={makeIcon(isSel)}
              eventHandlers={onSelect ? { click: () => onSelect(m.id) } : undefined}
              zIndexOffset={isSel ? 1000 : 0}
            >
              {m.address && <Popup>{m.address}</Popup>}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}