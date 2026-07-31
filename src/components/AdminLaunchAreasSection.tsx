import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LAUNCH_AREAS, LAUNCH_AREA_NOTICE } from "@/lib/launch-area";

type DbArea = {
  code: string;
  name: string;
  region: string;
  province: string;
  province_code: string;
  active: boolean;
  radius_km: number | null;
};
type DbComune = {
  area_code: string;
  comune: string;
  istat_code: string | null;
  active: boolean;
};
type Stats = Record<string, number>;

const STAT_LABELS: Record<string, string> = {
  profiles_in_area: "Profili in area",
  profiles_out_of_area: "Profili fuori area",
  profiles_missing_city: "Profili senza comune",
  announcements_in_area: "Annunci in area",
  announcements_out_of_area: "Annunci fuori area",
  announcements_missing_coords: "Annunci senza coordinate",
  job_requests_out_of_area: "Richieste turno fuori area",
  availability_out_of_area: "Disponibilità fuori area",
  availability_exceptions_out_of_area: "Disponibilità speciali fuori area",
};

/**
 * Sezione del pannello admin: legge le aree operative DIRETTAMENTE dal
 * database (`launch_areas` / `launch_area_comuni`), che è la sorgente di
 * verità applicata dai trigger. `@/lib/launch-area` resta solo un fallback
 * di rendering. Mostra inoltre le statistiche dei record fuori area.
 */
export function AdminLaunchAreasSection() {
  const areasQuery = useQuery({
    queryKey: ["admin", "launch-areas"],
    queryFn: async () => {
      const [areas, comuni] = await Promise.all([
        supabase.from("launch_areas").select("*").order("name"),
        supabase.from("launch_area_comuni").select("*").order("comune"),
      ]);
      if (areas.error) throw areas.error;
      if (comuni.error) throw comuni.error;
      return {
        areas: (areas.data ?? []) as unknown as DbArea[],
        comuni: (comuni.data ?? []) as unknown as DbComune[],
      };
    },
  });

  const statsQuery = useQuery({
    queryKey: ["admin", "launch-area-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_launch_area_stats" as never);
      if (error) throw error;
      return (data ?? {}) as Stats;
    },
  });

  const dbAreas = areasQuery.data?.areas ?? [];
  const areas: DbArea[] =
    dbAreas.length > 0
      ? dbAreas
      : LAUNCH_AREAS.map((a) => ({
          code: a.code,
          name: a.name,
          region: a.region,
          province: a.province,
          province_code: a.province_code,
          active: a.active,
          radius_km: a.radius_km,
        }));
  const comuniFor = (code: string): DbComune[] => {
    const fromDb = (areasQuery.data?.comuni ?? []).filter((c) => c.area_code === code);
    if (fromDb.length > 0) return fromDb;
    const fallback = LAUNCH_AREAS.find((a) => a.code === code);
    return (fallback?.comuni ?? []).map((c) => ({
      area_code: code,
      comune: c.name,
      istat_code: null,
      active: true,
    }));
  };
  const stats = statsQuery.data;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Aree operative</h2>
            <p className="mt-1 text-sm text-muted-foreground">{LAUNCH_AREA_NOTICE}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Configurazione letta dal database e applicata automaticamente a
              registrazioni, annunci, richieste di turno, disponibilità e ricerche.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Copertura dati</h3>
        {statsQuery.isLoading && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Calcolo in corso…
          </p>
        )}
        {statsQuery.isError && (
          <p className="mt-2 text-sm text-muted-foreground">
            Statistiche non disponibili.
          </p>
        )}
        {stats && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(STAT_LABELS).map(([key, label]) => {
              const value = Number(stats[key] ?? 0);
              const isProblem = key.includes("out_of_area") && value > 0;
              return (
                <div
                  key={key}
                  className={`rounded-xl border px-3 py-2 ${
                    isProblem ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"
                  }`}
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              );
            })}
          </div>
        )}
        {stats && Object.entries(stats).some(([k, v]) => k.includes("out_of_area") && Number(v) > 0) && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <span>
              I record fuori area sono conservati ma esclusi da ricerche e mappa, e non
              possono essere ripubblicati finché la località non rientra in un'area attiva.
            </span>
          </p>
        )}
      </div>

      {areas.map((area) => (
        <div key={area.code} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {area.name} — {area.province} ({area.province_code})
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
            {comuniFor(area.code).length} comuni abilitati
            {area.radius_km ? ` · raggio ${area.radius_km} km` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {comuniFor(area.code).map((c) => (
              <span
                key={c.comune}
                title={c.istat_code ? `ISTAT ${c.istat_code}` : undefined}
                className={`rounded-md border px-2 py-0.5 text-xs ${
                  c.active
                    ? "bg-muted/40 text-foreground"
                    : "border-dashed text-muted-foreground line-through"
                }`}
              >
                {c.comune}
              </span>
            ))}
          </div>
        </div>
      ))}

      {!areasQuery.isLoading && areas.filter((a) => a.active).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessuna area attiva: la piattaforma è aperta su tutto il territorio.
        </p>
      )}
    </div>
  );
}
