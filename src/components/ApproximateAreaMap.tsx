import { lazy, Suspense } from "react";

const Inner = lazy(() => import("./ApproximateAreaMapInner"));

/**
 * Map preview that intentionally hides the exact venue position. Used for
 * workers before a shift is assigned: shows a coarse circle covering the
 * area but no pin, no precise centre and no address. See public-location.ts.
 */
export function ApproximateAreaMap({
  lat,
  lng,
  radiusM = 1200,
  height = 200,
}: {
  lat: number | null;
  lng: number | null;
  radiusM?: number;
  height?: number;
}) {
  if (typeof window === "undefined" || lat == null || lng == null) {
    return <div style={{ height }} className="rounded-2xl bg-muted animate-pulse" />;
  }
  return (
    <Suspense fallback={<div style={{ height }} className="rounded-2xl bg-muted animate-pulse" />}>
      <Inner lat={lat} lng={lng} radiusM={radiusM} height={height} />
    </Suspense>
  );
}