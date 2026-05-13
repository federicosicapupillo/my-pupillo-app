import { lazy, Suspense } from "react";

const Inner = lazy(() => import("./WorkerServiceAreaMapInner"));

export function WorkerServiceAreaMap({
  lat, lng, radiusM, height = 280,
}: { lat: number | null; lng: number | null; radiusM: number; height?: number }) {
  if (typeof window === "undefined" || lat == null || lng == null) {
    return (
      <div
        style={{ height }}
        className="rounded-2xl border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground"
      >
        Usa la posizione attuale o inserisci città e zona per vedere l'anteprima dell'area di copertura.
      </div>
    );
  }
  return (
    <Suspense fallback={<div style={{ height }} className="rounded-2xl bg-muted animate-pulse" />}>
      <Inner lat={lat} lng={lng} radiusM={radiusM} height={height} />
    </Suspense>
  );
}
