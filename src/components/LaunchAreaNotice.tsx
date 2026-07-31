import { MapPin } from "lucide-react";
import { LAUNCH_AREA_NOTICE, LAUNCH_AREA_RESTRICTED } from "@/lib/launch-area";

/**
 * Comunicazione territoriale mostrata ovunque si scelga una località
 * (onboarding, annunci, disponibilità, ricerche). Testo e visibilità
 * derivano dalla configurazione in `@/lib/launch-area`.
 */
export function LaunchAreaNotice({ className = "" }: { className?: string }) {
  if (!LAUNCH_AREA_RESTRICTED) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground ${className}`}
    >
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>{LAUNCH_AREA_NOTICE}</span>
    </p>
  );
}
