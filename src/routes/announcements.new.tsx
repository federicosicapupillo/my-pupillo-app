import { PayOnHireBox } from "@/components/PayOnHireInfo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RestaurantProfileGate } from "@/components/RestaurantProfileGate";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AnnouncementMap } from "@/components/AnnouncementMap";
import { geocodeAddressWithRetry, type GeocodeError } from "@/lib/geocode";
import { useEffect, useRef } from "react";
import { AlertCircle, Coins } from "lucide-react";
import { consumeCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/pricing";
import { Link } from "@tanstack/react-router";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LICENSE_OPTIONS, LANGUAGE_OPTIONS, TATTOO_OPTIONS, PIERCING_OPTIONS,
  BEARD_OPTIONS, SKILL_OPTIONS, DRESS_CODE_OPTIONS,
} from "@/lib/announcement-requirements";
import { isValidCapForCity } from "@/lib/italian-locations";
import { CapField } from "@/components/CapField";
import { DateField } from "@/components/DateField";
import { HourlyRateInput } from "@/components/HourlyRateInput";
import { scrollToField } from "@/lib/form-field-validation";
import { useProfileGate } from "@/components/ProfileGate";

export const Route = createFileRoute("/announcements/new")({
  head: () => ({ meta: [{ title: "Nuovo annuncio — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ reuse: typeof s.reuse === "string" ? s.reuse : undefined }),
  component: () => (
    <RequireAuth>
      <RestaurantProfileGate>
        <NewAnn />
      </RestaurantProfileGate>
    </RequireAuth>
  ),
});

function NewAnn() {
  const { user, role, profile } = useAuth();
  const nav = useNavigate();
  const { requireComplete } = useProfileGate();
  const { reuse } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{ id: string; date: string; start: string; end: string; label: string }>>([]);
  const [geoState, setGeoState] = useState<{ status: "idle" | "loading" | "ok" | "error"; attempt: number; error?: GeocodeError }>({ status: "idle", attempt: 0 });
  const [accessChoice, setAccessChoice] = useState<"" | "15" | "over15">("");
  const [accessReason, setAccessReason] = useState("");
  const [f, setF] = useState({
    service_date: "", service_time: "19:00", duration_hours: "4",
    speed: "normal", tariff_type: "hourly", tariff_amount: "12",
    location_address: profile?.address ?? "", professional_profile: "",
    languages: "", notes: "",
    license_requirement: "nessuna",
    tattoos_allowed: "indifferente",
    piercings_allowed: "indifferente",
    beard_allowed: "solo_curata",
    dress_code_notes: "",
    job_city: (profile as any)?.city ?? "",
    job_province: (profile as any)?.province ?? "",
    job_postal_code: (profile as any)?.postal_code ?? "",
    job_country: (profile as any)?.country ?? "Italia",
    job_access_restrictions: (profile as any)?.access_restrictions ?? "",
    job_additional_directions: (profile as any)?.additional_directions ?? "",
    job_location_notes: (profile as any)?.location_notes ?? "",
    job_contact_person_name: [
      (profile as any)?.contact_person_first_name,
      (profile as any)?.contact_person_last_name,
    ].filter(Boolean).join(" "),
    job_contact_person_phone: (profile as any)?.contact_person_phone ?? "",
    job_contact_person_email: (profile as any)?.contact_person_email ?? "",
  });
  const [languageReqs, setLanguageReqs] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [dressItems, setDressItems] = useState<string[]>([]);

  const toggleIn = (arr: string[], v: string, setter: (v: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const abortRef = useRef<AbortController | null>(null);

  // Precompila i campi dal profilo ristoratore quando diventa disponibile
  // (lo state iniziale viene creato prima che `profile` sia caricato dall'auth context).
  // Non sovrascriviamo valori già editati dall'utente.
  useEffect(() => {
    if (!profile) return;
    setF((prev) => ({
      ...prev,
      location_address: prev.location_address || (profile as any).address || "",
      job_city: prev.job_city || (profile as any).city || "",
      job_province: prev.job_province || (profile as any).province || "",
      job_postal_code: prev.job_postal_code || (profile as any).postal_code || "",
      job_country: prev.job_country || (profile as any).country || "Italia",
      job_access_restrictions: prev.job_access_restrictions || (profile as any).access_restrictions || "",
      job_additional_directions: prev.job_additional_directions || (profile as any).additional_directions || "",
      job_location_notes: prev.job_location_notes || (profile as any).location_notes || "",
      job_contact_person_name: prev.job_contact_person_name || [
        (profile as any).contact_person_first_name,
        (profile as any).contact_person_last_name,
      ].filter(Boolean).join(" "),
      job_contact_person_phone: prev.job_contact_person_phone || (profile as any).contact_person_phone || "",
      job_contact_person_email: prev.job_contact_person_email || (profile as any).contact_person_email || "",
      // Requisiti standard del locale
      license_requirement: (profile as any).default_license_requirement ?? prev.license_requirement,
      tattoos_allowed: (profile as any).default_tattoos_allowed ?? prev.tattoos_allowed,
      piercings_allowed: (profile as any).default_piercings_allowed ?? prev.piercings_allowed,
      beard_allowed: (profile as any).default_beard_allowed ?? prev.beard_allowed,
      dress_code_notes: prev.dress_code_notes || (profile as any).default_dress_code_notes || "",
    }));
    setLanguageReqs((prev) => prev.length ? prev : ((profile as any).default_language_requirements ?? []));
    setSkills((prev) => prev.length ? prev : ((profile as any).default_required_skills ?? []));
    setDressItems((prev) => prev.length ? prev : ((profile as any).default_dress_code_items ?? []));
  }, [profile]);

  useEffect(() => {
    if (!reuse) return;
    (async () => {
      const { data } = await supabase.from("announcements").select("*").eq("id", reuse).maybeSingle();
      if (!data) return;
      setF((prev) => ({
        ...prev,
        service_date: (() => {
          const d = data.service_date as string | null;
          if (!d) return prev.service_date;
          const today = new Date(); today.setHours(0,0,0,0);
          const sd = new Date(`${d}T00:00:00`);
          return !isNaN(sd.getTime()) && sd.getTime() >= today.getTime() ? d : prev.service_date;
        })(),
        service_time: data.service_time?.slice(0, 5) ?? prev.service_time,
        duration_hours: String(data.duration_hours ?? prev.duration_hours),
        speed: data.speed ?? prev.speed,
        tariff_type: data.tariff_type ?? prev.tariff_type,
        tariff_amount: String(data.tariff_amount ?? prev.tariff_amount),
        location_address: data.location_address ?? prev.location_address,
        professional_profile: data.professional_profile ?? "",
        languages: (data.languages ?? []).join(", "),
        notes: (data as any).notes ?? "",
        license_requirement: (data as any).license_requirement ?? prev.license_requirement,
        tattoos_allowed: (data as any).tattoos_allowed ?? prev.tattoos_allowed,
        piercings_allowed: (data as any).piercings_allowed ?? prev.piercings_allowed,
        beard_allowed: (data as any).beard_allowed ?? prev.beard_allowed,
        dress_code_notes: (data as any).dress_code_notes ?? "",
        job_city: (data as any).job_city ?? prev.job_city,
        job_province: (data as any).job_province ?? prev.job_province,
        job_postal_code: (data as any).job_postal_code ?? prev.job_postal_code,
        job_country: (data as any).job_country ?? prev.job_country,
        job_access_restrictions: (data as any).job_access_restrictions ?? prev.job_access_restrictions,
        job_additional_directions: (data as any).job_additional_directions ?? prev.job_additional_directions,
        job_location_notes: (data as any).job_location_notes ?? prev.job_location_notes,
        job_contact_person_name: (data as any).job_contact_person_name ?? prev.job_contact_person_name,
        job_contact_person_phone: (data as any).job_contact_person_phone ?? prev.job_contact_person_phone,
        job_contact_person_email: (data as any).job_contact_person_email ?? prev.job_contact_person_email,
      }));
      setLanguageReqs((data as any).language_requirements ?? []);
      setSkills((data as any).required_skills ?? []);
      setDressItems((data as any).dress_code_items ?? []);
      // Ripristina la scelta "anticipo all'ingresso" dal testo salvato sull'annuncio originale
      const restr = ((data as any).job_access_restrictions as string | null) ?? "";
      if (restr) {
        const m = restr.match(/Motivo:\s*(.+)$/i);
        if (/oltre\s*15/i.test(restr) || m) {
          setAccessChoice("over15");
          if (m && m[1]) setAccessReason(m[1].trim());
        } else if (/almeno\s*15/i.test(restr)) {
          setAccessChoice("15");
        }
      }
      if (data.location_lat != null && data.location_lng != null) {
        setCoords({ lat: data.location_lat, lng: data.location_lng });
        setGeoState({ status: "ok", attempt: 0 });
      }
    })();
  }, [reuse]);

  const runGeocode = async (addr: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGeoState({ status: "loading", attempt: 1 });
    const r = await geocodeAddressWithRetry(addr, {
      maxAttempts: 3,
      signal: ctrl.signal,
      onAttempt: (n) => setGeoState((s) => ({ ...s, status: "loading", attempt: n })),
    });
    if (ctrl.signal.aborted) return;
    if (r.ok) {
      setCoords({ lat: r.lat, lng: r.lng });
      setGeoState({ status: "ok", attempt: 0 });
    } else if (r.error.kind !== "aborted") {
      setCoords(null);
      setGeoState({ status: "error", attempt: 0, error: r.error });
    }
  };

  useEffect(() => {
    const addr = f.location_address.trim();
    if (addr.length < 5) {
      abortRef.current?.abort();
      setCoords(null);
      setGeoState({ status: "idle", attempt: 0 });
      return;
    }
    const t = setTimeout(() => { runGeocode(addr); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.location_address]);

  if (role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Solo i ristoratori possono creare annunci.</p></AppShell>;
  }

  const isUrgent = f.speed === "flash" || f.speed === "fast";
  const cost: number = isUrgent ? CREDIT_COSTS.publishUrgentAnnouncement : CREDIT_COSTS.publishAnnouncement;
  const credits = profile?.credits ?? 0;
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";
  const isFree = cost === 0;
  const canAfford = isPaid || isFree || credits >= cost;

  const save = async (asDraft: boolean) => {
    if (!user) return;
    if (!f.service_date) {
      toast.error("Inserisci la data del servizio");
      scrollToField("service_date");
      return;
    }
    const tariffNum = parseFloat(f.tariff_amount);
    if (!Number.isFinite(tariffNum) || tariffNum <= 0) {
      toast.error("Inserisci una tariffa oraria valida.");
      scrollToField("tariff_amount");
      return;
    }
    if (!accessChoice) {
      toast.error("Seleziona l'anticipo richiesto all'ingresso.");
      scrollToField("access_choice");
      return;
    }
    if (accessChoice === "over15" && accessReason.trim().length < 10) {
      toast.error("Inserisci una motivazione (minimo 10 caratteri) per l'anticipo oltre i 15 minuti.");
      scrollToField("access_reason");
      return;
    }
    if (f.job_province && f.job_city && f.job_postal_code && !isValidCapForCity(f.job_province, f.job_city, f.job_postal_code)) {
      toast.error("Il CAP non appartiene alla città selezionata.");
      scrollToField("job_postal_code");
      return;
    }
    const accessText = accessChoice === "15"
      ? "Presentarsi almeno 15 minuti prima del turno."
      : `Presentarsi oltre 15 minuti prima del turno. Motivo: ${accessReason.trim()}`;
    setBusy(true);
    // Consume credits only when publishing (not draft) AND when cost > 0.
    // Pubblicare è gratis: paghi solo alla conferma del lavoratore.
    if (!asDraft) {
      const isUrgentNow = f.speed === "flash" || f.speed === "fast";
      const costNow: number = isUrgentNow ? CREDIT_COSTS.publishUrgentAnnouncement : CREDIT_COSTS.publishAnnouncement;
      if (costNow > 0) {
        const ok = await consumeCredits(costNow, isUrgentNow ? "publish_urgent_announcement" : "publish_announcement");
        if (!ok) { setBusy(false); return; }
      }
    }
    const { data: inserted, error } = await supabase.from("announcements").insert({
      restaurant_id: user.id,
      service_date: f.service_date,
      service_time: f.service_time,
      duration_hours: parseFloat(f.duration_hours),
      speed: f.speed as "normal" | "fast" | "flash",
      tariff_type: f.tariff_type as "hourly" | "flat",
      tariff_amount: parseFloat(f.tariff_amount),
      location_address: f.location_address,
      location_lat: coords?.lat ?? null,
      location_lng: coords?.lng ?? null,
      professional_profile: f.professional_profile || null,
      languages: f.languages.split(",").map(s => s.trim()).filter(Boolean),
      notes: f.notes || null,
      status: asDraft ? "draft" : "active",
      license_requirement: f.license_requirement,
      language_requirements: languageReqs,
      tattoos_allowed: f.tattoos_allowed,
      piercings_allowed: f.piercings_allowed,
      beard_allowed: f.beard_allowed,
      required_skills: skills,
      dress_code_items: dressItems,
      dress_code_notes: f.dress_code_notes || null,
      job_address: f.location_address,
      job_city: f.job_city || null,
      job_province: f.job_province || null,
      job_postal_code: f.job_postal_code || null,
      job_country: f.job_country || null,
      job_latitude: coords?.lat ?? null,
      job_longitude: coords?.lng ?? null,
      job_access_restrictions: accessText,
      job_additional_directions: f.job_additional_directions || null,
      job_location_notes: f.job_location_notes || null,
      job_contact_person_name: f.job_contact_person_name || null,
      job_contact_person_phone: f.job_contact_person_phone || null,
      job_contact_person_email: f.job_contact_person_email || null,
      reused_from_announcement_id: reuse || null,
    } as any).select("id").maybeSingle();
    setBusy(false);
    if (error) {
      if (reuse) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          action: "republish_announcement",
          entity_type: "announcement",
          entity_id: reuse,
          metadata: {
            status: "failed",
            error: error.message,
            as_draft: asDraft,
            source_announcement_id: reuse,
          },
        } as any);
      }
      toast.error(error.message);
      return;
    }
    if (reuse) {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "republish_announcement",
        entity_type: "announcement",
        entity_id: inserted?.id ?? null,
        metadata: {
          status: "success",
          as_draft: asDraft,
          source_announcement_id: reuse,
          new_announcement_id: inserted?.id ?? null,
        },
      } as any);
    }
    if (asDraft) {
      toast.success("Bozza salvata", {
        description: "La trovi nella sezione \"Bozze\" dei tuoi annunci. Pubblicala quando vuoi renderla visibile.",
      });
    } else {
      toast.success("Annuncio pubblicato · stato: Attivo", {
        description: "Visibile subito nella tua dashboard, nell'elenco annunci, sulla mappa e ai lavoratori in zona.",
        duration: 6000,
      });
    }
    nav({ to: "/announcements" });
  };
  const checkConflicts = async () => {
    if (!user || !f.service_date || !f.service_time) return [] as typeof conflicts;
    const durHours = parseFloat(f.duration_hours) || 0;
    const [hh, mm] = f.service_time.split(":").map((x) => parseInt(x, 10));
    const startMin = (hh || 0) * 60 + (mm || 0);
    const endMin = startMin + Math.round(durHours * 60);
    const { data } = await supabase
      .from("announcements")
      .select("id,service_date,service_time,duration_hours,status,professional_profile")
      .eq("restaurant_id", user.id)
      .eq("service_date", f.service_date)
      .in("status", ["active", "assigned", "draft"]);
    const found: typeof conflicts = [];
    for (const a of data ?? []) {
      if (reuse && a.id === reuse) continue;
      const t = (a.service_time as string | null)?.slice(0, 5);
      if (!t) continue;
      const [ah, am] = t.split(":").map((x) => parseInt(x, 10));
      const aStart = (ah || 0) * 60 + (am || 0);
      const aEnd = aStart + Math.round((Number(a.duration_hours) || 0) * 60);
      const overlaps = aStart < endMin && aEnd > startMin;
      if (overlaps) {
        const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        found.push({
          id: a.id,
          date: a.service_date as string,
          start: fmt(aStart),
          end: fmt(aEnd),
          label: (a.professional_profile as string | null) || "Annuncio",
        });
      }
    }
    return found;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.service_date) { toast.error("Inserisci la data del servizio"); return; }
    if (!coords) { toast.error("Posizione non valida"); return; }
    const c = await checkConflicts();
    if (c.length > 0) {
      setConflicts(c);
      setConflictOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <AppShell>
      <PageHeader title="Nuovo annuncio" subtitle="Pubblica una richiesta di personale extra" />
      <PayOnHireBox className="mb-4 w-full max-w-5xl" compact />
      <div className={`mb-4 w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${canAfford ? "bg-card" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          {isPaid ? (
            <span>Piano <strong className="capitalize">{profile?.plan}</strong> attivo · pubblicazioni illimitate</span>
          ) : isFree ? (
            <span>Pubblicare è <strong>gratis</strong>. Paghi solo quando confermi un lavoratore. Saldo: <strong>{credits}</strong></span>
          ) : (
            <span>
              Costo pubblicazione: <strong>{cost} crediti</strong>{isUrgent && " (urgente)"} · Saldo: <strong>{credits}</strong>
            </span>
          )}
        </div>
        {!isPaid && !canAfford && (
          <Link to="/billing"><Button size="sm" variant="outline" type="button" className="gap-1"><AlertCircle className="h-3.5 w-3.5" />Acquista crediti</Button></Link>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          requireComplete(submit)(e);
        }}
        className="w-full max-w-5xl space-y-5 rounded-2xl border bg-card p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div data-field="service_date" className="scroll-mt-24">
            <Label>Data servizio</Label>
            <DateField value={f.service_date} onChange={(v) => setF({ ...f, service_date: v })} required />
          </div>
          <div><Label>Ora inizio</Label><Input type="time" required value={f.service_time} onChange={e => setF({ ...f, service_time: e.target.value })} /></div>
          <div><Label>Durata (ore)</Label><Input type="number" min="1" step="0.5" required value={f.duration_hours} onChange={e => setF({ ...f, duration_hours: e.target.value })} /></div>
          <div>
            <Label>Velocità ricerca</Label>
            <Select value={f.speed} onValueChange={v => setF({ ...f, speed: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normale (7 giorni)</SelectItem>
                <SelectItem value="fast">Veloce (24 ore)</SelectItem>
                <SelectItem value="flash">Flash (immediato)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo tariffa</Label>
            <Select value={f.tariff_type} onValueChange={v => setF({ ...f, tariff_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Oraria</SelectItem>
                <SelectItem value="flat">A servizio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div data-field="tariff_amount" className="scroll-mt-24">
            <Label>{f.tariff_type === "hourly" ? "Tariffa oraria" : "Importo (€)"}</Label>
            {f.tariff_type === "hourly" ? (
              <HourlyRateInput value={f.tariff_amount} onChange={(v) => setF({ ...f, tariff_amount: v })} required />
            ) : (
              <Input type="number" min="0.01" step="0.5" required value={f.tariff_amount} onChange={e => setF({ ...f, tariff_amount: e.target.value })} />
            )}
          </div>
        </div>
        <div>
          <Label>Indirizzo del servizio</Label>
          <Input required value={f.location_address} onChange={e => setF({ ...f, location_address: e.target.value })} />
          {coords && (
            <div className="mt-2"><AnnouncementMap lat={coords.lat} lng={coords.lng} address={f.location_address} /></div>
          )}
        </div>
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">📍 Luogo e Accesso <span className="text-xs font-normal text-muted-foreground">(precompilato dal profilo, modificabile per questo turno)</span></h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>Città</Label><Input value={f.job_city} onChange={e => setF({ ...f, job_city: e.target.value, job_postal_code: "" })} /></div>
            <div><Label>Provincia</Label><Input maxLength={3} value={f.job_province} onChange={e => setF({ ...f, job_province: e.target.value.toUpperCase(), job_city: "", job_postal_code: "" })} /></div>
            <div data-field="job_postal_code" className="scroll-mt-24">
              <Label>CAP</Label>
              <CapField
                province={f.job_province}
                city={f.job_city}
                value={f.job_postal_code}
                onChange={(v) => setF({ ...f, job_postal_code: v })}
              />
            </div>
          </div>
          <div className="space-y-2" data-field="access_choice">
            <Label className="scroll-mt-24">Anticipo richiesto all'ingresso</Label>
            <Select value={accessChoice} onValueChange={(v) => setAccessChoice(v as "15" | "over15")}>
              <SelectTrigger><SelectValue placeholder="Seleziona anticipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Minimo 15 minuti</SelectItem>
                <SelectItem value="over15">Oltre 15 minuti</SelectItem>
              </SelectContent>
            </Select>
            {accessChoice === "over15" && (
              <div data-field="access_reason" className="scroll-mt-24">
                <Label className="text-xs">Motivazione (obbligatoria)</Label>
                <Textarea rows={2} required placeholder="Spiega perché serve un anticipo superiore ai 15 minuti (es. accredito, briefing, vestizione)…" value={accessReason} onChange={e => setAccessReason(e.target.value)} />
              </div>
            )}
          </div>
          <div><Label>Indicazioni aggiuntive</Label><Textarea rows={2} placeholder="Es. Entrare dall'ingresso laterale" value={f.job_additional_directions} onChange={e => setF({ ...f, job_additional_directions: e.target.value })} /></div>
          <div><Label>Note per il lavoratore</Label><Textarea rows={2} value={f.job_location_notes} onChange={e => setF({ ...f, job_location_notes: e.target.value })} /></div>
          <div className="grid gap-3 md:grid-cols-3 pt-2 border-t">
            <div><Label>Referente operativo</Label><Input placeholder="Nome e cognome" value={f.job_contact_person_name} onChange={e => setF({ ...f, job_contact_person_name: e.target.value })} /></div>
            <div><Label>Telefono referente</Label><Input value={f.job_contact_person_phone} onChange={e => setF({ ...f, job_contact_person_phone: e.target.value })} /></div>
            <div><Label>Email referente</Label><Input type="email" value={f.job_contact_person_email} onChange={e => setF({ ...f, job_contact_person_email: e.target.value })} /></div>
          </div>
        </div>
        <div>
          <Label>Ruolo richiesto</Label>
          <Select value={f.professional_profile} onValueChange={v => setF({ ...f, professional_profile: v })}>
            <SelectTrigger><SelectValue placeholder="Seleziona un ruolo" /></SelectTrigger>
            <SelectContent>
              {["cameriere","bartender","chef","aiuto cucina","runner","lavapiatti","hostess","responsabile sala"].map(r => (
                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Lingue richieste</Label><Input placeholder="Italiano, Inglese" value={f.languages} onChange={e => setF({ ...f, languages: e.target.value })} /></div>
        <div>
          <Label>Note operative (opzionali)</Label>
          <Textarea rows={3} placeholder="Es. dress code nero, citofono lato cucina, chiedere di Marco…" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>

        <div className="border-t pt-5 space-y-5">
          <div>
            <h3 className="text-base font-semibold">Requisiti e Competenze</h3>
            <p className="text-xs text-muted-foreground">Indica requisiti operativi e disposizioni del turno. Saranno mostrati al lavoratore prima della candidatura.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Tipo di patente</Label>
              <Select value={f.license_requirement} onValueChange={v => setF({ ...f, license_requirement: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LICENSE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tatuaggi ammessi</Label>
              <Select value={f.tattoos_allowed} onValueChange={v => setF({ ...f, tattoos_allowed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TATTOO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Piercing ammessi</Label>
              <Select value={f.piercings_allowed} onValueChange={v => setF({ ...f, piercings_allowed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PIERCING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Barba ammessa</Label>
              <Select value={f.beard_allowed} onValueChange={v => setF({ ...f, beard_allowed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BEARD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Lingue richieste</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(o => {
                const active = languageReqs.includes(o.value);
                return (
                  <button type="button" key={o.value}
                    onClick={() => toggleIn(languageReqs, o.value, setLanguageReqs)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Competenze richieste</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SKILL_OPTIONS.map(o => {
                const active = skills.includes(o.value);
                return (
                  <label key={o.value} className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer ${active ? "bg-primary/10 border-primary/40" : "hover:bg-accent"}`}>
                    <Checkbox checked={active} onCheckedChange={() => toggleIn(skills, o.value, setSkills)} />
                    <span>{o.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Disposizioni dress code</Label>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              {DRESS_CODE_OPTIONS.map(o => {
                const Icon = o.icon;
                const active = dressItems.includes(o.value);
                return (
                  <button type="button" key={o.value}
                    onClick={() => toggleIn(dressItems, o.value, setDressItems)}
                    className={`flex flex-col items-center text-center gap-1.5 rounded-xl border p-2.5 transition ${active ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30" : "bg-card hover:bg-accent"}`}>
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] leading-tight">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Note aggiuntive sul dress code</Label>
            <Textarea rows={2} value={f.dress_code_notes}
              onChange={e => setF({ ...f, dress_code_notes: e.target.value })}
              placeholder="Es. Dress code come da descrizione, portare camicia bianca e pantalone nero." />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/announcements" className="sm:w-auto w-full">
            <Button type="button" variant="ghost" disabled={busy} className="w-full">Annulla</Button>
          </Link>
          <Button type="button" variant="outline" disabled={busy} onClick={requireComplete(()=>save(true))} className="sm:w-auto w-full">
            Salva come bozza
          </Button>
          <Button type="submit" disabled={busy || !canAfford} className="flex-1 gap-1">
            {busy ? "Pubblicazione…" : !canAfford ? "Crediti insufficienti" : (
              <>Pubblica annuncio {!isPaid && <span className="opacity-80">· {cost} <Coins className="inline h-3 w-3" /></span>}</>
            )}
          </Button>
        </div>
      </form>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />Conferma pubblicazione</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                {isPaid ? (
                  <p>Il tuo piano <strong className="capitalize">{profile?.plan}</strong> include pubblicazioni illimitate. Nessun credito verrà scalato.</p>
                ) : isFree ? (
                  <p>Pubblicare un annuncio è <strong>gratis</strong>. I crediti vengono scalati solo quando confermi definitivamente un lavoratore per il turno.</p>
                ) : (
                  <>
                    <p>Stai per pubblicare un annuncio{isUrgent ? " urgente" : ""}.</p>
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted-foreground">Costo pubblicazione</span><strong>{cost} crediti</strong></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Saldo attuale</span><strong>{credits}</strong></div>
                      <div className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">Saldo dopo</span><strong className={credits - cost < 0 ? "text-destructive" : ""}>{credits - cost}</strong></div>
                    </div>
                    {!canAfford && <p className="text-destructive text-sm">Crediti insufficienti. Acquista crediti per continuare.</p>}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            {!isPaid && !canAfford ? (
              <Link to="/billing"><Button>Acquista crediti</Button></Link>
            ) : (
              <AlertDialogAction disabled={busy} onClick={requireComplete(async () => { await save(false); setConfirmOpen(false); })}>
                {busy ? "Pubblicazione…" : "Conferma e pubblica"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Possibile conflitto di orari</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>Hai già {conflicts.length === 1 ? "un annuncio" : `${conflicts.length} annunci`} nello stesso giorno con orari che si sovrappongono a quelli precompilati ({f.service_time} · {f.duration_hours}h).</p>
                <ul className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
                  {conflicts.map((c) => (
                    <li key={c.id} className="flex justify-between gap-3">
                      <span className="truncate">{c.label}</span>
                      <strong className="whitespace-nowrap">{c.start}–{c.end}</strong>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-xs">Verifica gli orari prima di procedere per evitare doppie prenotazioni dello stesso lavoratore.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Modifica orari</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConflictOpen(false); setConfirmOpen(true); }}>
              Continua comunque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
