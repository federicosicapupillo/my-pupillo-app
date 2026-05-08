import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { geocodeAddressWithRetry } from "@/lib/geocode";
import { verifyVat } from "@/lib/vat.functions";
import { useServerFn } from "@tanstack/react-start";
import { RestaurantRequirementsEditor, EMPTY_REQ, reqFromProfile, reqToProfileUpdate, type RestaurantRequirements } from "@/components/RestaurantRequirements";
import { SpokenLanguagesEditor, normalizeSpokenLanguages, type SpokenLanguage } from "@/components/SpokenLanguages";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Completa il profilo — Pupillo" }] }),
  component: () => <RequireAuth><Onboarding /></RequireAuth>,
});

function Onboarding() {
  const { user, role, profile, refresh } = useAuth();
  const nav = useNavigate();
  const verifyVatFn = useServerFn(verifyVat);
  const [form, setForm] = useState({
    full_name: "", phone: "", age: "", professional_profile: "", languages: "",
    business_name: "", vat_number: "", venue_type: "", address: "", price_range: "",
    service_area_address: "", service_area_radius_m: "500",
    city: "", province: "", postal_code: "", country: "Italia",
    access_restrictions: "", additional_directions: "", location_notes: "",
    contact_person_first_name: "", contact_person_last_name: "", contact_person_role: "",
    contact_person_phone: "", contact_person_email: "",
    representative_age: "",
    terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [requirements, setRequirements] = useState<RestaurantRequirements>(EMPTY_REQ);
  const [spokenLanguages, setSpokenLanguages] = useState<SpokenLanguage[]>([]);
  const [vatChecking, setVatChecking] = useState(false);
  const [vatResult, setVatResult] = useState<{ status: string; message: string; companyName?: string | null } | null>(null);

  const vatDigits = form.vat_number.replace(/\D/g, "");
  const vatValid = vatDigits.length === 11;

  const handleVerifyVat = async () => {
    if (!vatValid) {
      toast.error("La Partita IVA deve contenere 11 cifre numeriche.");
      return;
    }
    setVatChecking(true);
    setVatResult(null);
    try {
      const r = await verifyVatFn({ data: { vat_number: vatDigits } });
      setVatResult({ status: r.status, message: r.message ?? "", companyName: r.companyName });
      if (r.status === "valid") {
        toast.success(r.message || "Partita IVA verificata");
        if (r.companyName && !form.business_name.trim()) {
          setForm((f) => ({ ...f, business_name: r.companyName as string }));
        }
      } else if ((r as any).duplicate) {
        toast.error(r.message);
      } else if (r.status === "invalid") {
        toast.error(r.message || "Partita IVA non valida");
      } else {
        toast.message(r.message || "Verifica non disponibile, formato valido.");
      }
    } catch (e: any) {
      toast.error("Verifica non riuscita");
    } finally {
      setVatChecking(false);
    }
  };

  useEffect(() => {
    if (profile) setForm((f) => ({
      ...f,
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      age: profile.age?.toString() ?? "",
      professional_profile: profile.professional_profile ?? "",
      languages: (profile.languages ?? []).join(", "),
      business_name: profile.business_name ?? "",
      vat_number: profile.vat_number ?? "",
      venue_type: profile.venue_type ?? "",
      address: profile.address ?? "",
      price_range: profile.price_range ?? "",
      service_area_radius_m: String(profile.service_area_radius_m ?? 500),
      city: (profile as any).city ?? "",
      province: (profile as any).province ?? "",
      postal_code: (profile as any).postal_code ?? "",
      country: (profile as any).country ?? "Italia",
      access_restrictions: (profile as any).access_restrictions ?? "",
      additional_directions: (profile as any).additional_directions ?? "",
      location_notes: (profile as any).location_notes ?? "",
      contact_person_first_name: (profile as any).contact_person_first_name ?? "",
      contact_person_last_name: (profile as any).contact_person_last_name ?? "",
      contact_person_role: (profile as any).contact_person_role ?? "",
      contact_person_phone: (profile as any).contact_person_phone ?? "",
      contact_person_email: (profile as any).contact_person_email ?? "",
      representative_age: (profile as any).representative_age != null ? String((profile as any).representative_age) : "",
      terms_accepted: profile.terms_accepted,
    }));
    if (profile) setRequirements(reqFromProfile(profile));
    if (profile) setSpokenLanguages(normalizeSpokenLanguages((profile as any).spoken_languages));
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.terms_accepted) { toast.error("Devi accettare le condizioni d'uso"); return; }
    if (role === "restaurant") {
      const age = Number(form.representative_age);
      if (!form.representative_age || isNaN(age) || age < 18 || age > 99) {
        toast.error("Seleziona l'età del referente. Devi avere almeno 18 anni per creare un account ristoratore.");
        return;
      }
      if (!vatValid) {
        toast.error("La Partita IVA deve contenere 11 cifre numeriche.");
        return;
      }
    }
    setBusy(true);
    let serviceArea: { service_area_lat: number | null; service_area_lng: number | null } = { service_area_lat: null, service_area_lng: null };
    let restCoords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
    if (role === "worker" && form.service_area_address.trim().length >= 3) {
      const r = await geocodeAddressWithRetry(form.service_area_address.trim(), { maxAttempts: 2 });
      if (r.ok) serviceArea = { service_area_lat: r.lat, service_area_lng: r.lng };
    }
    if (role === "restaurant" && form.address.trim().length >= 3) {
      const fullAddr = [form.address, form.city, form.postal_code, form.country].filter(Boolean).join(", ");
      const r = await geocodeAddressWithRetry(fullAddr, { maxAttempts: 2 });
      if (r.ok) {
        restCoords = { latitude: r.lat, longitude: r.lng };
        serviceArea = { service_area_lat: r.lat, service_area_lng: r.lng };
      }
    }
    const update = role === "restaurant" ? {
      full_name: form.full_name, phone: form.phone,
      terms_accepted: true, profile_completed: true,
      business_name: form.business_name, vat_number: vatDigits,
      venue_type: form.venue_type, address: form.address, price_range: form.price_range,
      city: form.city || null, province: form.province || null,
      postal_code: form.postal_code || null, country: form.country || null,
      latitude: restCoords.latitude, longitude: restCoords.longitude,
      service_area_lat: serviceArea.service_area_lat, service_area_lng: serviceArea.service_area_lng,
      access_restrictions: form.access_restrictions || null,
      additional_directions: form.additional_directions || null,
      location_notes: form.location_notes || null,
      contact_person_first_name: form.contact_person_first_name || null,
      contact_person_last_name: form.contact_person_last_name || null,
      contact_person_role: form.contact_person_role || null,
      contact_person_phone: form.contact_person_phone || null,
      contact_person_email: form.contact_person_email || null,
      representative_age: form.representative_age ? Number(form.representative_age) : null,
      ...reqToProfileUpdate(requirements),
    } : {
      full_name: form.full_name, phone: form.phone,
      terms_accepted: true, profile_completed: true,
      age: form.age ? parseInt(form.age) : null,
      professional_profile: form.professional_profile,
      languages: spokenLanguages.map(s => s.language),
      spoken_languages: spokenLanguages,
      service_area_radius_m: parseInt(form.service_area_radius_m) || 500,
      ...serviceArea,
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) {
      setBusy(false);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("profiles_vat_number_unique") || msg.includes("duplicate key")) {
        toast.error("Questa Partita IVA risulta già registrata. Accedi con l'account esistente oppure contatta l'assistenza.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    if (role === "restaurant" && vatValid && (vatResult?.status !== "valid")) {
      try {
        await verifyVatFn({ data: { vat_number: vatDigits } });
      } catch {}
    }
    setBusy(false);
    toast.success("Profilo completato!");
    await refresh();
    nav({ to: "/dashboard" });
  };

  return (
    <AppShell>
      <PageHeader title="Completa il tuo profilo" subtitle={role === "restaurant" ? "Aggiungi i dati del tuo locale" : "Aggiungi le tue informazioni professionali"} />
      <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Nome completo</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Telefono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        {role === "restaurant" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Nome locale</Label><Input required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></div>
              <div className="md:col-span-1">
                <Label>Partita IVA *</Label>
                <div className="flex gap-2">
                  <Input
                    required
                    inputMode="numeric"
                    pattern="\d{11}"
                    maxLength={11}
                    placeholder="Inserisci la Partita IVA"
                    value={form.vat_number}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setForm({ ...form, vat_number: v });
                      setVatResult(null);
                    }}
                  />
                  <Button type="button" variant="outline" disabled={!vatValid || vatChecking} onClick={handleVerifyVat}>
                    {vatChecking ? "Verifico…" : "Verifica"}
                  </Button>
                </div>
                {!vatValid && form.vat_number.length > 0 && (
                  <p className="text-xs text-destructive mt-1">La Partita IVA deve contenere 11 cifre numeriche.</p>
                )}
                {vatResult && (
                  <p className={`text-xs mt-1 ${vatResult.status === "valid" ? "text-emerald-600" : vatResult.status === "invalid" ? "text-destructive" : "text-muted-foreground"}`}>
                    {vatResult.message}
                    {vatResult.companyName ? ` (${vatResult.companyName})` : ""}
                  </p>
                )}
              </div>
              <div><Label>Tipologia locale</Label><Input placeholder="Pizzeria, Ristorante…" value={form.venue_type} onChange={(e) => setForm({ ...form, venue_type: e.target.value })} /></div>
              <div><Label>Fascia di prezzo</Label><Input placeholder="€, €€, €€€" value={form.price_range} onChange={(e) => setForm({ ...form, price_range: e.target.value })} /></div>
            </div>
            <div><Label>Indirizzo</Label><Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid gap-4 md:grid-cols-3">
              <div><Label>Città</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Provincia</Label><Input maxLength={3} placeholder="MI" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value.toUpperCase() })} /></div>
              <div><Label>CAP</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">📍 Luogo e Accesso</h3>
              <p className="text-xs text-muted-foreground -mt-2">Queste informazioni vengono mostrate ai lavoratori candidati e precompilate negli annunci.</p>
              <div><Label>Restrizioni all'ingresso</Label><Textarea rows={2} placeholder="Es. Arrivare 15 minuti prima per accreditarsi" value={form.access_restrictions} onChange={(e) => setForm({ ...form, access_restrictions: e.target.value })} /></div>
              <div><Label>Indicazioni aggiuntive</Label><Textarea rows={2} placeholder="Es. Entrare dall'ingresso laterale, chiedere del responsabile di sala" value={form.additional_directions} onChange={(e) => setForm({ ...form, additional_directions: e.target.value })} /></div>
              <div><Label>Note per il lavoratore</Label><Textarea rows={2} placeholder="Informazioni utili che il lavoratore deve sapere prima di arrivare sul posto" value={form.location_notes} onChange={(e) => setForm({ ...form, location_notes: e.target.value })} /></div>
              <div className="pt-2 border-t">
                <Label className="text-sm font-semibold">Referente operativo</Label>
                <div className="grid gap-3 md:grid-cols-2 mt-2">
                  <div><Label className="text-xs">Nome</Label><Input value={form.contact_person_first_name} onChange={(e) => setForm({ ...form, contact_person_first_name: e.target.value })} /></div>
                  <div><Label className="text-xs">Cognome</Label><Input value={form.contact_person_last_name} onChange={(e) => setForm({ ...form, contact_person_last_name: e.target.value })} /></div>
                  <div><Label className="text-xs">Ruolo</Label><Input placeholder="Es. Maitre, Direttore" value={form.contact_person_role} onChange={(e) => setForm({ ...form, contact_person_role: e.target.value })} /></div>
                  <div><Label className="text-xs">Telefono</Label><Input value={form.contact_person_phone} onChange={(e) => setForm({ ...form, contact_person_phone: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label className="text-xs">Email</Label><Input type="email" value={form.contact_person_email} onChange={(e) => setForm({ ...form, contact_person_email: e.target.value })} /></div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs">Età del referente *</Label>
                  <select
                    required
                    value={form.representative_age}
                    onChange={(e) => setForm({ ...form, representative_age: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Seleziona età…</option>
                    {Array.from({ length: 82 }, (_, i) => 18 + i).map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Dato privato. Devi avere almeno 18 anni per creare un account ristoratore.</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">📋 Requisiti e Competenze standard</h3>
              <p className="text-xs text-muted-foreground -mt-1">Imposta i requisiti standard del locale: verranno precompilati automaticamente in ogni nuovo annuncio.</p>
              <RestaurantRequirementsEditor value={requirements} onChange={setRequirements} />
            </div>
          </>
        ) : (
          <>
            <div><Label>Età</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
            <div><Label>Profilo professionale</Label><Textarea rows={4} value={form.professional_profile} onChange={(e) => setForm({ ...form, professional_profile: e.target.value })} /></div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <Label className="font-semibold">Lingue parlate</Label>
              <p className="text-xs text-muted-foreground">Seleziona una o più lingue e indica il livello.</p>
              <SpokenLanguagesEditor value={spokenLanguages} onChange={setSpokenLanguages} />
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
              <div><Label>Area di interesse (indirizzo)</Label><Input placeholder="es. Via Roma 1, Milano" value={form.service_area_address} onChange={(e) => setForm({ ...form, service_area_address: e.target.value })} /></div>
              <div><Label>Raggio (m)</Label><Input type="number" min="100" step="100" value={form.service_area_radius_m} onChange={(e) => setForm({ ...form, service_area_radius_m: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">Verrai mostrato in <span className="text-emerald-600 font-medium">verde</span> ai ristoratori il cui locale rientra nella tua area.</p>
          </>
        )}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: !!v })} />
          <span>Ho letto e accetto le <Link to="/terms" className="underline hover:text-primary" target="_blank">condizioni d'uso e la privacy policy</Link>.</span>
        </label>
        <Button type="submit" disabled={busy}>{busy ? "Salvataggio..." : "Salva e continua"}</Button>
      </form>
    </AppShell>
  );
}