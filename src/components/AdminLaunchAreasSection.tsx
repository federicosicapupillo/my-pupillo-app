import { MapPin } from "lucide-react";
import { ACTIVE_LAUNCH_AREAS, LAUNCH_AREAS, LAUNCH_AREA_NOTICE } from "@/lib/launch-area";

/**
 * Sezione read-only del pannello admin: mostra le aree operative attive e i
 * comuni abilitati. La configurazione vive in `@/lib/launch-area` (frontend) e
 * nelle tabelle `launch_areas` / `launch_area_comuni` (backend).
 */
export function AdminLaunchAreasSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Aree operative</h2>
            <p className="mt-1 text-sm text-muted-foreground">{LAUNCH_AREA_NOTICE}</p>
          </div>
        </div>
      </div>

      {LAUNCH_AREAS.map((area) => (
        <div key={area.id} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {area.label} — {area.province} ({area.province_code})
            </h3>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                area.active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {area.active ? "Attiva" : "Non attiva"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {area.comuni.length} comuni abilitati
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {area.comuni.map((c) => (
              <span
                key={c.name}
                className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-foreground"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      ))}

      {ACTIVE_LAUNCH_AREAS.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessuna area attiva: la piattaforma è aperta su tutto il territorio.
        </p>
      )}
    </div>
  );
}
