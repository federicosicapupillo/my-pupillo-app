import { lazy, Suspense } from "react";

const MapInner = lazy(() => import("./AnnouncementMapInner"));

export function AnnouncementMap({ lat, lng, address, height = 160 }: { lat: number; lng: number; address?: string; height?: number }) {
  if (typeof window === "undefined") {
    return <div style={{ height }} className="rounded-xl bg-muted animate-pulse" />;
  }
  return (
    <Suspense fallback={<div style={{ height }} className="rounded-xl bg-muted animate-pulse" />}>
      <MapInner lat={lat} lng={lng} address={address} height={height} />
    </Suspense>
  );
}