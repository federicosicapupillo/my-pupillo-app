import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

const makeIcon = (selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"};width:${selected ? 24 : 16}px;height:${selected ? 24 : 16}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);${selected ? "outline:3px solid hsl(var(--primary)/0.25);outline-offset:2px;" : ""}"></div>`,
    iconSize: [selected ? 24 : 16, selected ? 24 : 16],
    iconAnchor: [selected ? 12 : 8, selected ? 24 : 16],
  });

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

export type MapMarker = { id: string; lat: number; lng: number; address?: string };

export default function AnnouncementMapInner({ lat, lng, address, height, markers, selectedId, onSelect }: { lat: number; lng: number; address?: string; height: number; markers?: MapMarker[]; selectedId?: string; onSelect?: (id: string) => void }) {
  const list: MapMarker[] = markers && markers.length > 0 ? markers : [{ id: "_", lat, lng, address }];
  return (
    <div className="overflow-hidden rounded-xl border" style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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