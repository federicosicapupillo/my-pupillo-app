import { lazy, Suspense } from "react";

export type MapMarker = { id: string; lat: number; lng: number; address?: string };

const MapInner = lazy(() => import("./AnnouncementMapInner"));

export function AnnouncementMap({ lat, lng, address, height = 160, markers, selectedId, onSelect }: { lat: number; lng: number; address?: string; height?: number; markers?: MapMarker[]; selectedId?: string; onSelect?: (id: string) => void }) {
  if (typeof window === "undefined") {
    return <div style={{ height }} className="rounded-xl bg-muted animate-pulse" />;
  }
  return (
    <Suspense fallback={<div style={{ height }} className="rounded-xl bg-muted animate-pulse" />}>
      <MapInner lat={lat} lng={lng} address={address} height={height} markers={markers} selectedId={selectedId} onSelect={onSelect} />
    </Suspense>
  );
}