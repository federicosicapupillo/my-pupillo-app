import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setMyAvailableNow } from "@/lib/profile-self-update";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays,
  Save,
  Plus,
  Trash2,
  Zap,
  MapPin,
  Copy,
  Sparkles,
  CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  Repeat,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileGate } from "@/components/ProfileGate";
import {
  DAY_LABELS,
  SLOT_LABELS,
  SLOT_DEFAULT_TIMES,
  RADIUS_OPTIONS,
  type TimeSlot,
  type AvailabilityRow,
  type AvailabilityExceptionRow,
  crossesMidnight,
  isValidTimeRange,
} from "@/lib/availability";
import {
  addMonths,
  buildMonthGrid,
  dowOfIso,
  formatDateLong,
  formatMonthLabel,
  rangesOverlap,
  startOfMonth,
  toIso,
} from "@/lib/availability-calendar";
import { WORKER_CITIES, ALL_ZONES_OPTION, zonesForCity } from "@/lib/worker-cities";
import { useAvailableNowEnabled } from "@/lib/use-available-now-enabled";
import { useWorkerSpecialAvailabilityEnabled } from "@/lib/use-worker-special-availability-enabled";

// Province codes for the supported worker cities. Keep aligned with WORKER_CITIES.
const CITY_PROVINCE_CODE: Record<string, string> = {
  Milano: "MI",
  Roma: "RM",
  Torino: "TO",
  Bologna: "BO",
  Firenze: "FI",
  Napoli: "NA",
  Genova: "GE",
  Verona: "VR",
  Venezia: "VE",
  Bari: "BA",
};

function provinceForCity(city: string): string {
  return CITY_PROVINCE_CODE[city] ?? "";
}

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Le mie disponibilità — Pupillo" },
      { name: "description", content: "Imposta giorni, fasce orarie, città e zone in cui sei disponibile a ricevere proposte di lavoro." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <RequireRole allow={["worker"]}>
        <AvailabilityPage />
      </RequireRole>
    </RequireAuth>
  ),
});

/** Unico menu "Disponibilità" del pannello giorno. */
const PANEL_SLOTS: TimeSlot[] = ["colazione", "pranzo", "cena", "intera_giornata", "personalizzata"];
const EXC_SLOTS: TimeSlot[] = ["colazione", "pranzo", "aperitivo", "cena", "serale", "intera_giornata", "last_minute", "personalizzata"];

const DAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

let uidSeq = 0;
const nextUid = () => `s${++uidSeq}`;

type LocalSlot = {
  uid: string;
  id?: string;
  time_slot: TimeSlot;
  start_time: string | null;
  end_time: string | null;
  is_flexible: boolean;
  is_last_minute: boolean;
};

type DayState = {
  is_available: boolean;
  flexible: boolean;
  notes: string;
  slots: LocalSlot[];
  city: string;
  province: string;
  district: string;
  radius_km: number | null;
};

type WorkArea = {
  city: string;
  province: string;
  district: string;
  radius_km: number | null;
  notes: string;
};

type NewExc = {
  date: string;
  is_available: boolean;
  start_time: string;
  end_time: string;
  notes: string;
  city: string;
  province: string;
  district: string;
  radius_km: number | null;
  time_slot: TimeSlot | "";
};

function emptyDay(city = "", province = "", district = "", radius_km: number | null = null): DayState {
  return { is_available: false, flexible: false, notes: "", slots: [], city, province, district, radius_km };
}

function emptyNewExc(city = "", province = "", district = "", radius_km: number | null = null): NewExc {
  return {
    date: "",
    is_available: true,
    start_time: "",
    end_time: "",
    notes: "",
    city,
    province,
    district,
    radius_km,
    time_slot: "",
  };
}

function slotLabelOf(s: LocalSlot): string {
  return SLOT_LABELS[s.time_slot] ?? s.time_slot;
}

function sameArea(d: DayState, a: WorkArea): boolean {
  return (
    (d.city || "") === (a.city || "") &&
    (d.district || "") === (a.district || "") &&
    (d.radius_km ?? null) === (a.radius_km ?? null)
  );
}

/**
 * Firma dello stato editabile (giorni + area di lavoro). Confrontando la firma
 * corrente con lo snapshot dell'ultimo salvataggio otteniamo il flag "dirty"
 * in modo esatto: coprire fascia, orari, copie sugli altri giorni, città,
 * provincia, zona, raggio e note.
 */
function signatureOf(days: DayState[], area: WorkArea): string {
  return JSON.stringify({
    d: days.map((d) => ({
      a: d.is_available,
      f: d.flexible,
      n: d.notes || "",
      c: d.city || "",
      p: d.province || "",
      z: d.district || "",
      r: d.radius_km ?? null,
      s: d.slots.map((s) => [s.time_slot, s.start_time ?? "", s.end_time ?? ""]),
    })),
    w: [area.city || "", area.province || "", area.district || "", area.radius_km ?? null, area.notes || ""],
  });
}

function AvailabilityPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { requireCompleteForAvailability, canPerformOperationalAction } = useProfileGate();
  const { enabled: availableNowEnabled } = useAvailableNowEnabled();
  // Fail-closed: la sezione "Disponibilità speciali" esiste solo con flag ON.
  const { isEnabled: specialAvailabilityEnabled } = useWorkerSpecialAvailabilityEnabled();

  // Defaults from worker profile
  const defaults = useMemo(() => {
    const p = (profile ?? {}) as Record<string, unknown>;
    const radiusM = (p.service_area_radius_m as number | null) ?? null;
    return {
      city: (p.service_area_city as string | null) ?? (p.city as string | null) ?? "",
      province: (p.province as string | null) ?? "",
      district: (p.service_area_district as string | null) ?? (p.neighborhood as string | null) ?? "",
      radius_km: radiusM ? Math.max(1, Math.round(radiusM / 1000)) : null,
    };
  }, [profile]);

  const [days, setDays] = useState<DayState[]>(() => Array.from({ length: 7 }, () => emptyDay()));
  const [area, setArea] = useState<WorkArea>({ city: "", province: "", district: "", radius_km: null, notes: "" });
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRow[]>([]);
  const [newExc, setNewExc] = useState<NewExc>(() => emptyNewExc());
  const [availableNow, setAvailableNow] = useState(false);
  const [availableNowUntil, setAvailableNowUntil] = useState<string | null>(null);
  const [availableNowDuration, setAvailableNowDuration] = useState<"2h" | "today" | "tonight">("2h");

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  /** Selezione singola: una sola data (quindi un solo giorno settimanale) alla volta. */
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toIso(new Date()));

  const [copyOpen, setCopyOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmApplyArea, setConfirmApplyArea] = useState(false);
  const [howItWorks, setHowItWorks] = useState(false);
  const [areaEditing, setAreaEditing] = useState(false);
  const snapshotRef = useRef<{ days: DayState[]; area: WorkArea } | null>(null);
  /** Firma dell'ultimo stato salvato/caricato: null finché non abbiamo caricato. */
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [addingException, setAddingException] = useState(false);
  type ExcErrors = Partial<Record<"date" | "is_available" | "time_slot" | "city" | "district" | "radius_km" | "time", string>>;
  const [excErrors, setExcErrors] = useState<ExcErrors>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    // Carica una sola volta per utente: refetch successivi (es. refresh del
    // profilo) non devono sovrascrivere le modifiche non ancora salvate.
    if (loadedRef.current) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rowsRes = await supabase.from("worker_availability").select("*").eq("worker_id", user.id);
      if (cancelled) return;
      const rows = (rowsRes.data ?? []) as unknown as AvailabilityRow[];
      const next: DayState[] = Array.from({ length: 7 }, () =>
        emptyDay(defaults.city, defaults.province, defaults.district, defaults.radius_km),
      );
      rows.forEach((r) => {
        const d = next[r.day_of_week];
        if (!d) return;
        d.is_available = true;
        if (r.city) d.city = r.city;
        if (r.province) d.province = r.province;
        if (r.district) d.district = r.district;
        if (r.radius_km != null) d.radius_km = r.radius_km;
        if (r.time_slot === "flessibile") {
          d.flexible = true;
        } else {
          d.slots.push({
            uid: nextUid(),
            id: r.id,
            time_slot: r.time_slot,
            start_time: r.start_time?.slice(0, 5) ?? null,
            end_time: r.end_time?.slice(0, 5) ?? null,
            is_flexible: r.is_flexible,
            is_last_minute: r.is_last_minute,
          });
        }
        if (r.notes && !d.notes) d.notes = r.notes;
      });
      setDays(next);
      // Area di lavoro: valore prevalente fra i giorni attivi, altrimenti default profilo.
      const active = next.filter((d) => d.is_available && d.city);
      const base = active[0];
      const nextArea: WorkArea = {
        city: base?.city || defaults.city,
        province: base?.province || defaults.province,
        district: base?.district || defaults.district,
        radius_km: base?.radius_km ?? defaults.radius_km,
        notes: base?.notes || "",
      };
      setArea(nextArea);
      snapshotRef.current = {
        days: next.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) })),
        area: { ...nextArea },
      };
      setNewExc(emptyNewExc(defaults.city, defaults.province, defaults.district, defaults.radius_km));
      const until = (profile as { available_now_until?: string | null } | null)?.available_now_until ?? null;
      if (until && new Date(until).getTime() > Date.now()) {
        setAvailableNow(true);
        setAvailableNowUntil(until);
      }
      setSavedSignature(signatureOf(next, nextArea));
      setLoading(false);
      loadedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [user, profile, defaults.city, defaults.province, defaults.district, defaults.radius_km]);

  // Disponibilità speciali: nessuna query quando il flag è OFF/loading/error.
  useEffect(() => {
    if (!user || !specialAvailabilityEnabled) {
      setExceptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("worker_availability_exceptions")
        .select("*")
        .eq("worker_id", user.id)
        .order("date", { ascending: true });
      if (cancelled) return;
      setExceptions((data ?? []) as unknown as AvailabilityExceptionRow[]);
    })();
    return () => { cancelled = true; };
  }, [user, specialAvailabilityEnabled]);

  /** Stato dirty = differenza fra stato corrente e snapshot dell'ultimo salvataggio. */
  const currentSignature = useMemo(() => signatureOf(days, area), [days, area]);
  const dirty = savedSignature != null && currentSignature !== savedSignature;

  // Refresh / chiusura scheda: protezione nativa del browser.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Hai modifiche non salvate. Vuoi uscire senza salvare?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ─────────── Selezione calendario (single-select) → giorno settimanale ───────────
  const primaryDow = selectedDate != null ? dowOfIso(selectedDate) : null;

  /** Single-select: cliccare una data deseleziona automaticamente la precedente. */
  const selectDate = (iso: string) => setSelectedDate(iso);

  const applyToSelected = useCallback(
    (fn: (d: DayState) => DayState) => {
      setDays((prev) => prev.map((d, i) => (i === primaryDow ? fn(d) : d)));
    },
    [primaryDow],
  );

  // ─────────── Editing fasce ───────────
  const setDayAvailable = (on: boolean) =>
    applyToSelected((d) => ({
      ...d,
      is_available: on,
      city: on ? (d.city || area.city) : d.city,
      province: on ? (d.province || area.province) : d.province,
      district: on ? (d.district || area.district) : d.district,
      radius_km: on ? (d.radius_km ?? area.radius_km) : d.radius_km,
    }));

  /** Unico menu "Disponibilità": imposta la fascia del giorno selezionato. */
  const setDaySlot = (slot: TimeSlot) => {
    const def = SLOT_DEFAULT_TIMES[slot];
    applyToSelected((d) => {
      const prev = d.slots[0];
      return {
        ...d,
        is_available: true,
        city: d.city || area.city,
        province: d.province || area.province,
        district: d.district || area.district,
        radius_km: d.radius_km ?? area.radius_km,
        slots: [
          {
            uid: prev?.uid ?? nextUid(),
            id: prev?.id,
            time_slot: slot,
            start_time: slot === "personalizzata" ? (prev?.start_time ?? "18:00") : def.start,
            end_time: slot === "personalizzata" ? (prev?.end_time ?? "23:00") : def.end,
            is_flexible: false,
            is_last_minute: false,
          },
        ],
      };
    });
  };

  const patchDaySlot = (patch: Partial<LocalSlot>) =>
    applyToSelected((d) => ({
      ...d,
      slots: d.slots.map((s, i) => (i === 0 ? { ...s, ...patch } : s)),
    }));

  const setFlexible = (on: boolean) =>
    applyToSelected((d) => ({ ...d, flexible: on, is_available: on || d.is_available }));

  // ─────────── Area di lavoro ───────────
  const setAreaCity = (city: string) => {
    const zones = zonesForCity(city);
    const keep = area.district && zones.includes(area.district) ? area.district : ALL_ZONES_OPTION;
    setArea((a) => ({ ...a, city, province: provinceForCity(city), district: keep }));
  };

  const applyAreaToAllDays = () => {
    setDays((prev) =>
      prev.map((d) =>
        d.is_available
          ? { ...d, city: area.city, province: area.province, district: area.district, radius_km: area.radius_km, notes: area.notes }
          : d,
      ),
    );
    setConfirmApplyArea(false);
    toast.success("Area di lavoro applicata a tutti i giorni disponibili.");
  };

  // ─────────── Validazione + salvataggio ───────────
  const validateBeforeSave = (list: DayState[] = days): string | null => {
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d.is_available) continue;
      if (!d.city || !d.city.trim()) {
        return `Seleziona la città nell'area di lavoro (${DAY_LABELS[i]}).`;
      }
      if (!d.flexible && d.slots.length === 0) {
        return `Indica almeno una fascia oraria per ${DAY_LABELS[i]}.`;
      }
      for (const s of d.slots) {
        if (s.time_slot === "last_minute") continue;
        if (!s.start_time || !s.end_time) {
          return `Completa orario di inizio e fine per ${DAY_LABELS[i]}.`;
        }
        if (!isValidTimeRange(s.start_time, s.end_time)) {
          return `Orario di inizio e fine non possono coincidere (${DAY_LABELS[i]}).`;
        }
      }
      const ranges = d.slots.filter((s) => s.time_slot !== "last_minute" && s.start_time && s.end_time);
      for (let a = 0; a < ranges.length; a++) {
        for (let b = a + 1; b < ranges.length; b++) {
          const ra = ranges[a];
          const rb = ranges[b];
          if (rangesOverlap(ra.start_time as string, ra.end_time as string, rb.start_time as string, rb.end_time as string)) {
            return `Le fasce orarie di ${DAY_LABELS[i]} si sovrappongono.`;
          }
        }
      }
    }
    return null;
  };

  const persistAll = async (
    override?: DayState[],
    opts: { silent?: boolean } = {},
  ): Promise<boolean> => {
    if (!user) return false;
    const list = override ?? days;
    const err = validateBeforeSave(list);
    if (err) { toast.error(err); return false; }
    setSaving(true);
    try {
      const { error: delErr } = await supabase.from("worker_availability").delete().eq("worker_id", user.id);
      if (delErr) throw delErr;

      const inserts: Array<Omit<AvailabilityRow, "id">> = [];
      list.forEach((d, dow) => {
        if (!d.is_available) return;
        const loc = {
          city: d.city.trim() || null,
          province: d.province.trim() || null,
          district: d.district.trim() || null,
          latitude: null,
          longitude: null,
          radius_km: d.radius_km,
        };
        if (d.flexible) {
          inserts.push({
            worker_id: user.id,
            day_of_week: dow,
            time_slot: "flessibile",
            start_time: null,
            end_time: null,
            is_flexible: true,
            is_last_minute: false,
            notes: d.notes || null,
            ...loc,
          });
        }
        d.slots.forEach((s) => {
          inserts.push({
            worker_id: user.id,
            day_of_week: dow,
            time_slot: s.time_slot,
            start_time: s.start_time,
            end_time: s.end_time,
            is_flexible: false,
            is_last_minute: s.time_slot === "last_minute",
            notes: d.notes || null,
            ...loc,
          });
        });
      });

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("worker_availability").insert(inserts as never);
        if (insErr) throw insErr;
      }
      setLastSavedAt(new Date());
      snapshotRef.current = {
        days: list.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) })),
        area: { ...area },
      };
      setSavedSignature(signatureOf(list, area));
      if (!opts.silent) toast.success("Disponibilità salvate correttamente");
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore nel salvataggio";
      console.error("[availability] save failed", msg);
      toast.error("Non è stato possibile salvare la disponibilità. Riprova.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async (): Promise<void> => { await persistAll(); };

  // ─────────── Copia su tutti i giorni della settimana ───────────
  /** Giorni che verrebbero sovrascritti (hanno già una disponibilità impostata). */
  const overwriteTargets = useMemo(
    () =>
      days
        .map((d, i) => ({ d, i }))
        .filter(({ d, i }) => i !== primaryDow && (d.is_available || d.slots.length > 0))
        .map(({ i }) => DAY_LABELS[i]),
    [days, primaryDow],
  );

  /** Copia locale: nessun salvataggio automatico, resta una modifica non salvata. */
  const applyCopy = () => {
    if (primaryDow == null) return;
    const src = days[primaryDow];
    const next = days.map((d, i) =>
      i === primaryDow
        ? d
        : { ...src, slots: src.slots.map((s) => ({ ...s, uid: nextUid(), id: undefined })) },
    );
    setDays(next);
    setCopyOpen(false);
    toast.success("Disponibilità copiata su tutta la settimana. Ricordati di salvare.");
  };

  const clearAll = () => {
    setDays(Array.from({ length: 7 }, () => emptyDay(area.city, area.province, area.district, area.radius_km)));
    setConfirmClear(false);
    toast.success("Tutte le disponibilità sono state cancellate.");
  };

  /** Ripristina l'ultimo stato salvato (o caricato) senza toccare il DB. */
  const revertChanges = () => {
    const snap = snapshotRef.current;
    if (!snap) return;
    setDays(snap.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) })));
    setArea({ ...snap.area });
    setAreaEditing(false);
    toast.success("Modifiche annullate.");
  };

  // ─────────── Disponibilità speciali (flag) ───────────
  const addException = async () => {
    if (!user || !specialAvailabilityEnabled) return;
    const errs: ExcErrors = {};
    if (!newExc.date) {
      errs.date = "Seleziona una data valida.";
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const picked = new Date(newExc.date + "T00:00:00");
      if (picked < today) errs.date = "Non puoi inserire una disponibilità speciale in una data passata.";
    }
    if (newExc.is_available) {
      if (!newExc.time_slot) errs.time_slot = "Seleziona una fascia oraria.";
      if (!newExc.city.trim()) errs.city = "Seleziona la città.";
      if (!newExc.district.trim()) errs.district = "Seleziona la zona o quartiere.";
      if (newExc.radius_km == null) errs.radius_km = "Seleziona il raggio massimo.";
      if (newExc.time_slot === "personalizzata") {
        if (!newExc.start_time || !newExc.end_time) {
          errs.time = "Inserisci orario di inizio e fine.";
        } else if (!isValidTimeRange(newExc.start_time, newExc.end_time)) {
          errs.time = "L'orario di inizio e fine non possono coincidere.";
        }
      }
    }
    if (Object.keys(errs).length > 0) {
      setExcErrors(errs);
      toast.error("Controlla i campi evidenziati.");
      return;
    }
    setExcErrors({});
    const dup = exceptions.find(
      (e) => e.date === newExc.date && (e.time_slot ?? "") === newExc.time_slot,
    );
    if (dup) {
      toast.error("Hai già inserito una disponibilità speciale per questa data e fascia.");
      return;
    }
    const start = newExc.time_slot === "personalizzata" ? (newExc.start_time || null) : null;
    const end = newExc.time_slot === "personalizzata" ? (newExc.end_time || null) : null;
    const payload = {
      worker_id: user.id,
      date: newExc.date,
      is_available: newExc.is_available,
      start_time: newExc.is_available ? start : null,
      end_time: newExc.is_available ? end : null,
      time_slot: newExc.is_available && newExc.time_slot ? newExc.time_slot : null,
      notes: newExc.notes || null,
      city: newExc.is_available ? (newExc.city.trim() || null) : null,
      province: newExc.is_available ? (newExc.province.trim() || null) : null,
      district: newExc.is_available ? (newExc.district.trim() || null) : null,
      latitude: null,
      longitude: null,
      radius_km: newExc.is_available ? newExc.radius_km : null,
    };
    setAddingException(true);
    try {
      const { data, error } = await supabase
        .from("worker_availability_exceptions")
        .insert(payload as never)
        .select("*")
        .single();
      if (error) {
        toast.error("Non è stato possibile aggiungere la disponibilità speciale. Riprova.");
        return;
      }
      setExceptions((e) => [...e, data as unknown as AvailabilityExceptionRow].sort((a, b) => a.date.localeCompare(b.date)));
      setNewExc(emptyNewExc(area.city, area.province, area.district, area.radius_km));
      toast.success("Disponibilità speciale aggiunta correttamente.");
    } finally {
      setAddingException(false);
    }
  };

  const removeException = async (id: string) => {
    if (!specialAvailabilityEnabled) return;
    const { error } = await supabase.from("worker_availability_exceptions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setExceptions((e) => e.filter((x) => x.id !== id));
  };

  const toggleAvailableNow = async (on: boolean) => {
    if (!user) return;
    setAvailableNow(on);
    let until: string | null = null;
    if (on) {
      const d = new Date();
      if (availableNowDuration === "2h") d.setHours(d.getHours() + 2);
      else d.setHours(23, 59, 59, 0);
      until = d.toISOString();
    }
    setAvailableNowUntil(until);
    const { error } = await setMyAvailableNow(until);
    if (error) {
      toast.error(error.message);
      setAvailableNow(!on);
    } else {
      toast.success(on ? "Sei visibile per proposte last minute" : "Disponibilità immediata disattivata");
    }
  };

  // ─────────── Derivati ───────────
  const grid = useMemo(() => buildMonthGrid(month), [month]);

  const monthSetCount = useMemo(
    () => grid.filter((c) => c.inMonth && !c.isPast && days[c.dow]?.is_available).length,
    [grid, days],
  );

  const summary = useMemo(() => {
    const active = days.filter((d) => d.is_available).length;
    const totalSlots = days.reduce((acc, d) => acc + d.slots.length + (d.flexible ? 1 : 0), 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const nextSpecial = exceptions
      .filter((e) => new Date(e.date + "T00:00:00") >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    return { active, totalSlots, nextSpecial };
  }, [days, exceptions]);

  const saveGated = requireCompleteForAvailability(save);
  const addExceptionGated = requireCompleteForAvailability(addException);
  const removeExceptionGated = requireCompleteForAvailability(removeException);
  const toggleAvailableNowGated = requireCompleteForAvailability(toggleAvailableNow);
  const gatedOpacity = canPerformOperationalAction ? "" : "opacity-70";

  const saveStatus: "saving" | "dirty" | "saved" | "idle" =
    saving ? "saving" : dirty ? "dirty" : lastSavedAt ? "saved" : "idle";

  const SAVE_PILL = {
    saving: { label: "Salvataggio…", cls: "border-primary/50 bg-primary/15 text-primary", Icon: Loader2, spin: true },
    dirty: { label: "Modifiche non salvate", cls: "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: AlertCircle, spin: false },
    saved: { label: "Tutto salvato", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2, spin: false },
    idle: { label: "Nessuna modifica", cls: "border-border bg-muted text-muted-foreground", Icon: CheckCircle2, spin: false },
  }[saveStatus];

  const panelDay = primaryDow != null ? days[primaryDow] : null;
  const daySlot = panelDay?.slots[0] ?? null;

  // ─────────── Navigazione interna: blocco con dialog personalizzato ───────────
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: false, // gestito dall'effetto beforeunload sopra
    withResolver: true,
  });
  const [leaveSaving, setLeaveSaving] = useState(false);

  const stayOnPage = () => blocker.reset?.();

  const leaveWithoutSaving = () => {
    const snap = snapshotRef.current;
    if (snap) {
      setDays(snap.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) })));
      setArea({ ...snap.area });
    }
    blocker.proceed?.();
  };

  const saveAndContinue = async () => {
    setLeaveSaving(true);
    try {
      const ok = await persistAll();
      if (ok) blocker.proceed?.();
      else blocker.reset?.();
    } finally {
      setLeaveSaving(false);
    }
  };

  return (
    <AppShell>
      {/* ───────── HEADER ───────── */}
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-card/70 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Le mie disponibilità</h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
            Imposta quando sei disponibile a lavorare.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            "hidden lg:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold",
            SAVE_PILL.cls,
          )}>
            <SAVE_PILL.Icon className={cn("h-3.5 w-3.5", SAVE_PILL.spin && "animate-spin")} />
            {SAVE_PILL.label}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={revertChanges}
            disabled={!dirty || saving}
            className="hidden sm:inline-flex"
          >
            Annulla modifiche
          </Button>
          <Button
            onClick={saveGated}
            disabled={saving || loading || !dirty}
            size="sm"
            className={cn("hidden sm:inline-flex gap-2 font-semibold", gatedOpacity, dirty && "shadow-neon")}
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio..." : "Salva disponibilità"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ══════════ COLONNA SINISTRA ══════════ */}
        <div className="space-y-4">
          {/* ── Disponibile ora ── */}
          {availableNowEnabled && (
            <Card className="border-primary/20">
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">Disponibile ora</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {availableNow && availableNowUntil
                        ? `Attivo fino alle ${new Date(availableNowUntil).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
                        : "Ricevi proposte immediate, fuori calendario."}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select value={availableNowDuration} onValueChange={(v) => setAvailableNowDuration(v as "2h" | "today" | "tonight")}>
                    <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2h">Prossime 2 ore</SelectItem>
                      <SelectItem value="today">Disponibile oggi</SelectItem>
                      <SelectItem value="tonight">Questa sera</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch checked={availableNow} onCheckedChange={toggleAvailableNowGated} aria-label="Disponibile ora" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 1. AREA DI LAVORO ── */}
          <Card>
            <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 space-y-0 pb-3">
              <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 shrink-0 text-primary" /> Area di lavoro
              </CardTitle>
              <Button
                type="button"
                variant={areaEditing ? "secondary" : "outline"}
                size="sm"
                className="h-8 shrink-0 gap-1.5"
                onClick={() => setAreaEditing((v) => !v)}
              >
                <Pencil className="h-3.5 w-3.5" /> {areaEditing ? "Chiudi" : "Modifica"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!areaEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: "Città", value: area.city },
                      { label: "Provincia", value: area.province },
                      { label: "Zona", value: area.district },
                      { label: "Raggio", value: area.radius_km ? `${area.radius_km} km` : "" },
                    ].map((f) => (
                      <div key={f.label} className="rounded-lg border bg-background/60 px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</div>
                        <div className="truncate text-sm font-medium">{f.value || "—"}</div>
                      </div>
                    ))}
                  </div>
                  {area.notes && (
                    <p className="truncate rounded-lg border border-dashed bg-background/40 px-2.5 py-2 text-xs text-muted-foreground">
                      {area.notes}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Città</label>
                      <Select value={area.city || undefined} onValueChange={setAreaCity}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                        <SelectContent>
                          {area.city && !WORKER_CITIES.includes(area.city as (typeof WORKER_CITIES)[number]) && (
                            <SelectItem value={area.city}>{area.city} (attuale)</SelectItem>
                          )}
                          {WORKER_CITIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Zona / quartiere</label>
                      {(() => {
                        const zones = zonesForCity(area.city);
                        const dedup = Array.from(new Set([ALL_ZONES_OPTION, "Centro", ...zones.filter((z) => z !== "Centro")]));
                        const showCurrent = area.district && !dedup.includes(area.district);
                        return (
                          <Select
                            value={area.district || undefined}
                            onValueChange={(v) => setArea((a) => ({ ...a, district: v }))}
                            disabled={!area.city}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={area.city ? "Seleziona" : "Prima la città"} />
                            </SelectTrigger>
                            <SelectContent>
                              {showCurrent && <SelectItem value={area.district}>{area.district} (attuale)</SelectItem>}
                              {dedup.map((z) => (
                                <SelectItem key={z} value={z}>{z}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Provincia</label>
                      <Input className="h-9" value={area.province} readOnly disabled placeholder="Auto" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">Raggio massimo</label>
                      <Select
                        value={area.radius_km != null ? String(area.radius_km) : undefined}
                        onValueChange={(v) => setArea((a) => ({ ...a, radius_km: parseInt(v, 10) }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                        <SelectContent>
                          {RADIUS_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Note per i ristoratori (facoltative)</label>
                    <Input
                      className="h-9"
                      value={area.notes}
                      onChange={(e) => setArea((a) => ({ ...a, notes: e.target.value }))}
                      placeholder="Es. Mi sposto volentieri con preavviso"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmApplyArea(true)} disabled={!area.city}>
                      Applica a tutti i giorni disponibili
                    </Button>
                    <span className="text-[11px] text-muted-foreground">Sovrascrive l'area dei giorni già impostati.</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── 4. CALENDARIO COMPATTO ── */}
          <Card>
            <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 space-y-0 pb-2">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Mese precedente">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 text-center">
                <CardTitle className="truncate text-sm font-semibold capitalize">{formatMonthLabel(month)}</CardTitle>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {monthSetCount} {monthSetCount === 1 ? "giorno impostato" : "giorni impostati"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mese successivo">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="mb-1 grid grid-cols-7 gap-1">
                {DAY_SHORT.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold uppercase text-muted-foreground">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((c) => {
                  const isSelected = selectedDate === c.iso;
                  const hasAvail = days[c.dow]?.is_available;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      disabled={c.isPast}
                      onClick={() => selectDate(c.iso)}
                      aria-pressed={isSelected}
                      aria-label={`${formatDateLong(c.iso)}${hasAvail ? " · disponibilità impostata" : ""}`}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-md border text-xs font-medium transition-colors",
                        c.inMonth ? "text-foreground" : "text-muted-foreground/40",
                        c.isPast && "cursor-not-allowed opacity-35",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : hasAvail && c.inMonth
                            ? "border-primary/40 bg-primary/10 hover:bg-primary/15"
                            : "border-border/60 bg-card/50 hover:bg-muted/60",
                        c.isToday && !isSelected && "ring-1 ring-primary/60",
                      )}
                    >
                      <span className="tabular-nums leading-none">{c.day}</span>
                      <span
                        className={cn(
                          "mt-0.5 h-1 w-1 rounded-full",
                          hasAvail && c.inMonth ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent",
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Disponibilità impostata
                </span>
                {selectedDate && (
                  <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSelectedDate(null)}>
                    <X className="h-3 w-3" /> Deseleziona
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── 5. RIEPILOGO SETTIMANA ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" /> Riepilogo settimana
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              {days.map((d, i) => {
                const isSel = primaryDow === i;
                const labels = d.flexible
                  ? ["Flessibile"]
                  : d.slots.map((s) =>
                      s.start_time && s.end_time ? `${s.start_time}–${s.end_time}` : slotLabelOf(s),
                    );
                return (
                  <button
                    key={i}
                    type="button"
                    data-testid={`week-row-${i}`}
                    onClick={() => {
                      const target = grid.find((c) => c.inMonth && !c.isPast && c.dow === i);
                      if (target) {
                        setSelectedDate(target.iso);
                        return;
                      }
                      // Nessuna occorrenza futura nel mese visualizzato:
                      // salta alla prossima occorrenza di quel giorno.
                      const d0 = new Date();
                      d0.setHours(0, 0, 0, 0);
                      const delta = (i - ((d0.getDay() + 6) % 7) + 7) % 7;
                      d0.setDate(d0.getDate() + delta);
                      setMonth(startOfMonth(d0));
                      setSelectedDate(toIso(d0));
                    }}
                    className={cn(
                      "grid w-full grid-cols-[38px_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                      isSel
                        ? "border-primary bg-primary/10"
                        : d.is_available
                          ? "border-border bg-background/60 hover:bg-muted/50"
                          : "border-dashed border-border/60 bg-transparent hover:bg-muted/40",
                    )}
                  >
                    <span className={cn("text-xs font-semibold", isSel ? "text-primary" : d.is_available ? "text-foreground" : "text-muted-foreground")}>
                      {DAY_SHORT[i]}
                    </span>
                    <span className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">
                      {d.is_available ? (labels.length > 0 ? labels.join(" · ") : "Nessuna fascia") : "Non disponibile"}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* ── 6. COME FUNZIONA ── */}
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="space-y-2 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Repeat className="h-4 w-4 text-primary" /> Come funziona
              </div>
              <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                <li>Le disponibilità che imposti valgono <strong className="text-foreground">ogni settimana</strong>.</li>
                <li>Seleziona un giorno per modificare gli orari ricorrenti di quel giorno: es. un mercoledì vale per <strong className="text-foreground">tutti i mercoledì</strong>.</li>
                <li>Città, zona e raggio si impostano una sola volta in "Area di lavoro".</li>
              </ul>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setHowItWorks(true)}>
                <Info className="h-3.5 w-3.5" /> Maggiori dettagli
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ══════════ COLONNA DESTRA ══════════ */}
        <div className="space-y-4">
          {/* ── 2. DISPONIBILITÀ RICORRENTE DEL GIORNO ── */}
          {panelDay == null ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Seleziona un giorno sul calendario per impostare le fasce orarie ricorrenti.
              </CardContent>
            </Card>
          ) : (
            <Card className={cn(panelDay.is_available && "border-primary/25")}>
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base font-semibold capitalize">
                    Disponibilità del {primaryDow != null ? DAY_LABELS[primaryDow].toLowerCase() : ""}
                  </CardTitle>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Repeat className="h-3.5 w-3.5 shrink-0 text-primary" />
                    Questa impostazione vale per tutti i {primaryDow != null ? DAY_LABELS[primaryDow].toLowerCase() : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-xs font-medium", panelDay.is_available ? "text-primary" : "text-muted-foreground")}>
                    {panelDay.is_available ? "Disponibile" : "Non disponibile"}
                  </span>
                  <Switch checked={panelDay.is_available} onCheckedChange={setDayAvailable} aria-label="Disponibile" />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {!panelDay.is_available ? (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
                    Attiva il selettore per impostare la disponibilità di questo giorno.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Disponibilità</label>
                      <Select value={daySlot?.time_slot ?? undefined} onValueChange={(v) => setDaySlot(v as TimeSlot)}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Seleziona una fascia" />
                        </SelectTrigger>
                        <SelectContent>
                          {PANEL_SLOTS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt === "intera_giornata" ? "Tutto il giorno" : opt === "personalizzata" ? "Personalizzato" : SLOT_LABELS[opt]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {daySlot && daySlot.time_slot !== "personalizzata" && (
                      <p className="rounded-lg border bg-background/60 px-3 py-2 text-sm tabular-nums">
                        {daySlot.start_time && daySlot.end_time
                          ? `${daySlot.start_time} – ${daySlot.end_time}`
                          : "Orario da impostare"}
                        <button
                          type="button"
                          className="ml-3 text-xs font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => setDaySlot("personalizzata")}
                        >
                          Modifica orario
                        </button>
                      </p>
                    )}

                    {daySlot?.time_slot === "personalizzata" && (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Dalle</label>
                            <Select value={daySlot.start_time ?? undefined} onValueChange={(v) => patchDaySlot({ start_time: v })}>
                              <SelectTrigger className="h-10"><SelectValue placeholder="--:--" /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={`s-${t}`} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Alle</label>
                            <Select value={daySlot.end_time ?? undefined} onValueChange={(v) => patchDaySlot({ end_time: v })}>
                              <SelectTrigger className="h-10"><SelectValue placeholder="--:--" /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={`e-${t}`} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {(!daySlot.start_time || !daySlot.end_time) && (
                          <p className="text-xs text-destructive">Inserisci orario di inizio e fine.</p>
                        )}
                        {daySlot.start_time && daySlot.end_time && !isValidTimeRange(daySlot.start_time, daySlot.end_time) && (
                          <p className="text-xs text-destructive">L'orario di fine deve essere diverso da quello di inizio.</p>
                        )}
                        {daySlot.start_time && daySlot.end_time && crossesMidnight(daySlot.start_time, daySlot.end_time) && (
                          <p className="text-xs text-muted-foreground">Il turno termina il giorno successivo.</p>
                        )}
                      </>
                    )}

                    {!daySlot && (
                      <p className="text-xs text-muted-foreground">Nessuna fascia impostata per questo giorno.</p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">
                        {panelDay.city
                          ? `${panelDay.city}${panelDay.district ? ` · ${panelDay.district}` : ""}${panelDay.radius_km ? ` · ${panelDay.radius_km} km` : ""}`
                          : "Area non impostata"}
                      </span>
                      {panelDay.city && !sameArea(panelDay, area) && (
                        <Badge variant="secondary" className="shrink-0">Diversa dall'area</Badge>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={copying || saving}
                      onClick={() => setCopyOpen(true)}
                    >
                      <Copy className="h-4 w-4" /> Copia su tutti i giorni della settimana
                    </Button>

                    <div className="space-y-2 border-t pt-3">
                      <Button
                        onClick={saveGated}
                        disabled={saving || loading || !dirty}
                        className={cn("w-full gap-2 font-semibold", gatedOpacity, dirty && "shadow-neon")}
                      >
                        <Save className="h-4 w-4" />
                        {saving ? "Salvataggio..." : "Salva disponibilità"}
                      </Button>
                      <span className={cn(
                        "flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold",
                        SAVE_PILL.cls,
                      )}>
                        <SAVE_PILL.Icon className={cn("h-3.5 w-3.5", SAVE_PILL.spin && "animate-spin")} />
                        {SAVE_PILL.label}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ───────── DISPONIBILITÀ SPECIALI (feature flag) ───────── */}
      {specialAvailabilityEnabled && (
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Disponibilità speciali
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Eccezioni per date specifiche: hanno sempre la priorità sul calendario ricorrente.
            </p>
          </div>

          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Data <span className="text-destructive">*</span></label>
                {(() => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const selected = newExc.date ? new Date(newExc.date + "T00:00:00") : undefined;
                  const label = selected
                    ? selected.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
                    : "Seleziona una data";
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selected && "text-muted-foreground",
                            excErrors.date && "border-destructive",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          <span className="capitalize">{label}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selected}
                          onSelect={(d) => {
                            if (!d) return;
                            setNewExc({ ...newExc, date: toIso(d) });
                            setExcErrors((e) => ({ ...e, date: undefined }));
                          }}
                          disabled={(d) => d < today}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                })()}
                {excErrors.date && <p className="text-xs text-destructive mt-1">{excErrors.date}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Stato <span className="text-destructive">*</span></label>
                <Select value={newExc.is_available ? "yes" : "no"} onValueChange={(v) => setNewExc({ ...newExc, is_available: v === "yes" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Disponibile</SelectItem>
                    <SelectItem value="no">Non disponibile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Fascia {newExc.is_available && <span className="text-destructive">*</span>}</label>
                <Select
                  value={newExc.time_slot || undefined}
                  onValueChange={(v) => { setNewExc({ ...newExc, time_slot: v as TimeSlot }); setExcErrors((e) => ({ ...e, time_slot: undefined })); }}
                  disabled={!newExc.is_available}
                >
                  <SelectTrigger className={cn(excErrors.time_slot && "border-destructive")}>
                    <SelectValue placeholder="Seleziona una fascia" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXC_SLOTS.map((s) => (
                      <SelectItem key={s} value={s}>{SLOT_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excErrors.time_slot && <p className="text-xs text-destructive mt-1">{excErrors.time_slot}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Città {newExc.is_available && <span className="text-destructive">*</span>}</label>
                <Select
                  value={newExc.city || undefined}
                  onValueChange={(v) => {
                    const zones = zonesForCity(v);
                    const keepDistrict = newExc.district && zones.includes(newExc.district) ? newExc.district : ALL_ZONES_OPTION;
                    setNewExc({ ...newExc, city: v, province: provinceForCity(v), district: keepDistrict });
                    setExcErrors((e) => ({ ...e, city: undefined, district: undefined }));
                  }}
                  disabled={!newExc.is_available}
                >
                  <SelectTrigger className={cn(excErrors.city && "border-destructive")}>
                    <SelectValue placeholder="Seleziona la città" />
                  </SelectTrigger>
                  <SelectContent>
                    {newExc.city && !WORKER_CITIES.includes(newExc.city as (typeof WORKER_CITIES)[number]) && (
                      <SelectItem value={newExc.city}>{newExc.city} (attuale)</SelectItem>
                    )}
                    {WORKER_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excErrors.city && <p className="text-xs text-destructive mt-1">{excErrors.city}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Zona / quartiere {newExc.is_available && <span className="text-destructive">*</span>}</label>
                {(() => {
                  const zones = zonesForCity(newExc.city);
                  const dedup = Array.from(new Set([ALL_ZONES_OPTION, "Centro", ...zones.filter((z) => z !== "Centro")]));
                  const showCurrent = newExc.district && !dedup.includes(newExc.district);
                  return (
                    <Select
                      value={newExc.district || undefined}
                      onValueChange={(v) => { setNewExc({ ...newExc, district: v }); setExcErrors((e) => ({ ...e, district: undefined })); }}
                      disabled={!newExc.is_available || !newExc.city}
                    >
                      <SelectTrigger className={cn(excErrors.district && "border-destructive")}>
                        <SelectValue placeholder={newExc.city ? "Seleziona la zona" : "Prima seleziona la città"} />
                      </SelectTrigger>
                      <SelectContent>
                        {showCurrent && <SelectItem value={newExc.district}>{newExc.district} (attuale)</SelectItem>}
                        {dedup.map((z) => (
                          <SelectItem key={z} value={z}>{z}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
                {excErrors.district && <p className="text-xs text-destructive mt-1">{excErrors.district}</p>}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Provincia</label>
                <Input value={newExc.province} readOnly disabled placeholder="Auto" />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Raggio {newExc.is_available && <span className="text-destructive">*</span>}</label>
                <Select
                  value={newExc.radius_km != null ? String(newExc.radius_km) : undefined}
                  onValueChange={(v) => { setNewExc({ ...newExc, radius_km: parseInt(v, 10) }); setExcErrors((e) => ({ ...e, radius_km: undefined })); }}
                  disabled={!newExc.is_available}
                >
                  <SelectTrigger className={cn(excErrors.radius_km && "border-destructive")}>
                    <SelectValue placeholder="Seleziona raggio" />
                  </SelectTrigger>
                  <SelectContent>
                    {RADIUS_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excErrors.radius_km && <p className="text-xs text-destructive mt-1">{excErrors.radius_km}</p>}
              </div>

              {newExc.time_slot === "personalizzata" && (
                <>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-muted-foreground mb-1">Dalle *</label>
                    <Select
                      value={newExc.start_time || ""}
                      onValueChange={(v) => setNewExc({ ...newExc, start_time: v })}
                      disabled={!newExc.is_available}
                    >
                      <SelectTrigger className={cn(excErrors.time && "border-destructive")}><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={`xs-${t}`} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-muted-foreground mb-1">Alle *</label>
                    <Select
                      value={newExc.end_time || ""}
                      onValueChange={(v) => setNewExc({ ...newExc, end_time: v })}
                      disabled={!newExc.is_available}
                    >
                      <SelectTrigger className={cn(excErrors.time && "border-destructive")}><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={`xe-${t}`} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newExc.start_time && newExc.end_time && crossesMidnight(newExc.start_time, newExc.end_time) && (
                      <p className="text-[11px] text-muted-foreground mt-1">Termina il giorno successivo</p>
                    )}
                  </div>
                  {excErrors.time && (
                    <div className="md:col-span-6 -mt-2">
                      <p className="text-xs text-destructive">{excErrors.time}</p>
                    </div>
                  )}
                </>
              )}

              <div className="md:col-span-6">
                <label className="block text-xs text-muted-foreground mb-1">Note (facoltative)</label>
                <Input value={newExc.notes} onChange={(e) => setNewExc({ ...newExc, notes: e.target.value })} placeholder="Es. Sono a Milano per il weekend" />
              </div>
              <div className="md:col-span-6 flex justify-end">
                <Button onClick={addExceptionGated} disabled={addingException} className={`gap-2 ${gatedOpacity}`}>
                  <Plus className="h-4 w-4" /> {addingException ? "Aggiunta in corso…" : "Aggiungi disponibilità speciale"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-3">
            {exceptions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/80 bg-card/40 p-7 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <p className="mt-3 text-sm font-medium">Nessuna disponibilità speciale</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aggiungi eccezioni per date specifiche, ad esempio festivi o giorni fuori routine.
                </p>
              </div>
            )}
            {exceptions.map((e) => (
              <div key={e.id} className="rounded-xl border border-border/80 bg-card/60 p-3.5 flex flex-wrap items-center gap-3 text-sm transition-colors hover:bg-card/80">
                <Badge variant={e.is_available ? "default" : "destructive"}>
                  {e.is_available ? "Disponibile" : "Non disponibile"}
                </Badge>
                <span className="font-medium">
                  {new Date(e.date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </span>
                {e.is_available && e.city && (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {e.city}{e.district ? ` · ${e.district}` : ""}
                    {e.radius_km ? ` · entro ${e.radius_km} km` : ""}
                  </span>
                )}
                {e.is_available && e.time_slot && (
                  <Badge variant="secondary">{SLOT_LABELS[e.time_slot]}</Badge>
                )}
                {e.is_available && e.start_time && e.end_time && (
                  <span className="text-muted-foreground">
                    {e.start_time.slice(0, 5)} – {e.end_time.slice(0, 5)}
                  </span>
                )}
                {e.notes && <span className="text-muted-foreground truncate">· {e.notes}</span>}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => removeExceptionGated(e.id)}
                  aria-label="Rimuovi disponibilità speciale"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────── DIALOGS ───────── */}
      <Dialog open={howItWorks} onOpenChange={setHowItWorks}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Come funziona il calendario</DialogTitle>
            <DialogDescription>
              Il calendario è una vista sul tuo schema settimanale ricorrente.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Selezionando una data modifichi <strong className="text-foreground">tutti i giorni della settimana corrispondenti</strong> (es. tocca un mercoledì → vale per tutti i mercoledì).</li>
            <li>Puoi selezionare più date insieme: le modifiche si applicano a tutti i giorni della settimana coinvolti.</li>
            <li>Città, zona e raggio si impostano una sola volta nella sezione "Area di lavoro".</li>
            <li>Le date passate non sono selezionabili.</li>
          </ul>
          <DialogFooter>
            <Button onClick={() => setHowItWorks(false)}>Ho capito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiare su tutti i giorni della settimana?</DialogTitle>
            <DialogDescription>
              La disponibilità di {primaryDow != null ? DAY_LABELS[primaryDow].toLowerCase() : ""} verrà copiata su tutti gli altri giorni.
            </DialogDescription>
          </DialogHeader>
          {overwriteTargets.length > 0 && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Attenzione: verranno sovrascritte le disponibilità già impostate per {overwriteTargets.join(", ")}.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={copying}>Annulla</Button>
            <Button onClick={applyCopy} disabled={copying || saving}>
              {copying ? "Copia in corso…" : "Conferma e copia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmApplyArea} onOpenChange={setConfirmApplyArea}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Applicare l'area a tutti i giorni?</DialogTitle>
            <DialogDescription>
              Città, zona, raggio e note verranno sovrascritti su tutti i giorni disponibili.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApplyArea(false)}>Annulla</Button>
            <Button onClick={applyAreaToAllDays}>Applica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancella tutte le disponibilità</DialogTitle>
            <DialogDescription>
              Stai per cancellare tutte le disponibilità impostate. Vuoi continuare?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>Annulla</Button>
            <Button variant="destructive" onClick={clearAll}>Cancella tutto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modifiche non salvate: navigazione interna bloccata ── */}
      <Dialog open={blocker.status === "blocked"} onOpenChange={(v) => { if (!v) stayOnPage(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifiche non salvate</DialogTitle>
            <DialogDescription>
              Hai modificato le tue disponibilità ma non hai ancora salvato. Se esci, le modifiche andranno perse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={stayOnPage} disabled={leaveSaving}>Resta nella pagina</Button>
            <Button variant="ghost" onClick={leaveWithoutSaving} disabled={leaveSaving}>Esci senza salvare</Button>
            <Button onClick={saveAndContinue} disabled={leaveSaving}>
              {leaveSaving ? "Salvataggio…" : "Salva e continua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Torna alla dashboard
        </Link>
      </div>

      {/* ───────── Sticky save bar (mobile) ───────── */}
      <div className="sm:hidden h-24" aria-hidden />
      <div className={cn(
        "sm:hidden fixed bottom-0 inset-x-0 z-40 border-t p-4 transition-colors",
        dirty
          ? "border-amber-500/30 bg-background/98 backdrop-blur supports-[backdrop-filter]:bg-background/90 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.3)]"
          : "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold shrink-0",
            SAVE_PILL.cls,
          )}>
            <SAVE_PILL.Icon className={cn("h-3 w-3", SAVE_PILL.spin && "animate-spin")} />
            <span className="truncate max-w-[120px]">{SAVE_PILL.label}</span>
          </span>
          <Button
            onClick={saveGated}
            disabled={saving || loading || !dirty}
            className={cn("flex-1 gap-2 h-12 text-base font-semibold", gatedOpacity, dirty && "shadow-neon")}
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio..." : "Salva disponibilità"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}