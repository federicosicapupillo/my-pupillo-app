import { lazy, Suspense } from "react";
import type { WorkerMapPoint } from "./WorkersMapInner";

export type { WorkerMapPoint } from "./WorkersMapInner";

const Inner = lazy(() => import("./WorkersMapInner"));

export function WorkersMap(props: {
  points: WorkerMapPoint[];
  height?: number;
  center: [number, number];
  onInvite?: (workerId: string) => void;
  inviteLabel?: string;
  inviteDisabled?: boolean;
  focusId?: string | null;
  focusNonce?: number;
  onViewProfile?: (workerId: string) => void;
  onOpenChat?: (workerId: string) => void;
}) {
  const height = props.height ?? 480;
  if (typeof window === "undefined") {
    return <div style={{ height }} className="rounded-2xl bg-muted animate-pulse" />;
  }
  return (
    <Suspense fallback={<div style={{ height }} className="rounded-2xl bg-muted animate-pulse" />}>
      <Inner {...props} height={height} />
    </Suspense>
  );
}