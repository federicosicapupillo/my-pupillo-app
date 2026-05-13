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
import {
  ITALIAN_LOCATIONS,
  citiesForProvince,
  provinceCode,
  isCityInProvince,
  isValidCapForCity,
  isValidCapForDistrict,
  ALL_CITIES_WITH_PROVINCE,
  findCityProvince,
  capsForCity,
  isValidCivicNumber,
  splitAddressAndCivic,
} from "@/lib/italian-locations";
import { CapField } from "@/components/CapField";
import { DistrictField } from "@/components/DistrictField";
import { PhoneInput } from "@/components/PhoneInput";
import {
  validateDocumentDates,
  validateRequiredDates,
  isValidISODate,
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
  validateBirthDate,
  MIN_WORKER_AGE_YEARS,
  todayInRome,
} from "@/lib/document-dates";
import { evaluateOnboardingDateGuard } from "@/lib/onboarding-date-guard";
import { splitPhone, buildPhoneFull, isValidPhone, DEFAULT_PHONE_PREFIX } from "@/lib/phone-prefixes";
import { CONTACT_ROLES, isValidEmail } from "@/lib/contact-roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OnboardingStatusCard, type OnboardingStep } from "@/components/OnboardingStatusCard";
import { DateField } from "@/components/DateField";
import { BirthDateSelect } from "@/components/BirthDateSelect";
import { WorkerRolesMultiSelect } from "@/components/WorkerRolesMultiSelect";
import { WORKER_ROLES } from "@/lib/worker-roles";
import { WORKER_CITIES, zonesForCity, ALL_ZONES_OPTION } from "@/lib/worker-cities";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ZonesMultiSelect } from "@/components/ZonesMultiSelect";
import { AvatarUpload } from "@/components/AvatarUpload";
import { uploadAvatar } from "@/lib/avatar-upload.functions";
import { validateWorkerDocumentDates } from "@/lib/worker-profile.functions";
import { uploadWorkerIdDocument } from "@/lib/id-document-upload.functions";
import { IdDocumentDropzone } from "@/components/IdDocumentDropzone";
import {
  ID_DOC_PLACEHOLDER,
  ID_DOC_HINT,
  ID_DOC_MAX_LEN,
  isValidIdDocNumberForType,
  type IdDocumentType,
} from "@/lib/id-document-format";
import { WorkerServiceAreaMap } from "@/components/WorkerServiceAreaMap";
import { UseCurrentLocationButton } from "@/components/UseCurrentLocationButton";

/**
 * Compute per-field error messages for the three worker date inputs.
 * Returns the EXACT same Italian strings used by the toast / DB trigger
 * so the inline UI and the existing tests stay in lockstep.
 */
function computeDateFieldErrors(
  input: {
    birth_date: string;
    id_document_issued_at: string;
    id_document_expires_at: string;
  },
  today: Date,
): {
  birth_date: string | null;
  id_document_issued_at: string | null;
  id_document_expires_at: string | null;
} {
  const out = {
    birth_date: null as string | null,
    id_document_issued_at: null as string | null,
    id_document_expires_at: null as string | null,
  };
  // Format / required check per field. The issued field has its own
  // "missing" copy required by the product spec.
  if (!isValidISODate(input.birth_date)) out.birth_date = INVALID_DATE_MESSAGE;
  if (!isValidISODate(input.id_document_issued_at))
    out.id_document_issued_at =
      input.id_document_issued_at?.length
        ? INVALID_DATE_MESSAGE
        : "Inserisci la data di rilascio del documento.";
  if (!isValidISODate(input.id_document_expires_at))
    out.id_document_expires_at = INVALID_DATE_MESSAGE;

  // Age / future check on the birth date.
  const birthErr = validateBirthDate(input.birth_date, today);
  if (birthErr) out.birth_date = out.birth_date ?? birthErr;

  // Range checks only when both raw inputs are individually valid dates.
  const range = validateDocumentDates(
    input.id_document_issued_at,
    input.id_document_expires_at,
    today,
  );
  if (range === DOC_DATE_ERRORS.ISSUED_FUTURE) {
    out.id_document_issued_at = out.id_document_issued_at ?? range;
  } else if (range === DOC_DATE_ERRORS.EXPIRED) {
    out.id_document_expires_at = out.id_document_expires_at ?? range;
  } else if (range === DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED) {
    // Surface the issued-side framing under the issued field as well, so
    // the user sees actionable copy under each input.
    out.id_document_issued_at =
      out.id_document_issued_at ??
      "La data di rilascio deve essere precedente alla data di scadenza.";
    out.id_document_expires_at = out.id_document_expires_at ?? range;
  }
  return out;
}

const RADIUS_KM_OPTIONS = [2, 5, 10, 15, 20, 30, 50] as const;
const ALLOWED_RADIUS_M = new Set(RADIUS_KM_OPTIONS.map((k) => k * 1000));

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
  const uploadAvatarFn = useServerFn(uploadAvatar);
  const validateWorkerDatesFn = useServerFn(validateWorkerDocumentDates);
  const uploadIdDocumentFn = useServerFn(uploadWorkerIdDocument);

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

  // Sentinel value stored in service_area_district when the worker chooses
  // GeoRadar mode (radius around position) instead of specific zones.
  const GEORADAR_SENTINEL = "__georadar__";

  const [form, setForm] = useState({
    full_name: "",
    phone_code: DEFAULT_PHONE_PREFIX,
    phone_number: "",
    languages: "",
    business_name: "",
    vat_number: "",
    venue_type: "",
    venue_type_other: "",
    address: "",
    price_range: "",
    service_area_radius_m: "10000",
    service_area_city: "",
    service_area_district: "",
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
  // Worker ID document — stored as two separate files (fronte + retro).
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [idDocPath, setIdDocPath] = useState<string | null>(null);
  const [idDocName, setIdDocName] = useState<string | null>(null);
  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);
  const [idDocBackFile, setIdDocBackFile] = useState<File | null>(null);
  const [idDocBackPath, setIdDocBackPath] = useState<string | null>(null);
  const [idDocBackName, setIdDocBackName] = useState<string | null>(null);
  const [idDocBackPreview, setIdDocBackPreview] = useState<string | null>(null);
  const [workerRoles, setWorkerRoles] = useState<string[]>([...WORKER_ROLES]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [serviceAreaPreview, setServiceAreaPreview] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceAreaLoading, setServiceAreaLoading] = useState(false);
  const [serviceAreaError, setServiceAreaError] = useState<string | null>(null);

  // Worker area mode: "zones" (specific zones/quartieri) | "georadar" (radius around position).
  const [areaMode, setAreaMode] = useState<"zones" | "georadar">("zones");

  // Live-geocode worker service area for the map preview (debounced).
  useEffect(() => {
    if (role !== "worker") return;
    const city = (form.service_area_city || "").trim();
    const district = (form.service_area_district || "").trim();
    if (!city) {
      setServiceAreaPreview(null);
      setServiceAreaError(null);
      setServiceAreaLoading(false);
      return;
    }
    setServiceAreaLoading(true);
    setServiceAreaError(null);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const fullAddr = [district, city, "Italia"].filter(Boolean).join(", ");
      const r = await geocodeAddressWithRetry(fullAddr, { maxAttempts: 1 });
      if (ctrl.signal.aborted) return;
      if (r.ok) {
        setServiceAreaPreview({ lat: r.lat, lng: r.lng });
      } else {
        setServiceAreaPreview(null);
        setServiceAreaError("Indirizzo non trovato. Verrà riprovato al salvataggio.");
      }
      setServiceAreaLoading(false);
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [role, form.service_area_city, form.service_area_district]);

  const [personal, setPersonal] = useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    birth_place: "",
    tax_code: "",
    nationality: "Italiana",
    residence_address: "",
    // Local-only split of `residence_address` into a street part + civic
    // number. Recombined into `residence_address` on save so the DB schema
    // stays untouched.
    residence_street: "",
    residence_street_number: "",
    residence_city: "",
    residence_postal_code: "",
    residence_province: "",
    id_document_type: "",
    id_document_number: "",
    id_document_issued_at: "",
    id_document_expires_at: "",
    id_document_issuer: "",
  });

  // Per-field inline errors for the three date inputs. Cleared whenever the
  // user edits the field. Populated on submit attempt (and by live cross-checks
  // for rilascio/scadenza) so the user sees the exact message under the field.
  const [dateFieldErrors, setDateFieldErrors] = useState<{
    birth_date: string | null;
    id_document_issued_at: string | null;
    id_document_expires_at: string | null;
  }>({
    birth_date: null,
    id_document_issued_at: null,
    id_document_expires_at: null,
  });

  function clearDateError(field: keyof typeof dateFieldErrors) {
    setDateFieldErrors((prev) =>
      prev[field] === null ? prev : { ...prev, [field]: null },
    );
  }

  /**
   * Live "any worker date is filled but invalid" flag, used to disable the
   * Salva button. Empty fields are NOT considered invalid here (the existing
   * required-field validation handles them on submit); only values the user
   * actually typed/picked but that fail format or range checks count.
   */
  const workerDateInvalid = (() => {
    if (role !== "worker") return false;
    const fields = [
      personal.birth_date,
      personal.id_document_issued_at,
      personal.id_document_expires_at,
    ];
    for (const v of fields) {
      if (v && !isValidISODate(v)) return true;
    }
    if (
      personal.birth_date &&
      isValidISODate(personal.birth_date) &&
      validateBirthDate(personal.birth_date, todayInRome()) !== null
    ) {
      return true;
    }
    if (
      personal.id_document_issued_at &&
      personal.id_document_expires_at &&
      isValidISODate(personal.id_document_issued_at) &&
      isValidISODate(personal.id_document_expires_at) &&
      validateDocumentDates(
        personal.id_document_issued_at,
        personal.id_document_expires_at,
        todayInRome(),
      ) !== null
    ) {
      return true;
    }
    // Inline errors set by the last submit attempt also disable Salva.
    return Object.values(dateFieldErrors).some((m) => m !== null);
  })();

  const CF_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$|^[0-9]{11}$/;

  // Today's ISO yyyy-mm-dd in the Europe/Rome calendar — used as the
  // upper/lower bound for the date inputs so the picker matches the
  // backend rules (rilascio ≤ oggi, scadenza ≥ oggi, fuso Italia).
  const todayISORome = (() => {
    const t = todayInRome();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  // Maximum allowed birth date for workers: today minus the legal minimum
  // age (18 years), in the Europe/Rome calendar. Used as the picker upper
  // bound so the UI matches the DB trigger.
  const maxBirthISORome = (() => {
    const t = todayInRome();
    const y = t.getFullYear() - MIN_WORKER_AGE_YEARS;
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

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
    const personalDone =
      !!personal.first_name.trim() &&
      !!personal.last_name.trim() &&
      isValidISODate(personal.birth_date) &&
      validateBirthDate(personal.birth_date, todayInRome()) === null;
    const languagesDone = spokenLanguages.length > 0;
    const availabilityDone =
      !!form.service_area_city.trim() &&
      (areaMode === "georadar"
        ? ALLOWED_RADIUS_M.has(parseInt(form.service_area_radius_m))
        : !!form.service_area_district.trim());
    const finalLocked = !(personalDone && languagesDone);
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
      const loadedDistrict = ((profile as any).service_area_district ?? "") as string;
      if (loadedDistrict === GEORADAR_SENTINEL) {
        setAreaMode("georadar");
      } else if (loadedDistrict.trim()) {
        setAreaMode("zones");
      }
      setForm((f) => ({
        ...f,
        full_name: profile.full_name ?? "",
        phone_code: (profile as any).phone_country_code || ph.code,
        phone_number: (profile as any).phone_number || ph.number,
        languages: (profile.languages ?? []).join(", "),
        business_name: profile.business_name ?? "",
        vat_number: profile.vat_number ?? "",
        venue_type: profile.venue_type ?? "",
        venue_type_other: (profile as any).venue_type_other ?? "",
        address: profile.address ?? "",
        price_range: profile.price_range ?? "",
        service_area_radius_m: (() => {
          const v = profile.service_area_radius_m ?? 10000;
          return String(ALLOWED_RADIUS_M.has(v) ? v : 10000);
        })(),
        service_area_city: (profile as any).service_area_city ?? "",
        service_area_district: (profile as any).service_area_district ?? "",
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
    if (profile) {
      const sec = (profile as any).secondary_roles as string[] | null | undefined;
      const prim = (profile as any).primary_role as string | null | undefined;
      const known = new Set<string>(WORKER_ROLES as readonly string[]);
      const merged = [...(sec ?? []), ...(prim ? [prim] : [])].filter((r) => known.has(r));
      if (merged.length > 0) {
        setWorkerRoles((WORKER_ROLES as readonly string[]).filter((r) => merged.includes(r)));
      }
    }
    if (profile && (profile as any).id_document_path) {
      const p = (profile as any).id_document_path as string;
      setIdDocPath(p);
      setIdDocName(p.split("/").pop() ?? p);
    }
    if (profile && (profile as any).id_document_back_path) {
      const p = (profile as any).id_document_back_path as string;
      setIdDocBackPath(p);
      setIdDocBackName(p.split("/").pop() ?? p);
    }
    if (profile && (profile as any).avatar_url) {
      const stored = (profile as any).avatar_url as string;
      // Reject legacy public/external URLs — only signed URLs from storage paths are allowed.
      if (/^(https?:|data:|blob:|\/\/)/i.test(stored)) {
        setAvatarUrl(null);
      } else {
        supabase.storage
          .from("avatars")
          .createSignedUrl(stored, 60 * 60)
          .then(({ data: signed }) => {
            if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
          });
      }
    }
    if (profile) {
      const p = profile as any;
      const split = splitAddressAndCivic(p.residence_address);
      setPersonal((s) => ({
        first_name: p.first_name ?? s.first_name,
        last_name: p.last_name ?? s.last_name,
        birth_date: p.birth_date ?? s.birth_date,
        birth_place: p.birth_place ?? s.birth_place,
        tax_code: p.tax_code ?? s.tax_code,
        nationality: p.nationality ?? s.nationality,
        residence_address: p.residence_address ?? s.residence_address,
        residence_street: split.street || s.residence_street,
        residence_street_number: split.civic || s.residence_street_number,
        residence_city: p.residence_city ?? s.residence_city,
        residence_postal_code: p.residence_postal_code ?? s.residence_postal_code,
        residence_province: p.residence_province ?? s.residence_province,
        id_document_type: p.id_document_type ?? s.id_document_type,
        id_document_number: p.id_document_number ?? s.id_document_number,
        id_document_issued_at: p.id_document_issued_at ?? s.id_document_issued_at,
        id_document_expires_at: p.id_document_expires_at ?? s.id_document_expires_at,
        id_document_issuer: p.id_document_issuer ?? s.id_document_issuer,
      }));
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
    let uploadedBackPath: string | null = idDocBackPath;
    let uploadedAvatarUrl: string | null = avatarUrl;
    if (role === "worker") {
      const required = [
        personal.first_name, personal.last_name, personal.birth_date, personal.birth_place,
        personal.tax_code, personal.nationality,
        personal.residence_street, personal.residence_street_number,
        personal.residence_city, personal.residence_postal_code, personal.residence_province,
        personal.id_document_type, personal.id_document_number,
        personal.id_document_issued_at, personal.id_document_expires_at, personal.id_document_issuer,
      ];
      const allFilled = required.every((v) => String(v ?? "").trim().length > 0);
      const cfOk = CF_REGEX.test(personal.tax_code.trim().toUpperCase());
      const today = todayInRome();
      const birthOk =
        isValidISODate(personal.birth_date) &&
        validateBirthDate(personal.birth_date, today) === null;
      // City must belong to the supported dataset; CAP must match it; civic
      // number must follow the Italian format (e.g. 12, 12A, 24/B).
      const cityEntry = findCityProvince(personal.residence_city);
      const provinceOk =
        !!cityEntry &&
        personal.residence_province.trim().toUpperCase() ===
          cityEntry.province_code;
      const capOk = isValidCapForCity(
        cityEntry?.province ?? null,
        personal.residence_city,
        personal.residence_postal_code,
      );
      const civicOk = isValidCivicNumber(personal.residence_street_number);
      if (
        !allFilled ||
        !cfOk ||
        !birthOk ||
        !cityEntry ||
        !provinceOk ||
        !capOk ||
        !civicOk ||
        (!idDocFile && !idDocPath) ||
        (!idDocBackFile && !idDocBackPath)
      ) {
        setBusy(false);
        // Surface the issued-specific message before the generic copy so
        // the user knows exactly which date is missing.
        if (personal.birth_date && !birthOk) {
          const birthMsg =
            (isValidISODate(personal.birth_date)
              ? validateBirthDate(personal.birth_date, today)
              : null) ?? "Data di nascita non valida.";
          setDateFieldErrors((prev) => ({ ...prev, birth_date: birthMsg }));
          toast.error(birthMsg);
        } else if (!personal.birth_date) {
          setDateFieldErrors((prev) => ({
            ...prev,
            birth_date: "Inserisci la tua data di nascita.",
          }));
          toast.error("Inserisci la tua data di nascita.");
        } else if (!personal.id_document_issued_at) {
          setDateFieldErrors((prev) => ({
            ...prev,
            id_document_issued_at:
              "Inserisci la data di rilascio del documento.",
          }));
          toast.error("Inserisci la data di rilascio del documento.");
        } else if (!cityEntry) {
          toast.error("Seleziona una città di residenza dall'elenco.");
        } else if (!capOk) {
          toast.error("Seleziona un CAP valido per la città scelta.");
        } else if (!civicOk) {
          toast.error("Inserisci un numero civico valido (es. 12, 12A, 24/B).");
        } else if (!idDocFile && !idDocPath) {
          toast.error("Carica il fronte del documento.");
        } else if (!idDocBackFile && !idDocBackPath) {
          toast.error("Carica il retro del documento.");
        } else {
          toast.error("Completa tutti i dati anagrafici e carica un documento valido per proseguire.");
        }
        return;
      }
      // Numero documento: only letters and digits, 5–20 chars (already
      // forced uppercase by the input). Mirror this rule in the DB trigger
      // `enforce_worker_personal_data` for backend safety.
      const docNumber = personal.id_document_number.trim().toUpperCase();
      if (!/^[A-Z0-9]{5,20}$/.test(docNumber)) {
        setBusy(false);
        toast.error(
          "Numero documento non valido. Inserisci solo lettere e numeri.",
        );
        return;
      }
      // Per-type coherence check (carta d'identità / passaporto / patente).
      if (
        !isValidIdDocNumberForType(
          personal.id_document_type as IdDocumentType,
          docNumber,
        )
      ) {
        setBusy(false);
        toast.error(
          "Numero documento non coerente con il tipo di documento selezionato.",
        );
        return;
      }
      // Block save if any date input is not a real dd/mm/yyyy value or
      // the rilascio/scadenza pair is inconsistent.
      const perField = computeDateFieldErrors(
        {
          birth_date: personal.birth_date,
          id_document_issued_at: personal.id_document_issued_at,
          id_document_expires_at: personal.id_document_expires_at,
        },
        today,
      );
      const dateGuard = evaluateOnboardingDateGuard(
        {
          birth_date: personal.birth_date,
          id_document_issued_at: personal.id_document_issued_at,
          id_document_expires_at: personal.id_document_expires_at,
        },
        today,
      );
      if (dateGuard.blocked) {
        setBusy(false);
        setDateFieldErrors(perField);
        toast.error(dateGuard.message);
        return;
      }
      // Clear any stale inline errors when all dates are valid.
      setDateFieldErrors({
        birth_date: null,
        id_document_issued_at: null,
        id_document_expires_at: null,
      });
      // Server-side echo of the same validation: re-runs the rules under the
      // user's auth session so a tampered client cannot bypass them. The DB
      // trigger `enforce_worker_personal_data` is the final guard.
      try {
        const serverCheck = await validateWorkerDatesFn({
          data: {
            birth_date: personal.birth_date,
            id_document_issued_at: personal.id_document_issued_at,
            id_document_expires_at: personal.id_document_expires_at,
          },
        });
        if (!serverCheck.ok) {
          setBusy(false);
          toast.error(serverCheck.error);
          return;
        }
      } catch (e) {
        setBusy(false);
        toast.error(
          e instanceof Error && e.message
            ? e.message
            : "Validazione delle date non riuscita. Riprova.",
        );
        return;
      }
      if (!idDocFile && !idDocPath) {
        setBusy(false);
        toast.error("Carica il fronte del documento.");
        return;
      }
      if (!idDocBackFile && !idDocBackPath) {
        setBusy(false);
        toast.error("Carica il retro del documento.");
        return;
      }
      if (!avatarFile && !avatarUrl) {
        setBusy(false);
        toast.error("Carica una foto profilo per completare il profilo.");
        return;
      }
      if (idDocFile) {
        const fd = new FormData();
        fd.append("file", idDocFile);
        let docRes: Awaited<ReturnType<typeof uploadIdDocumentFn>>;
        try {
          docRes = await uploadIdDocumentFn({ data: fd });
        } catch (e) {
          setBusy(false);
          toast.error(
            e instanceof Error && e.message
              ? e.message
              : "Caricamento documento non riuscito.",
          );
          return;
        }
        if (!docRes.ok) {
          setBusy(false);
          toast.error(docRes.error);
          return;
        }
        uploadedPath = docRes.path;
        setIdDocPath(docRes.path);
        setIdDocName(docRes.name);
        setIdDocFile(null);
      }
      if (idDocBackFile) {
        const fd = new FormData();
        fd.append("file", idDocBackFile);
        let docRes: Awaited<ReturnType<typeof uploadIdDocumentFn>>;
        try {
          docRes = await uploadIdDocumentFn({ data: fd });
        } catch (e) {
          setBusy(false);
          toast.error(
            e instanceof Error && e.message
              ? e.message
              : "Caricamento documento non riuscito.",
          );
          return;
        }
        if (!docRes.ok) {
          setBusy(false);
          toast.error(docRes.error);
          return;
        }
        uploadedBackPath = docRes.path;
        setIdDocBackPath(docRes.path);
        setIdDocBackName(docRes.name);
        setIdDocBackFile(null);
      }
      if (avatarFile) {
        // Server-side validation: format (JPG/PNG/WEBP), size, min 500x500.
        const fd = new FormData();
        fd.append("file", avatarFile);
        let res;
        try {
          const TIMEOUT_MS = 30_000;
          res = await Promise.race([
            uploadAvatarFn({ data: fd }),
            new Promise((_, rej) =>
              setTimeout(
                () => rej(new Error("__timeout__")),
                TIMEOUT_MS,
              ),
            ),
          ]) as Awaited<ReturnType<typeof uploadAvatarFn>>;
        } catch (e) {
          setBusy(false);
          const msg = e instanceof Error ? e.message : "";
          if (msg === "__timeout__") {
            toast.error("Caricamento foto profilo scaduto. Controlla la connessione e riprova.");
          } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch")) {
            toast.error("Connessione assente o instabile. Riprova quando sei online.");
          } else {
            toast.error(msg || "Caricamento foto profilo non riuscito. Riprova.");
          }
          return;
        }
        if (!res.ok) {
          setBusy(false);
          toast.error(res.error);
          return;
        }
        uploadedAvatarUrl = res.path;
      }
    }
    const phoneFull = buildPhoneFull(form.phone_code, form.phone_number);
    const contactPhoneFull = buildPhoneFull(form.contact_person_phone_code, form.contact_person_phone_number);
    let serviceArea: { service_area_lat: number | null; service_area_lng: number | null } = {
      service_area_lat: null,
      service_area_lng: null,
    };
    let restCoords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
    if (role === "worker") {
      if (!form.service_area_city.trim()) {
        setBusy(false);
        toast.error("Indica la città di partenza per la tua area di interesse.");
        return;
      }
      if (areaMode === "zones" && !form.service_area_district.trim()) {
        setBusy(false);
        toast.error("Indica la zona o il quartiere della tua area di interesse.");
        return;
      }
      if (!ALLOWED_RADIUS_M.has(parseInt(form.service_area_radius_m))) {
        setBusy(false);
        toast.error("Seleziona un raggio d'azione valido.");
        return;
      }
      // Best-effort geocoding: usa l'anteprima già calcolata se disponibile,
      // altrimenti prova una volta. In nessun caso bloccare il salvataggio:
      // città + zone (o GPS in georadar) sono sufficienti per il matching.
      if (serviceAreaPreview) {
        serviceArea = {
          service_area_lat: serviceAreaPreview.lat,
          service_area_lng: serviceAreaPreview.lng,
        };
      } else {
        const fullAddr = [
          areaMode === "zones" ? form.service_area_district.trim() : "",
          form.service_area_city.trim(),
          "Italia",
        ].filter(Boolean).join(", ");
        const r = await geocodeAddressWithRetry(fullAddr, { maxAttempts: 1 });
        if (r.ok) {
          serviceArea = { service_area_lat: r.lat, service_area_lng: r.lng };
        }
      }
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
            languages: spokenLanguages.map((s) => s.language),
            spoken_languages: spokenLanguages,
            primary_role: workerRoles[0] ?? null,
            secondary_roles: workerRoles,
            service_area_city: form.service_area_city.trim() || null,
            service_area_district:
              areaMode === "georadar"
                ? GEORADAR_SENTINEL
                : form.service_area_district.trim() || null,
            service_area_radius_m: (() => {
              const v = parseInt(form.service_area_radius_m);
              return ALLOWED_RADIUS_M.has(v) ? v : 10000;
            })(),
            id_document_path: uploadedPath,
            id_document_back_path: uploadedBackPath,
            avatar_url: uploadedAvatarUrl,
            first_name: personal.first_name.trim(),
            last_name: personal.last_name.trim(),
            birth_date: personal.birth_date,
            birth_place: personal.birth_place.trim(),
            tax_code: personal.tax_code.trim().toUpperCase(),
            nationality: personal.nationality.trim(),
            residence_address: `${personal.residence_street.trim()}, ${personal.residence_street_number.trim()}`,
            residence_city: personal.residence_city.trim(),
            residence_postal_code: personal.residence_postal_code.trim(),
            residence_province: personal.residence_province.trim().toUpperCase(),
            id_document_type: personal.id_document_type,
            id_document_number: personal.id_document_number.trim(),
            id_document_issued_at: personal.id_document_issued_at,
            id_document_expires_at: personal.id_document_expires_at,
            id_document_issuer: personal.id_document_issuer.trim(),
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
            <div id="sec-avatar" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <Label className="font-semibold">Foto profilo *</Label>
              <p className="text-xs text-muted-foreground">
                La foto verrà mostrata sulla tua scheda, nelle candidature e in chat.
              </p>
              <AvatarUpload
                value={avatarUrl}
                onPickFile={(f, p) => {
                  setAvatarFile(f);
                  if (p) setAvatarUrl(p);
                }}
              />
              {!avatarFile && !avatarUrl && (
                <p className="text-xs text-destructive">Carica una foto profilo per completare il profilo.</p>
              )}
            </div>
            <div id="sec-anagrafica" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <h3 className="font-semibold">📇 Dati anagrafici</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Nome *</Label>
                  <Input required value={personal.first_name} onChange={(e) => setPersonal({ ...personal, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>Cognome *</Label>
                  <Input required value={personal.last_name} onChange={(e) => setPersonal({ ...personal, last_name: e.target.value })} />
                </div>
                <div>
                  <Label>Data di nascita *</Label>
                  <BirthDateSelect
                    value={personal.birth_date}
                    error={dateFieldErrors.birth_date}
                    onChange={(iso) => {
                      clearDateError("birth_date");
                      setPersonal({ ...personal, birth_date: iso });
                    }}
                  />
                </div>
                <div>
                  <Label>Luogo di nascita *</Label>
                  <Input required value={personal.birth_place} onChange={(e) => setPersonal({ ...personal, birth_place: e.target.value })} />
                </div>
                <div>
                  <Label>Codice fiscale *</Label>
                  <Input
                    required
                    maxLength={16}
                    value={personal.tax_code}
                    onChange={(e) => setPersonal({ ...personal, tax_code: e.target.value.toUpperCase() })}
                  />
                  {personal.tax_code && !CF_REGEX.test(personal.tax_code.trim().toUpperCase()) && (
                    <p className="text-xs text-destructive mt-1">Codice fiscale non valido.</p>
                  )}
                </div>
                <div>
                  <Label>Nazionalità *</Label>
                  <Input required value={personal.nationality} onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })} />
                </div>
                <div>
                  <Label>Città di residenza *</Label>
                  <SearchableSelect
                    options={ALL_CITIES_WITH_PROVINCE.map((c) => ({
                      value: c.city,
                      label: `${c.city} (${c.province_code})`,
                    }))}
                    value={personal.residence_city}
                    placeholder="Seleziona città"
                    searchPlaceholder="Cerca città"
                    onChange={(city) => {
                      const entry = findCityProvince(city);
                      setPersonal((s) => ({
                        ...s,
                        residence_city: city,
                        residence_province: entry?.province_code ?? "",
                        // Clear CAP when city changes — it must be picked
                        // from the new city's CAP list.
                        residence_postal_code: "",
                      }));
                    }}
                  />
                </div>
                <div>
                  <Label>Provincia *</Label>
                  <Input
                    value={personal.residence_province}
                    readOnly
                    disabled
                    placeholder="Auto"
                    aria-readonly="true"
                  />
                </div>
                <div>
                  <Label>CAP *</Label>
                  <SearchableSelect
                    options={capsForCity(
                      findCityProvince(personal.residence_city)?.province ?? null,
                      personal.residence_city,
                    ).map((c) => ({ value: c, label: c }))}
                    value={personal.residence_postal_code}
                    placeholder={
                      personal.residence_city
                        ? "Seleziona CAP"
                        : "Prima seleziona la città"
                    }
                    searchPlaceholder="Cerca CAP"
                    disabled={!personal.residence_city}
                    onChange={(cap) =>
                      setPersonal((s) => ({ ...s, residence_postal_code: cap }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Via / Indirizzo *</Label>
                  <Input
                    required
                    placeholder={
                      personal.residence_city
                        ? "Cerca via o indirizzo"
                        : "Prima seleziona la città"
                    }
                    disabled={!personal.residence_city}
                    value={personal.residence_street}
                    onChange={(e) =>
                      setPersonal({ ...personal, residence_street: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Numero civico *</Label>
                  <Input
                    required
                    placeholder="Es. 12, 12A, 24/B"
                    value={personal.residence_street_number}
                    onChange={(e) =>
                      setPersonal({
                        ...personal,
                        residence_street_number: e.target.value
                          .replace(/[^0-9A-Za-z/ ]/g, "")
                          .slice(0, 10),
                      })
                    }
                    aria-invalid={
                      !!personal.residence_street_number &&
                      !isValidCivicNumber(personal.residence_street_number)
                    }
                  />
                  {!!personal.residence_street_number &&
                    !isValidCivicNumber(personal.residence_street_number) && (
                      <p className="mt-1 text-xs text-destructive">
                        Formato non valido. Es: 12, 12A, 24/B.
                      </p>
                    )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Telefono ed email sono già impostati nei dati account.</p>
            </div>

            <div id="sec-documento" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <h3 className="font-semibold">🪪 Documento di identità *</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Tipo documento *</Label>
                  <Select
                    value={personal.id_document_type}
                    onValueChange={(v) =>
                      setPersonal({
                        ...personal,
                        id_document_type: v,
                        // Reset the number when the type changes so the user
                        // re-enters a value that matches the new format.
                        id_document_number: "",
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carta_identita">Carta d'identità</SelectItem>
                      <SelectItem value="passaporto">Passaporto</SelectItem>
                      <SelectItem value="patente">Patente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Numero documento *</Label>
                  <Input
                    required
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!personal.id_document_type}
                    minLength={5}
                    maxLength={
                      personal.id_document_type
                        ? ID_DOC_MAX_LEN[personal.id_document_type as IdDocumentType]
                        : 20
                    }
                    placeholder={
                      personal.id_document_type
                        ? ID_DOC_PLACEHOLDER[
                            personal.id_document_type as IdDocumentType
                          ]
                        : "Prima seleziona il tipo documento"
                    }
                    value={personal.id_document_number}
                    onChange={(e) => {
                      // Strip anything that is not [A-Z0-9], force uppercase,
                      // trim leading/trailing spaces, cap at the per-type max.
                      const cap = personal.id_document_type
                        ? ID_DOC_MAX_LEN[
                            personal.id_document_type as IdDocumentType
                          ]
                        : 20;
                      const cleaned = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, cap);
                      setPersonal({ ...personal, id_document_number: cleaned });
                    }}
                    onBlur={(e) =>
                      setPersonal({
                        ...personal,
                        id_document_number: e.target.value.trim().toUpperCase(),
                      })
                    }
                    aria-invalid={
                      !!personal.id_document_number &&
                      !!personal.id_document_type &&
                      !isValidIdDocNumberForType(
                        personal.id_document_type as IdDocumentType,
                        personal.id_document_number,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {personal.id_document_type
                      ? ID_DOC_HINT[personal.id_document_type as IdDocumentType]
                      : "Seleziona prima il tipo documento."}
                  </p>
                  {!!personal.id_document_number &&
                    !!personal.id_document_type &&
                    !isValidIdDocNumberForType(
                      personal.id_document_type as IdDocumentType,
                      personal.id_document_number,
                    ) && (
                      <p className="mt-1 text-xs text-destructive">
                        Inserisci un numero documento valido per il documento scelto.
                      </p>
                    )}
                </div>
                <div>
                  <Label>Data rilascio *</Label>
                  <DateField
                    required
                    value={personal.id_document_issued_at}
                    max={todayISORome}
                    error={dateFieldErrors.id_document_issued_at}
                    onChange={(iso) => {
                      clearDateError("id_document_issued_at");
                      // Re-validating the cross-check may also clear a stale
                      // expires error, so wipe it too — submit will recompute.
                      clearDateError("id_document_expires_at");
                      setPersonal({ ...personal, id_document_issued_at: iso });
                    }}
                  />
                </div>
                <div>
                  <Label>Data scadenza *</Label>
                  <DateField
                    required
                    value={personal.id_document_expires_at}
                    min={personal.id_document_issued_at || todayISORome}
                    error={dateFieldErrors.id_document_expires_at}
                    onChange={(iso) => {
                      clearDateError("id_document_expires_at");
                      setPersonal({ ...personal, id_document_expires_at: iso });
                    }}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Ente di rilascio *</Label>
                  {(() => {
                    const ISSUER_OPTIONS = [
                      "Comune",
                      "Questura",
                      "Motorizzazione Civile",
                      "Ministero dell'Interno",
                      "Consolato",
                      "Ambasciata",
                    ];
                    const current = personal.id_document_issuer ?? "";
                    const isPreset = ISSUER_OPTIONS.includes(current.trim());
                    const selected = current.trim().length === 0 ? "" : isPreset ? current.trim() : "Altro";
                    return (
                      <>
                        <Select
                          value={selected}
                          onValueChange={(v) => {
                            if (v === "Altro") {
                              setPersonal({ ...personal, id_document_issuer: "" });
                            } else {
                              setPersonal({ ...personal, id_document_issuer: v });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona ente di rilascio" />
                          </SelectTrigger>
                          <SelectContent>
                            {ISSUER_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                            <SelectItem value="Altro">Altro</SelectItem>
                          </SelectContent>
                        </Select>
                        {selected === "Altro" && (
                          <div className="mt-2">
                            <Label>Specifica ente di rilascio *</Label>
                            <Input
                              required
                              placeholder="Es. Prefettura di Roma"
                              maxLength={100}
                              value={isPreset ? "" : current}
                              onChange={(e) =>
                                setPersonal({ ...personal, id_document_issuer: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div id="sec-id-document" className="space-y-2 pt-2 border-t border-border/60 scroll-mt-24">
                <Label className="font-semibold">Upload documento *</Label>
                <p className="text-xs text-muted-foreground">
                  Carica entrambi i lati del documento. Da smartphone puoi scattare
                  direttamente con la fotocamera. Formati: PDF, JPG, JPEG, PNG · max 10 MB.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <IdDocumentDropzone
                    side="fronte"
                    file={idDocFile}
                    storedPath={idDocPath}
                    storedName={idDocName}
                    preview={idDocPreview}
                    onFileSelected={({ file: f, preview, name }) => {
                      if (idDocPreview) URL.revokeObjectURL(idDocPreview);
                      setIdDocPreview(preview);
                      setIdDocFile(f);
                      setIdDocName(name);
                    }}
                  />
                  <IdDocumentDropzone
                    side="retro"
                    file={idDocBackFile}
                    storedPath={idDocBackPath}
                    storedName={idDocBackName}
                    preview={idDocBackPreview}
                    onFileSelected={({ file: f, preview, name }) => {
                      if (idDocBackPreview) URL.revokeObjectURL(idDocBackPreview);
                      setIdDocBackPreview(preview);
                      setIdDocBackFile(f);
                      setIdDocBackName(name);
                    }}
                  />
                </div>
                {!(idDocFile || idDocPath) && (
                  <p className="text-xs text-destructive">Carica il fronte del documento.</p>
                )}
                {!(idDocBackFile || idDocBackPath) && (
                  <p className="text-xs text-destructive">Carica il retro del documento.</p>
                )}
              </div>
            </div>

            <div id="sec-roles" className="rounded-xl border bg-muted/30 p-4 space-y-2 scroll-mt-24">
              <Label className="font-semibold">Renditi disponibile per</Label>
              <p className="text-xs text-muted-foreground">
                Seleziona i ruoli che vuoi ricoprire. Lasciando tutto selezionato risulterai disponibile per tutti i ruoli.
              </p>
              <WorkerRolesMultiSelect value={workerRoles} onChange={setWorkerRoles} />
            </div>
            <div id="sec-languages" className="rounded-xl border bg-muted/30 p-4 space-y-2 scroll-mt-24">
              <Label className="font-semibold">Lingue parlate</Label>
              <p className="text-xs text-muted-foreground">Seleziona una o più lingue e indica il livello.</p>
              <SpokenLanguagesEditor value={spokenLanguages} onChange={setSpokenLanguages} />
            </div>
            <div id="sec-availability" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <div>
                <Label className="font-semibold">Come vuoi impostare la tua area di lavoro?</Label>
                <p className="text-xs text-muted-foreground">
                  Scegli se indicare zone specifiche oppure usare un raggio automatico intorno alla tua posizione.
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label="Modalità area di lavoro"
                className="grid gap-2 sm:grid-cols-2"
              >
                {([
                  {
                    id: "zones",
                    title: "Zone / Quartieri",
                    desc: "Lavora solo nelle zone che preferisci.",
                  },
                  {
                    id: "georadar",
                    title: "GeoRadar",
                    desc: "Mostrati automaticamente agli annunci vicini alla tua posizione.",
                  },
                ] as const).map((opt) => {
                  const active = areaMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setAreaMode(opt.id)}
                      className={`text-left rounded-xl border p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                            active ? "border-primary" : "border-muted-foreground/40"
                          }`}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                        <span className="font-medium">{opt.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Città di partenza *</Label>
                  <SearchableSelect
                    options={WORKER_CITIES as unknown as string[]}
                    value={form.service_area_city}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        service_area_city: v,
                        // reset zones when city changes
                        service_area_district: "",
                      })
                    }
                    placeholder="Seleziona città"
                    searchPlaceholder="Cerca città…"
                  />
                </div>
                {areaMode === "zones" && (
                <div>
                  <Label>Zona / quartiere *</Label>
                  {(() => {
                    const zones = form.service_area_district
                      ? form.service_area_district.split(",").map((s) => s.trim()).filter(Boolean)
                      : [];
                    const cityZones = zonesForCity(form.service_area_city);
                    const disabled = !form.service_area_city;
                    return (
                      <>
                        <ZonesMultiSelect
                          options={cityZones}
                          value={zones}
                          disabled={disabled}
                          onChange={(next) =>
                            setForm({ ...form, service_area_district: next.join(", ") })
                          }
                          placeholder={
                            disabled ? "Seleziona prima la città" : "Seleziona zone"
                          }
                        />
                        {!disabled && cityZones.length === 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Nessuna zona disponibile per {form.service_area_city}. Seleziona "{ALL_ZONES_OPTION}".
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                )}
              </div>
              {areaMode === "georadar" && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <UseCurrentLocationButton
                    onLocated={(loc) => {
                      const knownCity = (WORKER_CITIES as readonly string[]).includes(
                        loc.city,
                      )
                        ? loc.city
                        : form.service_area_city || loc.city;
                      setForm((prev) => ({
                        ...prev,
                        service_area_city: knownCity,
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    La posizione viene usata solo per il matching degli annunci
                    e non verrà mostrata pubblicamente in modo preciso.
                  </p>
                </div>
              )}
              {areaMode === "georadar" && (
              <div>
                <Label>Raggio d'azione *</Label>
                <SearchableSelect
                  options={RADIUS_KM_OPTIONS.map((km) => `${km} km`)}
                  value={
                    ALLOWED_RADIUS_M.has(parseInt(form.service_area_radius_m))
                      ? `${parseInt(form.service_area_radius_m) / 1000} km`
                      : ""
                  }
                  onChange={(v) => {
                    const km = parseInt(v);
                    if (!Number.isFinite(km)) return;
                    setForm({ ...form, service_area_radius_m: String(km * 1000) });
                  }}
                  placeholder="Seleziona raggio d'azione"
                  searchPlaceholder="Cerca raggio…"
                />
              </div>
              )}
              {areaMode === "georadar" && (
              <div className="relative isolate" style={{ zIndex: 0 }}>
                <WorkerServiceAreaMap
                  lat={serviceAreaPreview?.lat ?? null}
                  lng={serviceAreaPreview?.lng ?? null}
                  radiusM={parseInt(form.service_area_radius_m) || 10000}
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  {serviceAreaLoading
                    ? "Localizzazione in corso…"
                    : serviceAreaError
                    ? <span className="text-destructive">{serviceAreaError}</span>
                    : serviceAreaPreview
                    ? "Anteprima dell'area di copertura."
                    : "Compila città e indirizzo per vedere l'anteprima."}
                </div>
              </div>
              )}
            </div>
            {/* Upload UI moved inside the "Documento di identità" section above. */}
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
        <Button
          type="submit"
          disabled={busy || workerDateInvalid}
          aria-disabled={busy || workerDateInvalid}
          title={
            workerDateInvalid
              ? "Correggi le date evidenziate per continuare."
              : undefined
          }
        >
          {busy ? "Salvataggio..." : "Salva e continua"}
        </Button>
      </form>
    </AppShell>
  );
}
