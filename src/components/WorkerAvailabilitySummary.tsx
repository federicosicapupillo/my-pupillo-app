import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Zap, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  DAY_LABELS,
  SLOT_LABELS,
  type AvailabilityRow,
  type AvailabilityExceptionRow,
} from "@/lib/availability";

type Props = {
  workerId: string;
  collapsible?: boolean;
  previewCount?: number;
};

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

function fmtDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return d;
  }
}

function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<T, number>();
  let best = arr[0];
  let bestCount = 0;
  for (const item of arr) {
    const count = (counts.get(item) ?? 0) + 1;
    counts.set(item, count);
    if (count > bestCount) {
      bestCount = count;
      best = item;
    }
  }
  return best;
}

export function WorkerAvailabilitySummary({
  workerId,
  collapsible = false,
  previewCount = 3,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRow[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!workerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const [rowsRes, excRes] = await Promise.all([
        supabase
          .from("worker_availability")
          .select("*")
          .eq("worker_id", workerId),
        supabase
          .from("worker_availability_exceptions")
          .select("*")
          .eq("worker_id", workerId)
          .gte("date", today)
          .order("date", { ascending: true }),
      ]);
      if (cancelled) return;
      if (rowsRes.error || excRes.error) {
        setError("Impossibile caricare le disponibilità.");
        setLoading(false);
        return;
      }
      setRows((rowsRes.data ?? []) as unknown as AvailabilityRow[]);
      setExceptions((excRes.data ?? []) as unknown as AvailabilityExceptionRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-destructive flex items-center gap-2">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    );
  }

  if (rows.length === 0 && exceptions.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Non hai ancora impostato disponibilità.
        <div className="mt-3">
          <Link to="/availability">
            <Button size="sm" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Imposta disponibilità
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Group weekly rows by day_of_week (0=Mon..6=Sun)
  const byDay = new Map<number, AvailabilityRow[]>();
  rows.forEach((r) => {
    const arr = byDay.get(r.day_of_week) ?? [];
    arr.push(r);
    byDay.set(r.day_of_week, arr);
  });
  const activeDays = Array.from(byDay.keys()).sort((a, b) => a - b);

  const topSlot = mode(rows.map((r) => SLOT_LABELS[r.time_slot] ?? r.time_slot));
  const topCity = mode(rows.map((r) => r.city).filter(Boolean) as string[]);

  const visibleDays = collapsible && !showAll ? activeDays.slice(0, previewCount) : activeDays;
  const showExceptions = !collapsible || showAll || activeDays.length === 0;

  const renderDay = (dow: number) => {
    const slots = byDay.get(dow) ?? [];
    const city = slots.find((s) => s.city)?.city;
    const district = slots.find((s) => s.district)?.district;
    return (
      <li
        key={dow}
        className="flex flex-col gap-1.5 rounded-lg border bg-background/60 p-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <div className="font-medium text-sm">{DAY_LABELS[dow]}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {slots.map((s) => {
              const label = SLOT_LABELS[s.time_slot] ?? s.time_slot;
              const time =
                s.start_time && s.end_time
                  ? ` ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`
                  : "";
              return (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="gap-1 font-normal"
                >
                  {s.is_last_minute && <Zap className="h-3 w-3" />}
                  {label}
                  {time && <span className="text-muted-foreground">{time}</span>}
                </Badge>
              );
            })}
          </div>
        </div>
        {(city || district) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <MapPin className="h-3 w-3" />
            {[city, district].filter(Boolean).join(" · ")}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      {activeDays.length > 0 && (
        <div className="space-y-2">
          {collapsible ? (
            <div className="text-sm leading-relaxed">
              <span className="font-semibold text-foreground">
                {activeDays.length} giorni disponibili
              </span>
              {topCity && (
                <span className="text-muted-foreground"> · {topCity}</span>
              )}
              {topSlot && (
                <span className="text-muted-foreground">
                  {" "}
                  · Fascia {topSlot.toLowerCase()}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Disponibilità settimanale
            </div>
          )}

          <ul className="space-y-2">
            {visibleDays.map((dow) => renderDay(dow))}
          </ul>

          {collapsible && activeDays.length > previewCount && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground/30 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showAll ? (
                <>
                  Mostra meno <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Mostra tutte <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {showExceptions && exceptions.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Prossime eccezioni
          </div>
          <ul className="space-y-1.5">
            {exceptions.slice(0, 3).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{fmtDate(e.date)}</span>
                  <span className="text-muted-foreground truncate">
                    {e.is_available
                      ? e.start_time && e.end_time
                        ? `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}`
                        : e.time_slot
                          ? SLOT_LABELS[e.time_slot]
                          : "Disponibile"
                      : "Non disponibile"}
                  </span>
                </div>
                <Badge
                  variant={e.is_available ? "secondary" : "outline"}
                  className="font-normal shrink-0"
                >
                  {e.is_available ? "Disponibile" : "Off"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!collapsible && (
        <div className="pt-1">
          <Link to="/availability">
            <Button size="sm" variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Gestisci disponibilità
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
