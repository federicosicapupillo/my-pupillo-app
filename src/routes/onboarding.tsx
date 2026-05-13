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
import {
  RestaurantRequirementsEditor,
  EMPTY_REQ,
  reqFromProfile,
  reqToProfileUpdate,
  type RestaurantRequirements,
} from "@/components/RestaurantRequirements";
import { SpokenLanguagesEditor, normalizeSpokenLanguages, type SpokenLanguage } from "@/components/SpokenLanguages";
import { VENUE_TYPES } from "@/lib/venue-types";
import { PRICE_RANGE_OPTIONS } from "@/lib/price-range";
import { ITALIAN_LOCATIONS, citiesForProvince, provinceCode, isCityInProvince, isValidCapForCity, isValidCapForDistrict } from "@/lib/italian-locations";
import { CapField } from "@/components/CapField";
import { DistrictField } from "@/components/DistrictField";
import { PhoneInput } from "@/components/PhoneInput";
import { splitPhone, buildPhoneFull, isValidPhone, DEFAULT_PHONE_PREFIX } from "@/lib/phone-prefixes";
import { CONTACT_ROLES, isValidEmail } from "@/lib/contact-roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OnboardingStatusCard, type OnboardingStep } from "@/components/OnboardingStatusCard";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Completa il profilo — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  ),
});

function Onboarding() {
  const { user, role, profile, refresh } = useAuth();
  const nav = useNavigate();
  const verifyVatFn = useServerFn(verifyVat);

  useEffect(() => {
    if (!profile) return;
    if (profile.phone_verified === false) {
      nav({ to: "/verify-phone" });
      return;
    }
    if (profile.profile_completed) {
      nav({ to: "/dashboard" });
    }
  }, [profile, nav]);

  const [form, setForm] = useState({
    full_name: "",
    phone_code: DEFAULT_PHONE_PREFIX,
    phone_number: "",
    age: "",
    professional_profile: "",
    languages: "",
    business_name: "",
    vat_number: "",
    venue_type: "",
    venue_type_other: "",
    address: "",
    price_range: "",
    service_area_address: "",
    service_area_radius_m: "500",
    street_number: "",
    district: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Italia",
    contact_person_first_name: "",
    contact_person_last_name: "",
    contact_person_role: "",
    contact_person_role_other: "",
    contact_person_phone_code: DEFAULT_PHONE_PREFIX,
    contact_person_phone_number: "",
    contact_person_email: "",
    representative_age: "",
    terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [requirements, setRequirements] = useState<RestaurantRequirements>(EMPTY_REQ);
  const [spokenLanguages, setSpokenLanguages] = useState<SpokenLanguage[]>([]);
  const [vatChecking, setVatChecking] = useState(false);
  const [vatResult, setVatResult] = useState<{ status: string; message: string; companyName?: string | null } | null>(
    null,
  );
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [idDocPath, setIdDocPath] = useState<string | null>(null);
  const [idDocName, setIdDocName] = useState<string | null>(null);

  const ID_DOC_ACCEPT = "application/pdf,image/jpeg,image/png";
  const ID_DOC_MAX = 8 * 1024 * 1024; // 8MB

  const vatDigits = form.vat_number.replace(/\D/g, "");
  const vatValid = vatDigits.length === 11;

  const steps: OnboardingStep[] = (() => {
    const accountDone = !!user;
    const phoneDone = !!profile?.phone_verified;
    const allDone = !!profile?.profile_completed;

    if (role === "restaurant") {
      const businessDone =
        !!form.business_name.trim() &&
        !!form.venue_type &&
        !!form.price_range &&
        (form.venue_type !== "Altro" || !!form.venue_type_other.trim());
      const vatDone = vatValid;
      const contactDone =
        !!form.contact_person_first_name.trim() &&
        !!form.contact_person_last_name.trim() &&
        !!form.contact_person_role &&
        isValidPhone(form.contact_person_phone_code, form.contact_person_phone_number) &&
        !!form.contact_person_email.trim() &&
        isValidEmail(form.contact_person_email);
      const finalDone = allDone;
      const finalLocked = !(businessDone && vatDone && contactDone);
      return [
        { id: "account", label: "Account creato", status: accountDone ? "done" : "todo" },
        {
          id: "phone",
          label: "Numero WhatsApp verificato",
          status: phoneDone ? "done" : "todo",
          href: phoneDone ? undefined : "/verify-phone",
        },
        {
          id: "business",
          label: "Profilo del locale",
          hint: "Nome, tipologia e fascia di prezzo",
          status: businessDone ? "done" : "todo",
          href: "#sec-business",
        },
        {
          id: "vat",
          label: "Partita IVA",
          hint: "11 cifre, verifica automatica",
          status: vatDone ? "done" : "todo",
          href: "#sec-vat",
        },
        {
          id: "contact",
          label: "Referente operativo",
          hint: "Persona di riferimento per i lavoratori",
          status: contactDone ? "done" : "todo",
          href: "#sec-contact",
        },
        {
          id: "first-ad",
          label: "Pronto per il primo annuncio",
          status: finalDone ? "done" : finalLocked ? "locked" : "todo",
          href: finalDone ? "/ristoratore/annunci/nuovo" : undefined,
        },
      ];
    }

    // worker (default)
    const personalDone = !!form.full_name.trim() && !!form.age && Number(form.age) >= 16;
    const experienceDone = !!form.professional_profile.trim();
    const languagesDone = spokenLanguages.length > 0;
    const availabilityDone =
      !!form.service_area_address.trim() && !!form.service_area_radius_m;
    const finalLocked = !(personalDone && experienceDone && languagesDone);
    return [
      { id: "account", label: "Account creato", status: accountDone ? "done" : "todo" },
      {
        id: "phone",
        label: "Numero WhatsApp verificato",
        status: phoneDone ? "done" : "todo",
        href: phoneDone ? undefined : "/verify-phone",
      },
      {
        id: "personal",
        label: "Profilo personale",
        hint: "Nome ed età",
        status: personalDone ? "done" : "todo",
        href: "#sec-personal",
      },
      {
        id: "experience",
        label: "Esperienza e ruoli",
        hint: "Racconta il tuo profilo professionale",
        status: experienceDone ? "done" : "todo",
        href: "#sec-experience",
      },
      {
        id: "languages",
        label: "Lingue parlate",
        status: languagesDone ? "done" : "todo",
        href: "#sec-languages",
      },
      {
        id: "availability",
        label: "Disponibilità",
        hint: "Zona di interesse e raggio",
        status: availabilityDone ? "done" : "todo",
        href: "#sec-availability",
      },
      {
        id: "ready",
        label: "Pronto a candidarti",
        status: allDone ? "done" : finalLocked ? "locked" : "todo",
        href: allDone ? "/browse" : undefined,
      },
    ];
  })();

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
    if (profile) {
      const ph = splitPhone((profile as any).phone_full ?? profile.phone);
      const cph = splitPhone((profile as any).contact_person_phone);
      setForm((f) => ({
        ...f,
        full_name: profile.full_name ?? "",
        phone_code: (profile as any).phone_country_code || ph.code,
        phone_number: (profile as any).phone_number || ph.number,
        age: profile.age?.toString() ?? "",
        professional_profile: profile.professional_profile ?? "",
        languages: (profile.languages ?? []).join(", "),
        business_name: profile.business_name ?? "",
        vat_number: profile.vat_number ?? "",
        venue_type: profile.venue_type ?? "",
        venue_type_other: (profile as any).venue_type_other ?? "",
        address: profile.address ?? "",
        price_range: profile.price_range ?? "",
        service_area_radius_m: String(profile.service_area_radius_m ?? 500),
        street_number: (profile as any).street_number ?? "",
        district: (profile as any).neighborhood ?? "",
        city: (profile as any).city ?? "",
        province: (profile as any).province ?? "",
        postal_code: (profile as any).postal_code ?? "",
        country: (profile as any).country ?? "Italia",
        contact_person_first_name: (profile as any).contact_person_first_name ?? "",
        contact_person_last_name: (profile as any).contact_person_last_name ?? "",
        contact_person_role: (profile as any).contact_person_role ?? "",
        contact_person_role_other: (profile as any).contact_person_role_other ?? "",
        contact_person_phone_code: cph.code,
        contact_person_phone_number: cph.number,
        contact_person_email: (profile as any).contact_person_email ?? "",
        representative_age:
          (profile as any).representative_age != null ? String((profile as any).representative_age) : "",
        terms_accepted: profile.terms_accepted,
      }));
    }
    if (profile) setRequirements(reqFromProfile(profile));
    if (profile) setSpokenLanguages(normalizeSpokenLanguages((profile as any).spoken_languages));
    if (profile && (profile as any).id_document_path) {
      const p = (profile as any).id_document_path as string;
      setIdDocPath(p);
      setIdDocName(p.split("/").pop() ?? p);
    }
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.terms_accepted) {
      toast.error("Devi accettare le condizioni d'uso");
      return;
    }
    if (!isValidPhone(form.phone_code, form.phone_number)) {
      toast.error("Inserisci un numero di telefono valido.");
      return;
    }
    if (role === "restaurant") {
      if (!vatValid) {
        toast.error("La Partita IVA deve contenere 11 cifre numeriche.");
        return;
      }
      if (!form.business_name.trim()) {
        toast.error("Inserisci il nome del locale.");
        return;
      }
      if (!form.venue_type) {
        toast.error("Seleziona la tipologia del locale.");
        return;
      }
      if (form.venue_type === "Altro" && !form.venue_type_other.trim()) {
        toast.error("Specifica la tipologia del locale.");
        return;
      }
      if (!form.price_range) {
        toast.error("Seleziona la fascia di prezzo del locale.");
        return;
      }
      if (!form.address.trim()) {
        toast.error("Inserisci l'indirizzo del locale.");
        return;
      }
      if (!form.province) {
        toast.error("Seleziona una provincia.");
        return;
      }
      if (!form.city) {
        toast.error("Seleziona una città.");
        return;
      }
      if (!isCityInProvince(form.city, form.province)) {
        toast.error("La città selezionata non appartiene alla provincia scelta.");
        return;
      }
      if (!form.postal_code.trim()) {
        toast.error("Inserisci il CAP.");
        return;
      }
      if (!isValidCapForCity(form.province, form.city, form.postal_code.trim())) {
        toast.error("Il CAP non appartiene alla città selezionata.");
        return;
      }
      if (!form.district.trim()) {
        toast.error("Seleziona la zona/quartiere del locale.");
        return;
      }
      if (!isValidCapForDistrict(form.province, form.city, form.district, form.postal_code.trim())) {
        toast.error("Il CAP selezionato non appartiene alla zona indicata.");
        return;
      }
      if (!form.contact_person_first_name.trim() || !form.contact_person_last_name.trim()) {
        toast.error("Inserisci nome e cognome del referente.");
        return;
      }
      if (!form.contact_person_role) {
        toast.error("Seleziona il ruolo del referente.");
        return;
      }
      if (form.contact_person_role === "Altro" && !form.contact_person_role_other.trim()) {
        toast.error("Specifica il ruolo del referente.");
        return;
      }
      if (!isValidPhone(form.contact_person_phone_code, form.contact_person_phone_number)) {
        toast.error("Inserisci un numero di telefono valido per il referente.");
        return;
      }
      if (!form.contact_person_email.trim() || !isValidEmail(form.contact_person_email)) {
        toast.error("Inserisci un indirizzo email valido.");
        return;
      }
    }
    setBusy(true);
    let uploadedPath: string | null = idDocPath;
    if (role === "worker") {
      if (!idDocFile && !idDocPath) {
        setBusy(false);
        toast.error("Carica un documento di identità per completare il profilo.");
        return;
      }
      if (idDocFile) {
        const ext = idDocFile.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${user.id}/id-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("worker-documents")
          .upload(path, idDocFile, { upsert: true, contentType: idDocFile.type });
        if (upErr) {
          setBusy(false);
          toast.error("Caricamento documento non riuscito: " + upErr.message);
          return;
        }
        uploadedPath = path;
      }
    }
    const phoneFull = buildPhoneFull(form.phone_code, form.phone_number);
    const contactPhoneFull = buildPhoneFull(form.contact_person_phone_code, form.contact_person_phone_number);
    let serviceArea: { service_area_lat: number | null; service_area_lng: number | null } = {
      service_area_lat: null,
      service_area_lng: null,
    };
    let restCoords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
    if (role === "worker" && form.service_area_address.trim().length >= 3) {
      const r = await geocodeAddressWithRetry(form.service_area_address.trim(), { maxAttempts: 2 });
      if (r.ok) serviceArea = { service_area_lat: r.lat, service_area_lng: r.lng };
    }
    if (role === "restaurant" && form.address.trim().length >= 3) {
      const fullAddr = [
        [form.address, form.street_number].filter(Boolean).join(" "),
        form.city,
        form.postal_code,
        form.country,
      ]
        .filter(Boolean)
        .join(", ");
      const r = await geocodeAddressWithRetry(fullAddr, { maxAttempts: 2 });
      if (r.ok) {
        restCoords = { latitude: r.lat, longitude: r.lng };
        serviceArea = { service_area_lat: r.lat, service_area_lng: r.lng };
      }
    }
    const update =
      role === "restaurant"
        ? {
            full_name: form.full_name,
            phone: phoneFull,
            phone_country_code: form.phone_code,
            phone_number: form.phone_number,
            phone_full: phoneFull,
            terms_accepted: true,
            profile_completed: true,
            business_name: form.business_name,
            vat_number: vatDigits,
            venue_type: form.venue_type,
            venue_type_other: form.venue_type === "Altro" ? form.venue_type_other.trim() : null,
            address: form.address,
            price_range: form.price_range,
            street_number: form.street_number || null,
            neighborhood: form.district || null,
            city: form.city || null,
            province: form.province || null,
            province_code: provinceCode(form.province),
            postal_code: form.postal_code || null,
            country: form.country || null,
            latitude: restCoords.latitude,
            longitude: restCoords.longitude,
            service_area_lat: serviceArea.service_area_lat,
            service_area_lng: serviceArea.service_area_lng,
            contact_person_first_name: form.contact_person_first_name || null,
            contact_person_last_name: form.contact_person_last_name || null,
            contact_person_role: form.contact_person_role || null,
            contact_person_role_other:
              form.contact_person_role === "Altro" ? form.contact_person_role_other.trim() || null : null,
            contact_person_phone: contactPhoneFull || null,
            contact_person_email: form.contact_person_email || null,
            representative_age: form.representative_age ? Number(form.representative_age) : null,
            ...reqToProfileUpdate(requirements),
          }
        : {
            full_name: form.full_name,
            phone: phoneFull,
            phone_country_code: form.phone_code,
            phone_number: form.phone_number,
            phone_full: phoneFull,
            terms_accepted: true,
            profile_completed: true,
            age: form.age ? parseInt(form.age) : null,
            professional_profile: form.professional_profile,
            languages: spokenLanguages.map((s) => s.language),
            spoken_languages: spokenLanguages,
            service_area_radius_m: parseInt(form.service_area_radius_m) || 500,
            id_document_path: uploadedPath,
            ...serviceArea,
          };
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) {
      setBusy(false);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("profiles_vat_number_unique") || msg.includes("duplicate key")) {
        toast.error(
          "Questa Partita IVA risulta già registrata. Accedi con l'account esistente oppure contatta l'assistenza.",
        );
      } else {
        toast.error(error.message);
      }
      return;
    }
    setBusy(false);
    toast.success("Profilo completato!");
    await refresh();
    nav({ to: "/dashboard" });
  };

  return (
    <AppShell>
      <PageHeader
        title="Completa il tuo profilo"
        subtitle={
          role === "restaurant" ? "Aggiungi i dati del tuo locale" : "Aggiungi le tue informazioni professionali"
        }
      />
      <OnboardingStatusCard
        role={role}
        steps={steps}
        subtitle={
          role === "restaurant"
            ? "Completa i dati del locale per iniziare a pubblicare annunci."
            : "Completa il tuo profilo per candidarti agli annunci vicino a te."
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
        <div id="sec-personal" className="grid gap-4 md:grid-cols-2 scroll-mt-24">
          <div>
            <Label>Nome completo</Label>
            <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Telefono *</Label>
            <PhoneInput
              required
              code={form.phone_code}
              number={form.phone_number}
              onCodeChange={(c) => setForm({ ...form, phone_code: c })}
              onNumberChange={(n) => setForm({ ...form, phone_number: n })}
            />
          </div>
        </div>
        {role === "restaurant" ? (
          <>
            <div id="sec-business" className="grid gap-4 md:grid-cols-2 scroll-mt-24">
              <div>
                <Label>Nome locale</Label>
                <Input
                  required
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                />
              </div>
              <div id="sec-vat" className="md:col-span-1 scroll-mt-24">
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
                  <p
                    className={`text-xs mt-1 ${vatResult.status === "valid" ? "text-emerald-600" : vatResult.status === "invalid" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {vatResult.message}
                    {vatResult.companyName ? ` (${vatResult.companyName})` : ""}
                  </p>
                )}
              </div>
              <div>
                <Label>Tipologia locale *</Label>
                <select
                  required
                  value={form.venue_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      venue_type: e.target.value,
                      venue_type_other: e.target.value === "Altro" ? form.venue_type_other : "",
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Seleziona la tipologia del locale</option>
                  {VENUE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {form.venue_type === "Altro" && (
                  <Input
                    className="mt-2"
                    required
                    placeholder="Specifica tipologia locale"
                    value={form.venue_type_other}
                    onChange={(e) => setForm({ ...form, venue_type_other: e.target.value })}
                  />
                )}
              </div>
              <div>
                <Label>Fascia di prezzo *</Label>
                <select
                  required
                  value={form.price_range}
                  onChange={(e) => setForm({ ...form, price_range: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Seleziona fascia di prezzo</option>
                  {PRICE_RANGE_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.symbol ? `${p.symbol} — ${p.label}` : p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div id="sec-location" className="grid gap-4 md:grid-cols-[1fr_140px] scroll-mt-24">
              <div>
                <Label>Indirizzo *</Label>
                <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>N. civico</Label>
                <Input
                  value={form.street_number}
                  onChange={(e) => setForm({ ...form, street_number: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Provincia *</Label>
                <select
                  required
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value, city: "", postal_code: "", district: "" })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Seleziona provincia</option>
                  {ITALIAN_LOCATIONS.map((p) => (
                    <option key={p.province_code} value={p.province}>
                      {p.province} ({p.province_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Città *</Label>
                <select
                  required
                  disabled={!form.province}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value, postal_code: "", district: "" })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">{form.province ? "Seleziona città" : "Seleziona prima la provincia"}</option>
                  {citiesForProvince(form.province).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                 <Label>Zona / quartiere</Label>
                 <DistrictField
                   province={form.province}
                   city={form.city}
                   cap={form.postal_code}
                   value={form.district}
                   onChange={(v) => setForm({ ...form, district: v, postal_code: "" })}
                 />
              </div>
              <div>
                <Label>CAP</Label>
                <CapField
                  province={form.province}
                  city={form.city}
                  district={form.district}
                  value={form.postal_code}
                  onChange={(v) => setForm({ ...form, postal_code: v })}
                />
              </div>
              <div>
                <Label>Paese</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
            </div>

            <div id="sec-contact" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <h3 className="font-semibold flex items-center gap-2">👤 Referente operativo</h3>
              <p className="text-xs text-muted-foreground -mt-2">
                Persona di riferimento per i lavoratori candidati.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={form.contact_person_first_name}
                      onChange={(e) => setForm({ ...form, contact_person_first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cognome</Label>
                    <Input
                      value={form.contact_person_last_name}
                      onChange={(e) => setForm({ ...form, contact_person_last_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ruolo</Label>
                    <Select
                      value={form.contact_person_role}
                      onValueChange={(v) => setForm({ ...form, contact_person_role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona ruolo referente" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.contact_person_role === "Altro" && (
                      <Input
                        className="mt-2"
                        placeholder="Specifica ruolo referente"
                        value={form.contact_person_role_other}
                        onChange={(e) => setForm({ ...form, contact_person_role_other: e.target.value })}
                      />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Telefono</Label>
                    <PhoneInput
                      code={form.contact_person_phone_code}
                      number={form.contact_person_phone_number}
                      onCodeChange={(c) => setForm({ ...form, contact_person_phone_code: c })}
                      onNumberChange={(n) => setForm({ ...form, contact_person_phone_number: n })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      placeholder="esempio@email.com"
                      value={form.contact_person_email}
                      onChange={(e) => setForm({ ...form, contact_person_email: e.target.value })}
                    />
                    {form.contact_person_email && !isValidEmail(form.contact_person_email) && (
                      <p className="text-xs text-destructive mt-1">Inserisci un indirizzo email valido.</p>
                    )}
                  </div>
              </div>
            </div>

            <div id="sec-requirements" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <h3 className="font-semibold flex items-center gap-2">📋 Requisiti e Competenze standard</h3>
              <p className="text-xs text-muted-foreground -mt-1">
                Imposta i requisiti standard del locale: verranno precompilati automaticamente in ogni nuovo annuncio.
              </p>
              <RestaurantRequirementsEditor value={requirements} onChange={setRequirements} />
            </div>
          </>
        ) : (
          <>
            <div id="sec-experience" className="scroll-mt-24">
              <Label>Età</Label>
              <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div>
              <Label>Profilo professionale</Label>
              <Textarea
                rows={4}
                value={form.professional_profile}
                onChange={(e) => setForm({ ...form, professional_profile: e.target.value })}
              />
            </div>
            <div id="sec-languages" className="rounded-xl border bg-muted/30 p-4 space-y-2 scroll-mt-24">
              <Label className="font-semibold">Lingue parlate</Label>
              <p className="text-xs text-muted-foreground">Seleziona una o più lingue e indica il livello.</p>
              <SpokenLanguagesEditor value={spokenLanguages} onChange={setSpokenLanguages} />
            </div>
            <div id="sec-availability" className="grid gap-4 md:grid-cols-[1fr_140px] scroll-mt-24">
              <div>
                <Label>Area di interesse (indirizzo)</Label>
                <Input
                  placeholder="es. Via Roma 1, Milano"
                  value={form.service_area_address}
                  onChange={(e) => setForm({ ...form, service_area_address: e.target.value })}
                />
              </div>
              <div>
                <Label>Raggio (m)</Label>
                <Input
                  type="number"
                  min="100"
                  step="100"
                  value={form.service_area_radius_m}
                  onChange={(e) => setForm({ ...form, service_area_radius_m: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Verrai mostrato in <span className="text-emerald-600 font-medium">verde</span> ai ristoratori il cui
              locale rientra nella tua area.
            </p>
          </>
        )}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: !!v })} />
          <span>
            Ho letto e accetto le{" "}
            <Link to="/terms" className="underline hover:text-primary" target="_blank">
              condizioni d'uso e la privacy policy
            </Link>
            .
          </span>
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvataggio..." : "Salva e continua"}
        </Button>
      </form>
    </AppShell>
  );
}
