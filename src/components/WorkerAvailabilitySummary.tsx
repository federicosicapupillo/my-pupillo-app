import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  MapPin,
  Zap,
  AlertCircle,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  DAY_LABELS,
  SLOT_LABELS,
  SLOT_DEFAULT_TIMES,
  type AvailabilityRow,
  type AvailabilityExceptionRow,
  type TimeSlot,
} from "@/lib/availability";

type Props = {
  workerId: string;
  collapsible?: boolean;
  previewCount?: number;
};

// Timeline window: 06:00 → 30:00 (i.e. 06:00 of next day)
const TL_START = 6;
const TL_END = 30;
const TL_SPAN = TL_END - TL_START; // 24h
const TICKS = [6, 9, 12, 15, 18, 21, 24, 27];

const DAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function parseHm(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h + (m || 0) / 60;
}

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

type Segment = {
  id: string;
  startH: number;
  endH: number;
  label: string;
  isLastMinute: boolean;
  isFlexible: boolean;
};

function rowToSegments(r: AvailabilityRow): Segment[] {
  const fallback = SLOT_DEFAULT_TIMES[r.time_slot as TimeSlot];
  const startStr = r.start_time ?? fallback?.start ?? null;
  const endStr = r.end_time ?? fallback?.end ?? null;
  const label = SLOT_LABELS[r.time_slot] ?? r.time_slot;

  // Flexible / last minute / no times → no bar, render as chip
  if (!startStr || !endStr) {
    return [
      {
        id: r.id,
        startH: -1,
        endH: -1,
        label,
        isLastMinute: !!r.is_last_minute,
        isFlexible: !!r.is_flexible || r.time_slot === "flessibile",
      },
    ];
  }

  let s = parseHm(startStr) ?? 0;
  let e = parseHm(endStr) ?? 0;
  if (e <= s) e += 24; // crosses midnight
  // Clamp to window
  s = Math.max(TL_START, s);
  e = Math.min(TL_END, e);
  if (e <= s) return [];
  return [
    {
      id: r.id,
      startH: s,
      endH: e,
      label,
      isLastMinute: !!r.is_last_minute,
      isFlexible: false,
    },
  ];
}

export function WorkerAvailabilitySummary({
  workerId,
  collapsible = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRow[]>([]);

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

  const { byDay, activeDays, topSlot, topCity, totalSlots } = useMemo(() => {
    const byDay = new Map<number, AvailabilityRow[]>();
    rows.forEach((r) => {
      const arr = byDay.get(r.day_of_week) ?? [];
      arr.push(r);
      byDay.set(r.day_of_week, arr);
    });
    const activeDays = Array.from(byDay.keys()).sort((a, b) => a - b);
    const topSlot = mode(rows.map((r) => SLOT_LABELS[r.time_slot] ?? r.time_slot));
    const topCity = mode(rows.map((r) => r.city).filter(Boolean) as string[]);
    return { byDay, activeDays, topSlot, topCity, totalSlots: rows.length };
  }, [rows]);

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
      <div className="rounded-2xl border bg-card p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div className="mt-3 text-sm font-semibold">
          Non hai ancora inserito disponibilità
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggiungi i giorni e gli orari in cui puoi lavorare.
        </p>
        <div className="mt-4">
          <Link to="/availability">
            <Button size="sm" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Aggiungi disponibilità
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build per-day segment map (all 7 days)
  const segsByDay = new Map<number, Segment[]>();
  for (let d = 0; d < 7; d++) {
    const slots = byDay.get(d) ?? [];
    const segs: Segment[] = [];
    slots.forEach((r) => segs.push(...rowToSegments(r)));
    segsByDay.set(d, segs);
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      {/* Summary line */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 font-medium">
          <CalendarDays className="h-3 w-3" />
          {activeDays.length}{" "}
          {activeDays.length === 1 ? "giorno" : "giorni"} disponibili
        </Badge>
        <Badge variant="secondary" className="gap-1 font-medium">
          <Sparkles className="h-3 w-3" />
          {totalSlots} {totalSlots === 1 ? "fascia" : "fasce"}
        </Badge>
        {topSlot && (
          <Badge variant="outline" className="font-medium">
            Prevalenza: {topSlot.toLowerCase()}
          </Badge>
        )}
        {topCity && (
          <Badge variant="outline" className="gap-1 font-medium">
            <MapPin className="h-3 w-3" /> {topCity}
          </Badge>
        )}
      </div>

      {/* Weekly mini-grid */}
      <div className="rounded-xl border bg-background/60 p-3">
        {/* Hour ticks header */}
        <div className="grid grid-cols-[44px_1fr] gap-2 sm:grid-cols-[64px_1fr] sm:gap-3">
          <div />
          <div className="relative h-4">
            {TICKS.map((h) => {
              const pct = ((h - TL_START) / TL_SPAN) * 100;
              const display = h >= 24 ? h - 24 : h;
              return (
                <span
                  key={h}
                  className="absolute -translate-x-1/2 text-[10px] font-medium tabular-nums text-muted-foreground"
                  style={{ left: `${pct}%` }}
                >
                  {String(display).padStart(2, "0")}
                </span>
              );
            })}
          </div>
        </div>

        {/* Day rows */}
        <div className="mt-1 space-y-1.5">
          {Array.from({ length: 7 }, (_, d) => {
            const segs = segsByDay.get(d) ?? [];
            const isActive = segs.length > 0;
            const isToday = ((new Date().getDay() + 6) % 7) === d;
            return (
              <div
                key={d}
                className="grid grid-cols-[44px_1fr] items-center gap-2 sm:grid-cols-[64px_1fr] sm:gap-3"
              >
                <div
                  className={`text-xs font-semibold ${
                    isToday ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="sm:hidden">{DAY_SHORT[d]}</span>
                  <span className="hidden sm:inline">{DAY_LABELS[d]}</span>
                  {isToday && (
                    <span className="ml-1 text-[9px] uppercase tracking-wide text-primary/70">
                      oggi
                    </span>
                  )}
                </div>
                <div
                  className={`relative h-7 overflow-hidden rounded-md border ${
                    isActive
                      ? "border-border bg-muted/40"
                      : "border-dashed border-border/60 bg-muted/20"
                  }`}
                >
                  {/* Tick guides */}
                  {TICKS.map((h) => {
                    const pct = ((h - TL_START) / TL_SPAN) * 100;
                    return (
                      <span
                        key={h}
                        className="absolute top-0 h-full w-px bg-border/60"
                        style={{ left: `${pct}%` }}
                      />
                    );
                  })}

                  {!isActive ? (
                    <span className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground/70">
                      Non disponibile
                    </span>
                  ) : (
                    <>
                      {/* Bars with times */}
                      {segs
                        .filter((s) => s.startH >= 0)
                        .map((s) => {
                          const left = ((s.startH - TL_START) / TL_SPAN) * 100;
                          const width = ((s.endH - s.startH) / TL_SPAN) * 100;
                          const displayEnd = s.endH >= 24 ? s.endH - 24 : s.endH;
                          const timeLabel = `${String(Math.floor(s.startH)).padStart(2, "0")}–${String(Math.floor(displayEnd)).padStart(2, "0")}`;
                          return (
                            <div
                              key={s.id}
                              className="absolute top-1 bottom-1 flex items-center justify-center overflow-hidden rounded-[5px] bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/30"
                              style={{ left: `${left}%`, width: `${width}%` }}
                              title={`${s.label} ${timeLabel}`}
                            >
                              {s.isLastMinute && (
                                <Zap className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                              )}
                              <span className="truncate tabular-nums">{timeLabel}</span>
                            </div>
                          );
                        })}
                      {/* Flexible/last-minute chips overlaid on left */}
                      {segs
                        .filter((s) => s.startH < 0)
                        .map((s, i) => (
                          <span
                            key={s.id}
                            className="absolute top-1/2 -translate-y-1/2 rounded-[5px] border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            style={{ left: `${4 + i * 70}px` }}
                          >
                            {s.isLastMinute ? "Last minute" : "Flessibile"}
                          </span>
                        ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming exceptions */}
      {exceptions.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prossime eccezioni
          </div>
          <ul className="space-y-1.5">
            {exceptions.slice(0, 3).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{fmtDate(e.date)}</span>
                  <span className="truncate text-muted-foreground">
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
                  className="shrink-0 font-normal"
                >
                  {e.is_available ? "Disponibile" : "Off"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-end pt-1">
        <Link to="/availability">
          <Button size="sm" variant={collapsible ? "outline" : "default"} className="gap-2">
            <Pencil className="h-3.5 w-3.5" /> Modifica disponibilità
          </Button>
        </Link>
      </div>
    </div>
  );
}
