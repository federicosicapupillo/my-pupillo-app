import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AnnouncementMap } from "@/components/AnnouncementMap";
import { geocodeAddressWithRetry, describeGeocodeError, type GeocodeError } from "@/lib/geocode";
import { AlertCircle, CheckCircle2, Eye, Loader2, Save, Send, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { buildDefaultsUpdate, hasSavedDefaults } from "@/lib/restaurant-defaults";
import {
  BEARD_OPTIONS,
  DRESS_CODE_OPTIONS,
  LANGUAGE_OPTIONS,
  LICENSE_OPTIONS,
  PIERCING_OPTIONS,
  SKILL_OPTIONS,
  TATTOO_OPTIONS,
  labelOf,
  labelsOf,
} from "@/lib/announcement-requirements";
import { ITALIAN_LOCATIONS, citiesForProvince, isCityInProvince } from "@/lib/italian-locations";
import { CONTACT_ROLES, isValidEmail } from "@/lib/contact-roles";
import { PhoneInput } from "@/components/PhoneInput";
import { splitPhone, buildPhoneFull, DEFAULT_PHONE_PREFIX } from "@/lib/phone-prefixes";

export const Route = createFileRoute("/ristoratore/annunci/nuovo")({
  head: () => ({ meta: [{ title: "Crea Nuovo Annuncio — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ reuse: typeof s.reuse === "string" ? s.reuse : undefined }),
  component: () => <RequireAuth><NewRestaurantJobRequest /></RequireAuth>,
});

const ROLE_OPTIONS = [
  "Cameriere",
  "Bartender",
  "Chef",
  "Aiuto cucina",
  "Runner",
  "Lavapiatti",
  "Barista",
  "Pizzaiolo",
  "Hostess",
  "Responsabile di sala",
  "Addetto catering",
  "Receptionist",
];

type FormState = {
  title: string;
  role_required: string;
  workers_needed: string;
  shift_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: string;
  break_included: boolean;
  operational_notes: string;
  restaurant_name: string;
  address: string;
  city: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
  access_restrictions: string;
  additional_directions: string;
  contact_person_name: string;
  contact_person_phone: string;
  contact_person_email: string;
  contact_person_role: string;
  contact_person_role_other: string;
  worker_notes: string;
  license_requirement: string;
  tattoos_allowed: string;
  piercings_allowed: string;
  beard_allowed: string;
  dress_code_notes: string;
};

function calculateDurationHours(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
  // Overnight shift (es. 19:00 -> 02:00): aggiungi 24h
  if (diffMinutes <= 0) diffMinutes += 24 * 60;
  return diffMinutes > 0 ? Number((diffMinutes / 60).toFixed(2)) : 0;
}

function buildDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if ([y, m, d, h, mi].some((n) => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, h, mi, 0, 0);
}

function durationFromDateTimes(startDate: string, startTime: string, endDate: string, endTime: string) {
  const s = buildDateTime(startDate, startTime);
  const e = buildDateTime(endDate, endTime);
  if (!s || !e) return 0;
  const diffMin = Math.round((e.getTime() - s.getTime()) / 60000);
  return diffMin > 0 ? Number((diffMin / 60).toFixed(2)) : 0;
}

function addDays(date: string, days: number): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function formatShiftRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  if (!startDate) return "—";
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("it-IT");
  const st = (startTime || "").slice(0, 5);
  const et = (endTime || "").slice(0, 5);
  if (!endDate || endDate === startDate) {
    return `${fmt(startDate)} · ${st}${et ? `–${et}` : ""}`;
  }
  return `${fmt(startDate)} ${st} → ${fmt(endDate)} ${et}`;
}

function splitLanguages(values: string[]) {
  return labelsOf(values, LANGUAGE_OPTIONS);
}

function NewRestaurantJobRequest() {
  const { user, role, profile } = useAuth();
  const nav = useNavigate();
  const { reuse } = Route.useSearch();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [confirmDefaultsOpen, setConfirmDefaultsOpen] = useState(false);
  const pendingStatusRef = useRef<"bozza" | "pubblicato" | null>(null);
  const [geoState, setGeoState] = useState<{ status: "idle" | "loading" | "ok" | "error"; attempt: number; error?: GeocodeError }>({ status: "idle", attempt: 0 });
  const [languageReqs, setLanguageReqs] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [dressItems, setDressItems] = useState<string[]>([]);
  const [f, setF] = useState<FormState>({
    title: "",
    role_required: "",
    workers_needed: "1",
    shift_date: "",
    end_date: "",
    start_time: "19:00",
    end_time: "23:00",
    hourly_rate: "12",
    break_included: false,
    operational_notes: "",
    restaurant_name: "",
    address: "",
    city: "",
    district: "",
    province: "",
    postal_code: "",
    country: "Italia",
    latitude: "",
    longitude: "",
    access_restrictions: "",
    additional_directions: "",
    contact_person_name: "",
    contact_person_phone: "",
    contact_person_email: "",
    contact_person_role: "",
    contact_person_role_other: "",
    worker_notes: "",
    license_requirement: "nessuna",
    tattoos_allowed: "indifferente",
    piercings_allowed: "indifferente",
    beard_allowed: "solo_curata",
    dress_code_notes: "",
  });

  const coords = useMemo(() => {
    const lat = Number(f.latitude);
    const lng = Number(f.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && f.latitude !== "" && f.longitude !== "" ? { lat, lng } : null;
  }, [f.latitude, f.longitude]);

  const durationHours = useMemo(
    () => durationFromDateTimes(f.shift_date, f.start_time, f.end_date || f.shift_date, f.end_time),
    [f.shift_date, f.end_date, f.start_time, f.end_time],
  );
  const crossesMidnight = useMemo(() => {
    if (!f.shift_date || !f.end_date) return false;
    return f.end_date !== f.shift_date;
  }, [f.shift_date, f.end_date]);
  const sameDayEndBeforeStart = useMemo(() => {
    if (!f.shift_date || !f.end_date || f.shift_date !== f.end_date) return false;
    if (!f.start_time || !f.end_time) return false;
    return f.end_time <= f.start_time;
  }, [f.shift_date, f.end_date, f.start_time, f.end_time]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setF(prev => ({ ...prev, [key]: value }));
  // Auto-fill end_date when start_date is selected/changed (only if empty or same as previous start)
  useEffect(() => {
    if (!f.shift_date) return;
    setF(prev => {
      if (!prev.end_date || prev.end_date < prev.shift_date) {
        return { ...prev, end_date: prev.shift_date };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.shift_date]);
  const toggleIn = (arr: string[], v: string, setter: (v: string[]) => void) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    const contactName = [p.contact_person_first_name, p.contact_person_last_name].filter(Boolean).join(" ");
    setF(prev => ({
      ...prev,
      restaurant_name: prev.restaurant_name || p.business_name || p.full_name || "",
      address: prev.address || p.address || [p.street, p.street_number].filter(Boolean).join(" ") || "",
      city: prev.city || p.city || "",
      district: prev.district || p.neighborhood || "",
      province: prev.province || p.province || "",
      postal_code: prev.postal_code || p.postal_code || "",
      country: prev.country || p.country || "Italia",
      latitude: prev.latitude || String(p.latitude ?? p.service_area_lat ?? ""),
      longitude: prev.longitude || String(p.longitude ?? p.service_area_lng ?? ""),
      access_restrictions: prev.access_restrictions || p.access_restrictions || "",
      additional_directions: prev.additional_directions || p.additional_directions || "",
      contact_person_name: prev.contact_person_name || contactName,
      contact_person_phone: prev.contact_person_phone || p.contact_person_phone || p.phone || "",
      contact_person_email: prev.contact_person_email || p.contact_person_email || p.email || "",
      contact_person_role: prev.contact_person_role || p.contact_person_role || "",
      contact_person_role_other: prev.contact_person_role_other || p.contact_person_role_other || "",
      worker_notes: prev.worker_notes || p.location_notes || "",
      license_requirement: p.default_license_requirement ?? prev.license_requirement,
      tattoos_allowed: p.default_tattoos_allowed ?? prev.tattoos_allowed,
      piercings_allowed: p.default_piercings_allowed ?? prev.piercings_allowed,
      beard_allowed: p.default_beard_allowed ?? prev.beard_allowed,
      dress_code_notes: prev.dress_code_notes || p.default_dress_code_notes || "",
    }));
    setLanguageReqs(prev => prev.length ? prev : (p.default_language_requirements ?? []));
    setSkills(prev => prev.length ? prev : (p.default_required_skills ?? []));
    setDressItems(prev => prev.length ? prev : (p.default_dress_code_items ?? []));
    if (!defaultsLoaded && hasSavedDefaults(p)) {
      toast.info("Abbiamo caricato le tue impostazioni predefinite. Puoi modificarle per questo annuncio.");
    }
    setDefaultsLoaded(true);
  }, [profile]);

  useEffect(() => {
    if (!reuse) return;
    (async () => {
      const { data } = await supabase.from("announcements").select("*").eq("id", reuse).maybeSingle();
      if (!data) return;
      const start = data.service_time?.slice(0, 5) ?? "19:00";
      const hours = Number(data.duration_hours ?? 4);
      const [sh, sm] = start.split(":").map(Number);
      const endMinutes = sh * 60 + sm + Math.round(hours * 60);
      const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      setF(prev => ({
        ...prev,
        role_required: data.professional_profile || prev.role_required,
        title: data.professional_profile || prev.role_required || prev.title,
        shift_date: "",
        end_date: "",
        start_time: start,
        end_time: end,
        hourly_rate: String(data.tariff_amount ?? prev.hourly_rate),
        address: data.location_address ?? prev.address,
        latitude: String((data as any).job_latitude ?? data.location_lat ?? prev.latitude),
        longitude: String((data as any).job_longitude ?? data.location_lng ?? prev.longitude),
        operational_notes: (data as any).notes ?? prev.operational_notes,
        license_requirement: (data as any).license_requirement ?? prev.license_requirement,
        tattoos_allowed: (data as any).tattoos_allowed ?? prev.tattoos_allowed,
        piercings_allowed: (data as any).piercings_allowed ?? prev.piercings_allowed,
        beard_allowed: (data as any).beard_allowed ?? prev.beard_allowed,
        dress_code_notes: (data as any).dress_code_notes ?? prev.dress_code_notes,
        city: (data as any).job_city ?? prev.city,
        province: (data as any).job_province ?? prev.province,
        postal_code: (data as any).job_postal_code ?? prev.postal_code,
        country: (data as any).job_country ?? prev.country,
        access_restrictions: (data as any).job_access_restrictions ?? prev.access_restrictions,
        additional_directions: (data as any).job_additional_directions ?? prev.additional_directions,
        worker_notes: (data as any).job_location_notes ?? prev.worker_notes,
        contact_person_name: (data as any).job_contact_person_name ?? prev.contact_person_name,
        contact_person_phone: (data as any).job_contact_person_phone ?? prev.contact_person_phone,
        contact_person_email: (data as any).job_contact_person_email ?? prev.contact_person_email,
      }));
      setLanguageReqs((data as any).language_requirements ?? []);
      setSkills((data as any).required_skills ?? []);
      setDressItems((data as any).dress_code_items ?? []);
    })();
  }, [reuse]);

  const runGeocode = async () => {
    const address = [f.address, f.city, f.province, f.country].filter(Boolean).join(", ");
    if (address.trim().length < 5) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGeoState({ status: "loading", attempt: 1 });
    const result = await geocodeAddressWithRetry(address, {
      maxAttempts: 3,
      signal: ctrl.signal,
      onAttempt: attempt => setGeoState(state => ({ ...state, status: "loading", attempt })),
    });
    if (ctrl.signal.aborted) return;
    if (result.ok) {
      setF(prev => ({ ...prev, latitude: String(result.lat), longitude: String(result.lng) }));
      setGeoState({ status: "ok", attempt: 0 });
    } else if (result.error.kind !== "aborted") {
      setGeoState({ status: "error", attempt: 0, error: result.error });
    }
  };

  // Auto-geocode silently when address fields change (debounced).
  // Replaces the manual "Trova coordinate" button.
  useEffect(() => {
    const address = [f.address, f.city, f.province, f.country].filter(Boolean).join(", ");
    if (address.trim().length < 5) return;
    const t = setTimeout(() => { void runGeocode(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.address, f.city, f.province, f.country]);

  const validate = () => {
    if (!user) return false;
    if (!f.role_required) { toast.error("Seleziona il ruolo cercato."); return false; }
    if (!f.shift_date) { toast.error("Inserisci la data di inizio turno."); return false; }
    if (!f.start_time) { toast.error("Inserisci l'orario di inizio turno."); return false; }
    if (!f.end_date) { toast.error("Inserisci la data di fine turno."); return false; }
    if (!f.end_time) { toast.error("Inserisci l'orario di fine turno."); return false; }
    if (durationHours <= 0) { toast.error("La fine del turno deve essere successiva all'inizio."); return false; }
    if (!f.hourly_rate || Number(f.hourly_rate) <= 0) { toast.error("Inserisci la tariffa oraria proposta"); return false; }
    if (!f.address.trim()) { toast.error("Inserisci l'indirizzo del turno"); return false; }
    if (f.province && f.city && !isCityInProvince(f.city, f.province)) {
      toast.error("La città selezionata non appartiene alla provincia scelta.");
      return false;
    }
    if (!f.contact_person_role) { toast.error("Seleziona il ruolo del referente."); return false; }
    if (f.contact_person_role === "Altro" && !f.contact_person_role_other.trim()) {
      toast.error("Specifica il ruolo del referente.");
      return false;
    }
    if (f.contact_person_email && !isValidEmail(f.contact_person_email)) {
      toast.error("Inserisci un indirizzo email valido.");
      return false;
    }
    return true;
  };

  const save = async (status: "bozza" | "pubblicato") => {
    if (!validate() || !user) return;
    setBusy(true);
    const announcementStatus = status === "pubblicato" ? "active" : "draft";
    const locationAddress = [f.address, f.district, f.city, f.province, f.postal_code, f.country].filter(Boolean).join(", ");
    const announcementPayload = {
      restaurant_id: user.id,
      service_date: f.shift_date,
      service_time: f.start_time,
      end_date: f.end_date || f.shift_date,
      end_time: f.end_time,
      duration_hours: durationHours,
      speed: "normal" as const,
      tariff_type: "hourly" as const,
      tariff_amount: Number(f.hourly_rate),
      location_address: locationAddress,
      location_lat: coords?.lat ?? null,
      location_lng: coords?.lng ?? null,
      professional_profile: f.role_required,
      languages: splitLanguages(languageReqs),
      notes: f.operational_notes || null,
      status: announcementStatus as "draft" | "active",
      license_requirement: f.license_requirement,
      language_requirements: languageReqs,
      tattoos_allowed: f.tattoos_allowed,
      piercings_allowed: f.piercings_allowed,
      beard_allowed: f.beard_allowed,
      required_skills: skills,
      dress_code_items: dressItems,
      dress_code_notes: f.dress_code_notes || null,
      job_address: f.address,
      job_city: f.city || null,
      job_province: f.province || null,
      job_postal_code: f.postal_code || null,
      job_country: f.country || null,
      job_latitude: coords?.lat ?? null,
      job_longitude: coords?.lng ?? null,
      job_access_restrictions: f.access_restrictions || null,
      job_additional_directions: f.additional_directions || null,
      job_location_notes: f.worker_notes || null,
      job_contact_person_name: f.contact_person_name || null,
      job_contact_person_phone: f.contact_person_phone || null,
      job_contact_person_email: f.contact_person_email || null,
    };

    const { data: announcement, error: announcementError } = await supabase
      .from("announcements")
      .insert(announcementPayload as any)
      .select("id")
      .single();

    if (announcementError || !announcement?.id) {
      setBusy(false);
      toast.error(announcementError?.message || "Impossibile salvare l'annuncio");
      return;
    }

    const jobRequestPayload = {
      restaurant_profile_id: user.id,
      restaurant_id: user.id,
      user_id: user.id,
      announcement_id: announcement.id,
      title: f.role_required,
      role_required: f.role_required,
      workers_needed: Number(f.workers_needed || 1),
      description: null,
      tasks: null,
      shift_date: f.shift_date,
      end_date: f.end_date || f.shift_date,
      start_time: f.start_time,
      end_time: f.end_time,
      hourly_rate: Number(f.hourly_rate),
      break_included: f.break_included,
      operational_notes: f.operational_notes || null,
      status,
      restaurant_name: f.restaurant_name || null,
      address: f.address,
      city: f.city || null,
      district: f.district || null,
      province: f.province || null,
      postal_code: f.postal_code || null,
      country: f.country || "Italia",
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      access_restrictions: f.access_restrictions || null,
      additional_directions: f.additional_directions || null,
      contact_person_name: f.contact_person_name || null,
      contact_person_phone: f.contact_person_phone || null,
      contact_person_email: f.contact_person_email || null,
      contact_person_role: f.contact_person_role || null,
      contact_person_role_other:
        f.contact_person_role === "Altro" ? f.contact_person_role_other.trim() || null : null,
      worker_notes: f.worker_notes || null,
      license_requirement: f.license_requirement,
      language_requirements: languageReqs,
      tattoos_allowed: f.tattoos_allowed,
      piercings_allowed: f.piercings_allowed,
      beard_allowed: f.beard_allowed,
      required_skills: skills,
      dress_code_items: dressItems,
      dress_code_notes: f.dress_code_notes || null,
    };

    const { error: jobRequestError } = await (supabase as any).from("job_requests").insert(jobRequestPayload);
    if (jobRequestError) {
      await supabase.from("announcements").delete().eq("id", announcement.id);
      setBusy(false);
      toast.error(jobRequestError.message || "Annuncio non salvato nella tabella job_requests");
      return;
    }

    setBusy(false);
    toast.success(status === "bozza" ? "Bozza salvata correttamente" : "Annuncio pubblicato correttamente");

    if (saveAsDefault) {
      const update = buildDefaultsUpdate({
        location: {
          address: f.address, city: f.city, district: f.district, province: f.province,
          postal_code: f.postal_code, country: f.country,
          latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
          access_restrictions: f.access_restrictions,
          additional_directions: f.additional_directions,
          location_notes: f.worker_notes,
          contact_person_name: f.contact_person_name,
          contact_person_phone: f.contact_person_phone,
          contact_person_email: f.contact_person_email,
        },
        requirements: {
          license_requirement: f.license_requirement,
          language_requirements: languageReqs,
          tattoos_allowed: f.tattoos_allowed,
          piercings_allowed: f.piercings_allowed,
          beard_allowed: f.beard_allowed,
          required_skills: skills,
          dress_code_items: dressItems,
          dress_code_notes: f.dress_code_notes,
        },
        venue: {
          venue_type: (profile as any)?.venue_type ?? null,
          venue_type_other: (profile as any)?.venue_type_other ?? null,
          price_range: (profile as any)?.price_range ?? null,
        },
      });
      const { error: defErr } = await supabase.from("profiles").update(update as any).eq("id", user.id);
      if (defErr) toast.error("Annuncio salvato, ma impostazioni predefinite non aggiornate: " + defErr.message);
      else toast.success("Annuncio salvato e impostazioni predefinite aggiornate.");
    }

    nav({ to: "/announcements" });
  };

  const requestSave = (status: "bozza" | "pubblicato") => {
    if (!validate() || !user) return;
    if (saveAsDefault) {
      pendingStatusRef.current = status;
      setConfirmDefaultsOpen(true);
      return;
    }
    void save(status);
  };

  const confirmAndSave = () => {
    const s = pendingStatusRef.current;
    setConfirmDefaultsOpen(false);
    pendingStatusRef.current = null;
    if (s) void save(s);
  };

  const showPreview = () => {
    setPreviewVisible(true);
    requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Solo i ristoratori possono creare annunci.</p></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader
        title="Crea Nuovo Annuncio"
        subtitle="Compila la richiesta di personale e pubblicala quando è pronta."
        action={<Link to="/announcements"><Button variant="outline" className="gap-2"><X className="h-4 w-4" />Torna agli annunci</Button></Link>}
      />

      <form className="mx-auto max-w-5xl space-y-6" onSubmit={(e) => e.preventDefault()}>
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <SectionTitle number="1" title="Informazioni principali" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Ruolo cercato">
              <Select value={f.role_required} onValueChange={v => { setField("role_required", v); setField("title", v); }}>
                <SelectTrigger><SelectValue placeholder="Seleziona ruolo" /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Numero lavoratori richiesti"><Input type="number" min="1" value={f.workers_needed} onChange={e => setField("workers_needed", e.target.value)} /></Field>
            <Field label="Tariffa oraria proposta"><Input type="number" min="1" step="0.5" value={f.hourly_rate} onChange={e => setField("hourly_rate", e.target.value)} /></Field>
            <Field label="Data inizio turno"><Input type="date" required value={f.shift_date} onChange={e => setField("shift_date", e.target.value)} /></Field>
            <Field label="Ora inizio turno"><Input type="time" required value={f.start_time} onChange={e => setField("start_time", e.target.value)} /></Field>
            <Field label="Data fine turno">
              <Input type="date" required min={f.shift_date || undefined} value={f.end_date} onChange={e => setField("end_date", e.target.value)} />
            </Field>
            <Field label="Ora fine turno"><Input type="time" required value={f.end_time} onChange={e => setField("end_time", e.target.value)} /></Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Se il turno termina dopo la mezzanotte, seleziona come data fine il giorno successivo.
          </p>
          {sameDayEndBeforeStart && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div className="flex-1">
                Il turno sembra terminare dopo mezzanotte. Vuoi impostare la data fine al giorno successivo?
              </div>
              <button
                type="button"
                className="rounded-md border border-amber-500/40 bg-background px-2 py-1 text-xs font-medium hover:bg-amber-500/10"
                onClick={() => setField("end_date", addDays(f.shift_date, 1))}
              >
                Imposta giorno successivo
              </button>
            </div>
          )}
          {crossesMidnight && durationHours > 0 && (
            <p className="text-xs text-primary">Turno notturno · {durationHours}h totali</p>
          )}
          <div className="hidden">
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <SectionTitle number="2" title="Luogo e accesso" subtitle="Precompilato dal profilo ristoratore, modificabile per questo singolo annuncio." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome locale"><Input value={f.restaurant_name} onChange={e => setField("restaurant_name", e.target.value)} /></Field>
            <Field label="Indirizzo"><Input required value={f.address} onChange={e => setField("address", e.target.value)} /></Field>
            <Field label="Provincia">
              <select
                value={f.province}
                onChange={(e) => { setField("province", e.target.value); setField("city", ""); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleziona provincia</option>
                {ITALIAN_LOCATIONS.map((p) => <option key={p.province_code} value={p.province}>{p.province} ({p.province_code})</option>)}
              </select>
            </Field>
            <Field label="Città">
              <select
                value={f.city}
                disabled={!f.province}
                onChange={(e) => setField("city", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">{f.province ? "Seleziona città" : "Seleziona prima la provincia"}</option>
                {citiesForProvince(f.province).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Zona/quartiere"><Input value={f.district} onChange={e => setField("district", e.target.value)} /></Field>
            <Field label="CAP"><Input value={f.postal_code} onChange={e => setField("postal_code", e.target.value)} /></Field>
            <Field label="Paese"><Input value={f.country} onChange={e => setField("country", e.target.value)} /></Field>
          </div>
          <GeoStatus state={geoState} />
          {coords && <AnnouncementMap lat={coords.lat} lng={coords.lng} address={f.address} height={220} />}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Restrizioni all’ingresso"><Textarea rows={2} value={f.access_restrictions} onChange={e => setField("access_restrictions", e.target.value)} /></Field>
            <Field label="Indicazioni aggiuntive"><Textarea rows={2} value={f.additional_directions} onChange={e => setField("additional_directions", e.target.value)} /></Field>
            <Field label="Referente operativo"><Input value={f.contact_person_name} onChange={e => setField("contact_person_name", e.target.value)} /></Field>
            <Field label="Ruolo del referente">
              <Select value={f.contact_person_role} onValueChange={(v) => setField("contact_person_role", v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona ruolo referente" /></SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {f.contact_person_role === "Altro" && (
                <Input
                  className="mt-2"
                  placeholder="Specifica ruolo referente"
                  value={f.contact_person_role_other}
                  onChange={(e) => setField("contact_person_role_other", e.target.value)}
                />
              )}
            </Field>
            <Field label="Telefono referente">
              {(() => {
                const split = splitPhone(f.contact_person_phone);
                return (
                  <PhoneInput
                    code={split.code}
                    number={split.number}
                    onCodeChange={(c) => setField("contact_person_phone", buildPhoneFull(c, split.number))}
                    onNumberChange={(n) => setField("contact_person_phone", buildPhoneFull(split.code, n))}
                  />
                );
              })()}
            </Field>
            <Field label="Email referente">
              <Input
                type="email"
                placeholder="esempio@email.com"
                value={f.contact_person_email}
                onChange={e => setField("contact_person_email", e.target.value)}
              />
              {f.contact_person_email && !isValidEmail(f.contact_person_email) && (
                <p className="text-xs text-destructive mt-1">Inserisci un indirizzo email valido.</p>
              )}
            </Field>
            <Field label="Note per il lavoratore"><Textarea rows={2} value={f.worker_notes} onChange={e => setField("worker_notes", e.target.value)} /></Field>
          </div>
          <SaveDefaultToggle checked={saveAsDefault} onChange={setSaveAsDefault} />
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <SectionTitle number="3" title="Requisiti e Competenze" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo di patente"><Select value={f.license_requirement} onValueChange={v => setField("license_requirement", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LICENSE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Tatuaggi ammessi"><Select value={f.tattoos_allowed} onValueChange={v => setField("tattoos_allowed", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TATTOO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Piercing ammessi"><Select value={f.piercings_allowed} onValueChange={v => setField("piercings_allowed", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PIERCING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Barba ammessa"><Select value={f.beard_allowed} onValueChange={v => setField("beard_allowed", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BEARD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <ChoiceGroup title="Lingue richieste" items={LANGUAGE_OPTIONS} selected={languageReqs} onToggle={v => toggleIn(languageReqs, v, setLanguageReqs)} />
          <ChoiceGroup title="Competenze richieste" items={SKILL_OPTIONS} selected={skills} onToggle={v => toggleIn(skills, v, setSkills)} />
          <SaveDefaultToggle checked={saveAsDefault} onChange={setSaveAsDefault} />
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <SectionTitle number="4" title="Dress Code" />
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {DRESS_CODE_OPTIONS.map(o => {
              const Icon = o.icon;
              const active = dressItems.includes(o.value);
              return (
                <button key={o.value} type="button" onClick={() => toggleIn(dressItems, o.value, setDressItems)} className={`min-h-28 rounded-xl border p-3 text-center transition ${active ? "border-primary bg-primary/10" : "bg-card hover:bg-accent"}`}>
                  <Icon className={`mx-auto mb-2 h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm leading-tight">{o.label}</span>
                </button>
              );
            })}
          </div>
          <Field label="Note aggiuntive sul dress code"><Textarea rows={3} value={f.dress_code_notes} onChange={e => setField("dress_code_notes", e.target.value)} /></Field>
          <SaveDefaultToggle checked={saveAsDefault} onChange={setSaveAsDefault} />
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <SectionTitle number="5" title="Dettagli aggiuntivi del turno" />
          <Field label="Pausa prevista durante il turno?">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.break_included} onCheckedChange={v => setField("break_included", !!v)} />
              Sì, è prevista una pausa
            </label>
          </Field>
          <Field label="Note operative"><Textarea rows={3} value={f.operational_notes} onChange={e => setField("operational_notes", e.target.value)} /></Field>
        </section>

        {previewVisible && (
          <section ref={previewRef} className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionTitle number="6" title="Anteprima annuncio" />
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <PreviewItem label="Ruolo cercato" value={f.role_required || "—"} />
              <PreviewItem label="Data e orario" value={formatShiftRange(f.shift_date, f.start_time, f.end_date || f.shift_date, f.end_time)} />
              <PreviewItem label="Luogo" value={[f.restaurant_name, f.address, f.city].filter(Boolean).join(" · ") || "—"} />
              <PreviewItem label="Tariffa" value={f.hourly_rate ? `€${f.hourly_rate}/h` : "—"} />
              <PreviewItem label="Requisiti" value={[labelOf(f.license_requirement, LICENSE_OPTIONS), ...splitLanguages(languageReqs), ...labelsOf(skills, SKILL_OPTIONS)].filter(Boolean).join(" · ") || "—"} />
              <PreviewItem label="Dress code" value={[...labelsOf(dressItems, DRESS_CODE_OPTIONS), f.dress_code_notes].filter(Boolean).join(" · ") || "—"} />
              <PreviewItem label="Note operative" value={f.operational_notes || f.worker_notes || "—"} wide />
            </div>
          </section>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:justify-end">
            <Link to="/announcements" className="sm:mr-auto"><Button type="button" variant="ghost" className="w-full gap-2" disabled={busy}><X className="h-4 w-4" />Annulla</Button></Link>
            <Link to="/announcements"><Button type="button" variant="outline" className="w-full">Torna agli annunci</Button></Link>
            <Button type="button" variant="outline" className="gap-2" onClick={showPreview}><Eye className="h-4 w-4" />Anteprima</Button>
            <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => requestSave("bozza")}><Save className="h-4 w-4" />Salva bozza</Button>
            <Button type="button" className="gap-2" disabled={busy} onClick={() => requestSave("pubblicato")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Pubblica annuncio</Button>
          </div>
        </div>
      </form>
      <AlertDialog open={confirmDefaultsOpen} onOpenChange={setConfirmDefaultsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salva come impostazioni predefinite?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasSavedDefaults(profile)
                ? "Hai già impostazioni predefinite salvate. Vuoi aggiornarle con i dati di questo annuncio? Gli annunci già pubblicati non verranno modificati."
                : "Vuoi salvare questi dati come impostazioni predefinite per i prossimi annunci?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { pendingStatusRef.current = null; }}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSave}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{number}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ChoiceGroup({ title, items, selected, onToggle }: { title: string; items: readonly { value: string; label: string }[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => {
          const active = selected.includes(item.value);
          return (
            <label key={item.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${active ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
              <Checkbox checked={active} onCheckedChange={() => onToggle(item.value)} />
              <span>{item.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PreviewItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border bg-muted/30 p-3 ${wide ? "md:col-span-2" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 whitespace-pre-wrap font-medium">{value}</div>
    </div>
  );
}

function SaveDefaultToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>Salva queste impostazioni come predefinite per i prossimi annunci</span>
    </label>
  );
}

function GeoStatus({ state }: { state: { status: "idle" | "loading" | "ok" | "error"; attempt: number; error?: GeocodeError } }) {
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" />Ricerca coordinate{state.attempt > 1 ? ` · tentativo ${state.attempt}/3` : ""}</div>;
  }
  if (state.status === "ok") {
    return <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"><CheckCircle2 className="h-3 w-3" />Coordinate aggiornate</div>;
  }
  return <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Coordinate non disponibili. L'indirizzo verrà comunque salvato.</span></div>;
}
