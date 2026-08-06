import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/profile-self-update";
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
  isValidCivicNumber,
  splitAddressAndCivic,
} from "@/lib/italian-locations";
import {
  RESIDENCE_CITY_OPTIONS,
  findResidenceComune,
  isValidResidenceCap,
  RESIDENCE_HELPER_TEXT,
} from "@/lib/italian-comuni";
import { CapField } from "@/components/CapField";
import { DistrictField } from "@/components/DistrictField";
import { PhoneInput } from "@/components/PhoneInput";
import { startPhoneVerification, verifyPhoneOtp, resendPhoneOtp } from "@/lib/phone-verification.functions";
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
import { Loader2 } from "lucide-react";
import { OnboardingStatusCard, type OnboardingStep } from "@/components/OnboardingStatusCard";
import { DateField } from "@/components/DateField";
import { BirthDateSelect } from "@/components/BirthDateSelect";
import { WorkerRolesMultiSelect } from "@/components/WorkerRolesMultiSelect";
import { WORKER_ROLES } from "@/lib/worker-roles";
import { normalizeRole } from "@/lib/worker-role-normalization";
import { LaunchAreaNotice } from "@/components/LaunchAreaNotice";
import { isLocationAllowed, LAUNCH_AREA_ERROR_MESSAGE } from "@/lib/launch-area";
import { WORKER_CITIES, zonesForCity, ALL_ZONES_OPTION } from "@/lib/worker-cities";
import { SearchableSelect } from "@/components/SearchableSelect";
import { NATIONALITIES } from "@/lib/nationalities";
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
import { scrollToField, errorFieldClass } from "@/lib/form-field-validation";
import { cn } from "@/lib/utils";
import { validateCodiceFiscale } from "@/lib/cf-validation";
import { useWorkerTaxCodeEnabled } from "@/lib/use-worker-tax-code-enabled";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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

function resolveNameFromProfile(
  profile: Record<string, unknown> | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): { first_name: string; last_name: string } {
  const p = profile ?? {};
  const m = metadata ?? {};

  let firstName = "";
  if (typeof p.first_name === "string" && p.first_name.trim()) {
    firstName = p.first_name.trim();
  } else if (typeof m.first_name === "string" && m.first_name.trim()) {
    firstName = m.first_name.trim();
  } else if (typeof m.given_name === "string" && m.given_name.trim()) {
    firstName = m.given_name.trim();
  } else {
    const full =
      (typeof m.full_name === "string" && m.full_name.trim()) ||
      (typeof m.name === "string" && m.name.trim()) ||
      "";
    if (full) {
      const tokens = full.split(/\s+/);
      firstName = tokens[0] ?? "";
    }
  }

  let lastName = "";
  if (typeof p.last_name === "string" && p.last_name.trim()) {
    lastName = p.last_name.trim();
  } else if (typeof m.last_name === "string" && m.last_name.trim()) {
    lastName = m.last_name.trim();
  } else if (typeof m.family_name === "string" && m.family_name.trim()) {
    lastName = m.family_name.trim();
  } else {
    const full =
      (typeof m.full_name === "string" && m.full_name.trim()) ||
      (typeof m.name === "string" && m.name.trim()) ||
      "";
    if (full) {
      const tokens = full.split(/\s+/);
      if (tokens.length > 1) {
        lastName = tokens.slice(1).join(" ");
      }
    }
  }

  return { first_name: firstName, last_name: lastName };
}

const RADIUS_KM_OPTIONS = [2, 5, 10, 15, 20, 30, 50] as const;
const ALLOWED_RADIUS_M = new Set(RADIUS_KM_OPTIONS.map((k) => k * 1000));

/**
 * Preferisce il valore proveniente dal DB solo se è "significativo"
 * (non null/undefined e, per le stringhe, non vuoto dopo trim). Altrimenti
 * mantiene il valore locale già digitato dall'utente. Serve a evitare che
 * un refetch del profile (es. dopo verifica WhatsApp) sovrascriva con "" i
 * campi che l'utente sta compilando.
 */
function pick<T>(dbVal: T | null | undefined, localVal: T): T {
  if (dbVal === null || dbVal === undefined) return localVal;
  if (typeof dbVal === "string" && dbVal.trim() === "") return localVal;
  return dbVal;
}

/**
 * Varianti di `pick` per tipi non-stringa, usate nel useEffect [profile] per
 * evitare che un refetch del profilo (es. dopo la verifica OTP) sovrascriva
 * valori locali già compilati dall'utente.
 *
 * - `pickBool`: se il locale è già `true`, non lo abbassa (utile per
 *   `terms_accepted`: il consenso, una volta dato, non deve sparire per un
 *   refetch che ritorna false/null).
 * - `pickArray`: se l'array locale è non-vuoto lo preserva, altrimenti usa
 *   il valore DB (o `[]`). Non azzera mai un array locale non-vuoto con un
 *   array DB vuoto.
 * - `pickNumberString`: state string di un campo numerico. Se il DB ha un
 *   valore lo usa (rispetta lo stato canonico salvato); se il DB è null e
 *   il locale è non-vuoto, mantiene il locale. Al primo caricamento con
 *   locale vuoto il campo resta vuoto (comportamento identico al pre-fix).
 */
function pickBool(dbVal: boolean | null | undefined, localVal: boolean): boolean {
  if (localVal) return true;
  return Boolean(dbVal);
}
function pickArray<T>(dbArr: T[] | null | undefined, localArr: T[]): T[] {
  if (Array.isArray(localArr) && localArr.length > 0) return localArr;
  return Array.isArray(dbArr) ? dbArr : [];
}
function pickNumberString(
  dbVal: number | null | undefined,
  localVal: string,
): string {
  if (dbVal !== null && dbVal !== undefined) return String(dbVal);
  return localVal;
}

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Completa il profilo — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  ),
});

function Onboarding() {
  const { user, role, profile, refresh, patchProfile } = useAuth();
  const nav = useNavigate();
  const verifyVatFn = useServerFn(verifyVat);
  const uploadAvatarFn = useServerFn(uploadAvatar);
  const validateWorkerDatesFn = useServerFn(validateWorkerDocumentDates);
  const uploadIdDocumentFn = useServerFn(uploadWorkerIdDocument);
  const startPhoneFn = useServerFn(startPhoneVerification);
  const verifyPhoneFn = useServerFn(verifyPhoneOtp);
  const resendPhoneFn = useServerFn(resendPhoneOtp);

  // Inline phone-OTP state (verification now happens here in onboarding).
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  // Granular spinner state: distinguishes which OTP action is in flight so
  // the right button shows a spinner (send vs verify vs resend).
  const [otpAction, setOtpAction] = useState<null | "send" | "verify" | "resend">(null);
  // Inline error shown right below the OTP input. Cleared when the user
  // edits the code, requests a new code, or changes the phone number.
  // `kind` lets us style "expired" differently from a generic "invalid" error.
  const [otpError, setOtpError] = useState<
    null | { kind: "invalid" | "expired" | "rate_limited" | "generic"; message: string }
  >(null);
  // Ref-based guard: blocks any further OTP request that fires before the
  // React state has time to flip `otpBusy=true` (e.g. very rapid double-click).
  const otpInFlightRef = useRef(false);
  const otpJustVerifiedRef = useRef(false);
  // Stable editability for name/surname: decided ONCE when profile first loads.
  // If the resolved value was empty at that moment → editable for the whole session,
  // even after the user types characters. If already populated (OAuth) → read-only.
  const firstNameEditableRef = useRef<boolean | null>(null);
  const lastNameEditableRef = useRef<boolean | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  // Optimistic local override: set immediately after a successful OTP verify
  // so the "Numero WhatsApp verificato" step flips to "done" and CTAs unlock
  // without waiting for the async refresh() of the auth context.
  const [phoneVerifiedOptimistic, setPhoneVerifiedOptimistic] = useState(false);

  // Feature flag `require_id_document` (scope: global). When disabled from the
  // admin panel the whole "Documento di identità" section is hidden and the
  // client-side validations for id_document_* fields are skipped. Fallback is
  // SAFE-ON (true) both while loading and if the RPC fails — meglio mostrare
  // il documento per errore che nasconderlo. La validazione DB
  // (`enforce_worker_personal_data`) resta la fonte di verità.
  const [requireIdDocument, setRequireIdDocument] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_feature_enabled", {
          _key: "require_id_document",
        });
        if (cancelled) return;
        if (error) {
          console.warn("[onboarding] require_id_document flag read failed", error);
          return; // keep safe default (true)
        }
        setRequireIdDocument(data === false ? false : true);
      } catch (e) {
        if (!cancelled) console.warn("[onboarding] require_id_document flag threw", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Feature flag `worker_tax_code_enabled` (scope: global).
  // FAIL-CLOSED per la visualizzazione: mostriamo e richiediamo il CF SOLO
  // quando lo stato è confermato `enabled`. In `loading` / `disabled` /
  // `error` il campo resta nascosto e la sua assenza non blocca il
  // completamento del profilo lavoratore.
  const { isEnabled: taxCodeEnabled } = useWorkerTaxCodeEnabled();

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setInterval(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [otpCooldown]);

  useEffect(() => {
    if (!profile) return;
    // Un profilo "completo" ma privo di nome/cognome deve restare in
    // onboarding finché l'identità non è compilata.
    if (isEffectivelyComplete(profile as any, role)) {
      nav({ to: "/dashboard" });
    }
  }, [profile, role, nav]);

  // Temporary debug log: helps diagnose any case where worker-only sections
  // (availability, weekly days, service area, roles) would otherwise render
  // inside the restaurant onboarding flow because `role` is null/undefined
  // during loading. Logs user id, detected role, which branch is rendered
  // and the current step so we can confirm role-based gating at runtime.
  useEffect(() => {
    const renderedBranch =
      role === "restaurant"
        ? "restaurant"
        : role === "worker"
          ? "worker"
          : "none (role not ready)";
    // eslint-disable-next-line no-console
    console.info("[PUPILLO_ONBOARDING_ROLE_RENDER_DEBUG]", {
      userId: user?.id ?? null,
      detectedRole: role ?? null,
      renderedBranch,
      worker_only_sections_visible: role === "worker",
      profileCompleted: profile?.profile_completed ?? null,
    });
  }, [user?.id, role, profile?.profile_completed]);

  // Sentinel value stored in service_area_district when the worker chooses
  // GeoRadar mode (radius around position) instead of specific zones.
  const GEORADAR_SENTINEL = "__georadar__";

  const parseSelectedZones = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

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
  // Hard guard against duplicate submissions (covers the small window between
  // the click and React flushing the `busy` state).
  const submittingRef = useRef(false);
  const [availabilityPromptOpen, setAvailabilityPromptOpen] = useState(false);
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
  // Ref-mirror di avatarFile/avatarUrl per poter decidere, dentro il
  // useEffect [profile], se un refetch del profilo deve rigenerare la
  // signed URL o preservare l'anteprima locale appena scelta.
  const avatarFileRef = useRef<File | null>(null);
  const avatarUrlRef = useRef<string | null>(null);
  useEffect(() => {
    avatarFileRef.current = avatarFile;
  }, [avatarFile]);
  useEffect(() => {
    avatarUrlRef.current = avatarUrl;
  }, [avatarUrl]);
  // Campi worker in errore dopo un tentativo di "Salva" fallito. L'insieme
  // viene azzerato all'inizio del submit e ripopolato dai branch di
  // validazione fallita (accanto a scrollToField). Applica errorFieldClass
  // sul wrapper/input corrispondente per evidenziarli in rosso.
  const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
  const markErr = (name: string) =>
    setErrorFields((prev) => {
      if (prev.has(name) && prev.size === 1) return prev;
      return new Set([name]);
    });
  const hasErr = (name: string) => errorFields.has(name);

  // Sezione facoltativa "Esperienza e preferenze" (lavoratore).
  // Tutti i campi sono opzionali: non bloccano salvataggio né completamento.
  const [optExp, setOptExp] = useState<{
    experience_years: string;
    experience_level: "" | "junior" | "intermediate" | "senior" | "esperto";
    hourly_rate: string;
    is_motorized: "" | "yes" | "no";
  }>({
    experience_years: "",
    experience_level: "",
    hourly_rate: "",
    is_motorized: "",
  });

  const [serviceAreaPreview, setServiceAreaPreview] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsServiceArea, setGpsServiceArea] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceAreaLoading, setServiceAreaLoading] = useState(false);
  const [serviceAreaError, setServiceAreaError] = useState<string | null>(null);

  // Worker area mode: "zones" (specific zones/quartieri) | "georadar" (radius around position).
  const [areaMode, setAreaMode] = useState<"zones" | "georadar">("zones");
  // Ref-guard: diventa true quando l'utente sceglie manualmente una modalità
  // area. Se true, il useEffect [profile] NON riscrive `areaMode` con il
  // valore proveniente da un refetch (evita che un rifetch post-verifica
  // OTP riporti la scelta indietro).
  const areaModeTouchedRef = useRef(false);
  // Idem per `requirements`: `RestaurantRequirements` ha default non-vuoti,
  // quindi non è possibile dedurre "toccato" dal contenuto. Marchiamo touched
  // sul primo cambio via editor.
  const requirementsTouchedRef = useRef(false);

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
        setServiceAreaError("Area non trovata. Verrà riprovato al salvataggio.");
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

  // Inline error for the "Codice fiscale" coherence check (decoded CF ↔
  // birth_date / birth_place). Cleared when the user edits the CF or the
  // related anagraphic fields.
  const [cfCoherenceError, setCfCoherenceError] = useState<string | null>(null);

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
    // Strict: step is "done" ONLY when the phone is stored on the profile
    // AND phone_verified=true. Either field missing → step remains "todo"
    // so the user must actually complete the OTP flow in this page.
    const phoneVerifiedEffective = profile?.phone_verified === true || phoneVerifiedOptimistic;
    const phoneStored = !!profile?.phone || isValidPhone(form.phone_code, form.phone_number);
    const phoneDone = phoneStored && phoneVerifiedEffective;
    if (typeof window !== "undefined") {
      console.info("[PUPILLO_ONBOARDING_ONLY_PHONE_OTP_DEBUG] phone step status", {
        user_id: user?.id,
        has_phone: !!profile?.phone,
        phone_verified: profile?.phone_verified ?? null,
        phone_verified_optimistic: phoneVerifiedOptimistic,
        phoneDone,
      });
    }
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
      // The final CTA must stay locked until the WhatsApp OTP step is done.
      const finalLocked = !(phoneDone && businessDone && vatDone && contactDone);
      return [
        { id: "account", label: "Account creato", status: accountDone ? "done" : "todo" },
        {
          id: "phone",
          label: "Numero WhatsApp verificato",
          status: phoneDone ? "done" : "todo",
          href: phoneDone ? undefined : "#sec-phone",
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
    const selectedZones = parseSelectedZones(form.service_area_district);
    const availabilityDone =
      !!form.service_area_city.trim() &&
      ALLOWED_RADIUS_M.has(parseInt(form.service_area_radius_m)) &&
      (areaMode === "georadar" || selectedZones.length > 0);
    // Worker "pronto a candidarti" CTA also requires verified WhatsApp.
    const finalLocked = !(phoneDone && personalDone && languagesDone);
    return [
      { id: "account", label: "Account creato", status: accountDone ? "done" : "todo" },
      {
        id: "phone",
        label: "Numero WhatsApp verificato",
        status: phoneDone ? "done" : "todo",
        href: phoneDone ? undefined : "#sec-phone",
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
    if (otpJustVerifiedRef.current) {
      otpJustVerifiedRef.current = false;
      return;
    }
    if (profile) {
      const ph = splitPhone((profile as any).phone_full ?? profile.phone);
      const cph = splitPhone((profile as any).contact_person_phone);
      const loadedMode = (profile as any).work_area_mode as string | null | undefined;
      const loadedDistrict = ((profile as any).service_area_district ?? "") as string;
      const loadedZones = Array.isArray((profile as any).selected_zones)
        ? ((profile as any).selected_zones as string[]).filter(Boolean)
        : [];
      const loadedAllZones = Boolean((profile as any).all_zones);
      // Rispetta la scelta locale dell'utente: se ha già cliccato una
      // modalità (touched=true), non lasciamo che il refetch la riscriva.
      if (!areaModeTouchedRef.current) {
        if (loadedMode === "georadar" || loadedDistrict === GEORADAR_SENTINEL) {
          setAreaMode("georadar");
        } else if (loadedMode === "zones" || loadedDistrict.trim() || loadedZones.length > 0 || loadedAllZones) {
          setAreaMode("zones");
        }
      }
      setForm((f) => ({
        ...f,
        full_name: pick(profile.full_name, f.full_name),
        phone_code: (profile as any).phone_country_code || ph.code,
        phone_number: (profile as any).phone_number || ph.number,
        // `form.languages` è una stringa comma-joined derivata dalla lista
        // `profile.languages`. Se DB è vuoto ma l'utente ha già scritto
        // qualcosa, preserva il locale (pick standard su stringa).
        languages: pick((profile.languages ?? []).join(", "), f.languages),
        business_name: pick(profile.business_name, f.business_name),
        vat_number: pick(profile.vat_number, f.vat_number),
        venue_type: pick(profile.venue_type, f.venue_type),
        venue_type_other: pick((profile as any).venue_type_other, f.venue_type_other),
        address: pick(profile.address, f.address),
        price_range: pick(profile.price_range, f.price_range),
        // Se il DB ha un radius salvato lo rispettiamo (fonte canonica).
        // Se DB è null/undefined manteniamo il valore locale (default o
        // scelta utente non ancora salvata) invece di forzare 10000 e
        // sovrascrivere una scelta come "5000" fatta prima della verifica.
        service_area_radius_m: (() => {
          const v = profile.service_area_radius_m;
          if (v === null || v === undefined) return f.service_area_radius_m;
          return String(ALLOWED_RADIUS_M.has(v) ? v : 10000);
        })(),
        service_area_city: pick((profile as any).service_area_city, f.service_area_city),
        // Calcola il valore derivato dal DB, poi applica `pick` così che
        // un DB vuoto ("") non spazzi via una zona già digitata localmente.
        service_area_district: pick(
          loadedMode === "georadar" || loadedDistrict === GEORADAR_SENTINEL
            ? ""
            : loadedAllZones
              ? ALL_ZONES_OPTION
              : loadedZones.length > 0
                ? loadedZones.join(", ")
                : loadedDistrict,
          f.service_area_district,
        ),
        street_number: pick((profile as any).street_number, f.street_number),
        district: pick((profile as any).neighborhood, f.district),
        city: pick((profile as any).city, f.city),
        province: pick((profile as any).province, f.province),
        postal_code: pick((profile as any).postal_code, f.postal_code),
        country: pick((profile as any).country, f.country) || "Italia",
        contact_person_first_name: pick((profile as any).contact_person_first_name, f.contact_person_first_name),
        contact_person_last_name: pick((profile as any).contact_person_last_name, f.contact_person_last_name),
        contact_person_role: pick((profile as any).contact_person_role, f.contact_person_role),
        contact_person_role_other: pick((profile as any).contact_person_role_other, f.contact_person_role_other),
        contact_person_phone_code: cph.code,
        contact_person_phone_number: cph.number,
        contact_person_email: pick((profile as any).contact_person_email, f.contact_person_email),
        representative_age: pickNumberString(
          (profile as any).representative_age,
          f.representative_age,
        ),
        // Consenso ai termini: se dato localmente non deve sparire per
        // un refetch che ritorna false/null.
        terms_accepted: pickBool(profile.terms_accepted, f.terms_accepted),
      }));
    }
    // `requirements` ha default non-vuoti: usiamo un ref-guard "touched"
    // per non azzerare le scelte dell'utente al refetch.
    if (profile && !requirementsTouchedRef.current) {
      setRequirements(reqFromProfile(profile));
    }
    // Lingue parlate: se l'utente ha già aggiunto qualcosa non lo perdiamo.
    if (profile) {
      const dbLangs = normalizeSpokenLanguages((profile as any).spoken_languages);
      setSpokenLanguages((cur) => pickArray(dbLangs, cur));
    }
    if (profile) {
      const p = profile as any;
      setOptExp((s) => {
        const dbYears = p.experience_years != null ? String(p.experience_years) : "";
        const dbLevel =
          p.experience_level === "junior" ||
          p.experience_level === "intermediate" ||
          p.experience_level === "senior" ||
          p.experience_level === "esperto"
            ? p.experience_level
            : "";
        const dbRate = (() => {
          if (p.hourly_rate == null) return "";
          const n = Number(p.hourly_rate);
          if (!Number.isFinite(n)) return "";
          if (n >= 31) return "oltre_30";
          return String(n);
        })();
        const dbMotor =
          p.is_motorized === true ? "yes" : p.is_motorized === false ? "no" : "";
        return {
          experience_years: pick(dbYears, s.experience_years),
          experience_level: pick(dbLevel, s.experience_level),
          hourly_rate: pick(dbRate, s.hourly_rate),
          is_motorized: pick(dbMotor, s.is_motorized),
        };
      });
    }
    if (profile) {
      const sec = (profile as any).secondary_roles as string[] | null | undefined;
      const prim = (profile as any).primary_role as string | null | undefined;
      // Mappa anche le etichette storiche ("Aiuto cuoco", "Responsabile sala")
      // sulle etichette canoniche, così i ruoli salvati non vanno persi.
      const byNorm = new Map<string, string>(
        (WORKER_ROLES as readonly string[]).map((r) => [normalizeRole(r), r]),
      );
      const merged = [...(sec ?? []), ...(prim ? [prim] : [])]
        .map((r) => byNorm.get(normalizeRole(r)))
        .filter((r): r is string => Boolean(r));
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
      // Preserve any locally-picked avatar (file staged for upload, or a blob:
      // preview URL not yet persisted) so a profile refetch does not overwrite
      // the user's just-chosen photo.
      const hasLocalAvatar =
        avatarFileRef.current != null ||
        (avatarUrlRef.current != null && avatarUrlRef.current.startsWith("blob:"));
      if (!hasLocalAvatar) {
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
    }
    if (profile) {
      const p = profile as any;
      const split = splitAddressAndCivic(p.residence_address);
      const names = resolveNameFromProfile(p, (user as any)?.user_metadata);
      const resolvedFirst = names.first_name;
      const resolvedLast = names.last_name;
      // Lock editability on first profile load (stable across keystrokes / refresh).
      if (firstNameEditableRef.current === null) {
        firstNameEditableRef.current = !resolvedFirst.trim();
      }
      if (lastNameEditableRef.current === null) {
        lastNameEditableRef.current = !resolvedLast.trim();
      }
      setPersonal((s) => ({
        first_name: pick(resolvedFirst, s.first_name),
        last_name: pick(resolvedLast, s.last_name),
        birth_date: pick(p.birth_date, s.birth_date),
        birth_place: pick(p.birth_place, s.birth_place),
        tax_code: pick(p.tax_code, s.tax_code),
        nationality: pick(p.nationality, s.nationality),
        residence_address: pick(p.residence_address, s.residence_address),
        residence_street: pick(split.street, s.residence_street),
        residence_street_number: pick(split.civic, s.residence_street_number),
        residence_city: pick(p.residence_city, s.residence_city),
        residence_postal_code: pick(p.residence_postal_code, s.residence_postal_code),
        residence_province: pick(p.residence_province, s.residence_province),
        id_document_type: pick(p.id_document_type, s.id_document_type),
        id_document_number: pick(p.id_document_number, s.id_document_number),
        id_document_issued_at: pick(p.id_document_issued_at, s.id_document_issued_at),
        id_document_expires_at: pick(p.id_document_expires_at, s.id_document_expires_at),
        id_document_issuer: pick(p.id_document_issuer, s.id_document_issuer),
      }));
    }
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    // Double-click guard: ignore the second click while the first request is in flight.
    if (submittingRef.current || busy) {
      console.info("[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] duplicate click ignored");
      return;
    }
    const t0 = performance.now();
    console.info("[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] click salva profilo", { role });
    // Reset del set di campi in errore: verrà ripopolato dai branch di
    // validazione fallita qui sotto.
    setErrorFields(new Set());
    if (!form.terms_accepted) {
      toast.error("Devi accettare le condizioni d'uso");
      return;
    }
    if (!isValidPhone(form.phone_code, form.phone_number)) {
      toast.error("Inserisci un numero di telefono valido.");
      markErr("phone");
      scrollToField("phone");
      return;
    }
    if (role !== "admin" && !(profile?.phone_verified || phoneVerifiedOptimistic)) {
      toast.error("Verifica il numero di cellulare prima di completare il profilo.");
      markErr("phone");
      scrollToField("phone");
      return;
    }
    if (role === "restaurant") {
      // Identità minima obbligatoria: senza nome e cognome il DB rifiuta
      // `profile_completed = true`.
      if (!personal.first_name.trim()) {
        toast.error("Inserisci il tuo nome.");
        markErr("first_name");
        scrollToField("first_name");
        return;
      }
      if (!personal.last_name.trim()) {
        toast.error("Inserisci il tuo cognome.");
        markErr("last_name");
        scrollToField("last_name");
        return;
      }
      if (!vatValid) {
        toast.error("La Partita IVA deve contenere 11 cifre numeriche.");
        scrollToField("vat_number");
        return;
      }
      if (!form.business_name.trim()) {
        toast.error("Inserisci il nome del locale.");
        scrollToField("business_name");
        return;
      }
      if (!form.venue_type) {
        toast.error("Seleziona la tipologia del locale.");
        scrollToField("venue_type");
        return;
      }
      if (form.venue_type === "Altro" && !form.venue_type_other.trim()) {
        toast.error("Specifica la tipologia del locale.");
        scrollToField("venue_type_other");
        return;
      }
      if (!form.price_range) {
        toast.error("Seleziona la fascia di prezzo del locale.");
        scrollToField("price_range");
        return;
      }
      if (!form.address.trim()) {
        toast.error("Inserisci l'indirizzo del locale.");
        scrollToField("address");
        return;
      }
      if (!form.province) {
        toast.error("Seleziona una provincia.");
        scrollToField("province");
        return;
      }
      if (!form.city) {
        toast.error("Seleziona una città.");
        scrollToField("city");
        return;
      }
      if (!isCityInProvince(form.city, form.province)) {
        toast.error("La città selezionata non appartiene alla provincia scelta.");
        scrollToField("city");
        return;
      }
      if (!isLocationAllowed({ city: form.city, province: form.province })) {
        toast.error(LAUNCH_AREA_ERROR_MESSAGE);
        scrollToField("city");
        return;
      }
      if (!form.postal_code.trim()) {
        toast.error("Inserisci il CAP.");
        scrollToField("postal_code");
        return;
      }
      if (!isValidCapForCity(form.province, form.city, form.postal_code.trim())) {
        toast.error("Il CAP non appartiene alla città selezionata.");
        scrollToField("postal_code");
        return;
      }
      if (!form.district.trim()) {
        toast.error("Seleziona la zona/quartiere del locale.");
        scrollToField("district");
        return;
      }
      if (!isValidCapForDistrict(form.province, form.city, form.district, form.postal_code.trim())) {
        toast.error("Il CAP selezionato non appartiene alla zona indicata.");
        scrollToField("postal_code");
        return;
      }
      if (!form.contact_person_first_name.trim() || !form.contact_person_last_name.trim()) {
        toast.error("Inserisci nome e cognome del referente.");
        scrollToField("contact_person_first_name");
        return;
      }
      if (!form.contact_person_role) {
        toast.error("Seleziona il ruolo del referente.");
        scrollToField("contact_person_role");
        return;
      }
      if (form.contact_person_role === "Altro" && !form.contact_person_role_other.trim()) {
        toast.error("Specifica il ruolo del referente.");
        scrollToField("contact_person_role_other");
        return;
      }
      if (!isValidPhone(form.contact_person_phone_code, form.contact_person_phone_number)) {
        toast.error("Inserisci un numero di telefono valido per il referente.");
        scrollToField("contact_person_phone");
        return;
      }
      if (!form.contact_person_email.trim() || !isValidEmail(form.contact_person_email)) {
        toast.error("Inserisci un indirizzo email valido.");
        scrollToField("contact_person_email");
        return;
      }
    }
    submittingRef.current = true;
    setBusy(true);
    console.info("[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] inizio salvataggio");
    let uploadedPath: string | null = idDocPath;
    let uploadedBackPath: string | null = idDocBackPath;
    let uploadedAvatarUrl: string | null = avatarUrl;
    if (role === "worker") {
      const requiredBase = [
        personal.first_name, personal.last_name, personal.birth_date, personal.birth_place,
        ...(taxCodeEnabled ? [personal.tax_code] : []),
        personal.nationality,
        personal.residence_street, personal.residence_street_number,
        personal.residence_city, personal.residence_postal_code, personal.residence_province,
      ];
      const requiredDoc = requireIdDocument
        ? [
            personal.id_document_type, personal.id_document_number,
            personal.id_document_issued_at, personal.id_document_expires_at, personal.id_document_issuer,
          ]
        : [];
      const required = [...requiredBase, ...requiredDoc];
      const allFilled = required.every((v) => String(v ?? "").trim().length > 0);
      // Se il flag è OFF il CF è opzionale: consideriamo `cfOk = true`
      // (nessun blocco di formato). Se ON, comportamento originale.
      const cfOk = taxCodeEnabled
        ? CF_REGEX.test(personal.tax_code.trim().toUpperCase())
        : true;
      const today = todayInRome();
      const birthOk =
        isValidISODate(personal.birth_date) &&
        validateBirthDate(personal.birth_date, today) === null;
      // City must belong to the supported dataset; CAP must match it; civic
      // number must follow the Italian format (e.g. 12, 12A, 24/B).
      // Residenza = dato ANAGRAFICO: validata sull'anagrafica nazionale dei
      // comuni, MAI sull'area operativa Pupillo (Bologna e provincia).
      const cityEntry = findResidenceComune(
        personal.residence_city,
        personal.residence_province,
      );
      const provinceOk =
        !!cityEntry &&
        personal.residence_province.trim().toUpperCase() ===
          cityEntry.province_code;
      const capOk = isValidResidenceCap(personal.residence_postal_code);
      const civicOk = isValidCivicNumber(personal.residence_street_number);
      // CF coerenza con data/luogo di nascita — decode e verifica.
      // La check formale (cfOk) resta sopra per gestire il messaggio "CF non valido".
      const cfCoherence = taxCodeEnabled && cfOk
        ? validateCodiceFiscale({
            cf: personal.tax_code,
            birthDate: personal.birth_date,
            birthPlace: personal.birth_place,
            firstName: personal.first_name,
            lastName: personal.last_name,
          })
        : ({ ok: true } as const);
      if (
        !allFilled ||
        !cfOk ||
        (cfCoherence.ok === false) ||
        !birthOk ||
        !cityEntry ||
        !provinceOk ||
        !capOk ||
        !civicOk ||
        (requireIdDocument && !idDocFile && !idDocPath) ||
        (requireIdDocument && !idDocBackFile && !idDocBackPath)
      ) {
        setBusy(false); submittingRef.current = false;
        // Generic banner + specific message + scroll to first missing field.
        toast.error("Completa i campi obbligatori evidenziati.");
        // Detect first missing required field (ordered as they appear on page).
        const orderBase = [
          ["first_name", !personal.first_name.trim()],
          ["last_name", !personal.last_name.trim()],
          ["birth_date", !personal.birth_date],
          ["birth_place", !personal.birth_place.trim()],
          ...(taxCodeEnabled
            ? ([["tax_code", !personal.tax_code.trim()]] as const)
            : ([] as const)),
          ["nationality", !personal.nationality.trim()],
          ["residence_city", !personal.residence_city.trim()],
          ["residence_postal_code", !personal.residence_postal_code.trim()],
          ["residence_street", !personal.residence_street.trim()],
          ["residence_street_number", !personal.residence_street_number.trim()],
        ] as const;
        const orderDoc = requireIdDocument
          ? ([
              ["id_document_type", !personal.id_document_type],
              ["id_document_number", !personal.id_document_number.trim()],
              ["id_document_issued_at", !personal.id_document_issued_at],
              ["id_document_expires_at", !personal.id_document_expires_at],
              ["id_document_issuer", !personal.id_document_issuer.trim()],
            ] as const)
          : ([] as const);
        const firstEmpty =
          [...orderBase, ...orderDoc].find(([, missing]) => missing)?.[0] ?? null;
        // PRIORITÀ: prima si scorre al PRIMO campo vuoto in ordine DOM,
        // poi si controllano gli errori di formato dei campi già compilati.
        // Così se Città, Indirizzo e Numero civico sono tutti vuoti, lo scroll
        // va sul primo (Città) e non sul controllo di formato del civico.
        if (firstEmpty) {
          toast.error("Campo obbligatorio mancante.");
          markErr(firstEmpty);
          scrollToField(firstEmpty);
        } else if (personal.birth_date && !birthOk) {
          const birthMsg =
            (isValidISODate(personal.birth_date)
              ? validateBirthDate(personal.birth_date, today)
              : null) ?? "Data di nascita non valida.";
          setDateFieldErrors((prev) => ({ ...prev, birth_date: birthMsg }));
          toast.error(birthMsg);
          markErr("birth_date");
          scrollToField("birth_date");
        } else if (requireIdDocument && !personal.id_document_issued_at) {
          setDateFieldErrors((prev) => ({
            ...prev,
            id_document_issued_at:
              "Inserisci la data di rilascio del documento.",
          }));
          toast.error("Inserisci la data di rilascio del documento.");
          markErr("id_document_issued_at");
          scrollToField("id_document_issued_at");
        } else if (!cityEntry) {
          toast.error("Seleziona una città di residenza dall'elenco.");
          markErr("residence_city");
          scrollToField("residence_city");
        } else if (!capOk) {
          toast.error("Inserisci un CAP valido (5 cifre).");
          markErr("residence_postal_code");
          scrollToField("residence_postal_code");
        } else if (!civicOk) {
          toast.error("Inserisci un numero civico valido (es. 12, 12A, 24/B).");
          markErr("residence_street_number");
          scrollToField("residence_street_number");
        } else if (requireIdDocument && !idDocFile && !idDocPath) {
          toast.error("Carica il fronte del documento.");
          scrollToField("sec-id-document");
        } else if (requireIdDocument && !idDocBackFile && !idDocBackPath) {
          toast.error("Carica il retro del documento.");
          scrollToField("sec-id-document");
        } else if (!cfOk) {
          toast.error("Codice fiscale non valido.");
          markErr("tax_code");
          scrollToField("tax_code");
        } else if (cfCoherence.ok === false) {
          setCfCoherenceError(cfCoherence.error);
          toast.error(cfCoherence.error);
          markErr("tax_code");
          scrollToField("tax_code");
        } else {
          toast.error("Completa tutti i dati anagrafici e carica un documento valido per proseguire.");
        }
        return;
      }
      // Se siamo arrivati qui, il CF è coerente: puliamo eventuale errore.
      setCfCoherenceError(null);
      // Document-specific checks: run only when the feature flag is on.
      // With the flag OFF the whole "Documento di identità" section is
      // hidden, so client-side format/coherence/date checks and file
      // uploads for the document are skipped. Birth-date validation still
      // runs below because it is a non-document requirement.
      if (requireIdDocument) {
      // Numero documento: only letters and digits, 5–20 chars (already
      // forced uppercase by the input). Mirror this rule in the DB trigger
      // `enforce_worker_personal_data` for backend safety.
      const docNumber = personal.id_document_number.trim().toUpperCase();
      if (!/^[A-Z0-9]{5,20}$/.test(docNumber)) {
        setBusy(false); submittingRef.current = false;
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
        setBusy(false); submittingRef.current = false;
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
        setBusy(false); submittingRef.current = false;
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
          setBusy(false); submittingRef.current = false;
          toast.error(serverCheck.error);
          return;
        }
      } catch (e) {
        setBusy(false); submittingRef.current = false;
        toast.error(
          e instanceof Error && e.message
            ? e.message
            : "Validazione delle date non riuscita. Riprova.",
        );
        return;
      }
      if (!idDocFile && !idDocPath) {
        setBusy(false); submittingRef.current = false;
        toast.error("Carica il fronte del documento.");
        return;
      }
      if (!idDocBackFile && !idDocBackPath) {
        setBusy(false); submittingRef.current = false;
        toast.error("Carica il retro del documento.");
        return;
      }
      } else {
        // Flag OFF: still validate birth date on its own.
        if (!isValidISODate(personal.birth_date)) {
          setBusy(false); submittingRef.current = false;
          setDateFieldErrors((prev) => ({ ...prev, birth_date: INVALID_DATE_MESSAGE }));
          toast.error(INVALID_DATE_MESSAGE);
          return;
        }
        const birthMsg = validateBirthDate(personal.birth_date, today);
        if (birthMsg) {
          setBusy(false); submittingRef.current = false;
          setDateFieldErrors((prev) => ({ ...prev, birth_date: birthMsg }));
          toast.error(birthMsg);
          return;
        }
        setDateFieldErrors({
          birth_date: null,
          id_document_issued_at: null,
          id_document_expires_at: null,
        });
      }
      if (!avatarFile && !avatarUrl) {
        setBusy(false); submittingRef.current = false;
        toast.error("Carica una foto profilo per completare il profilo.");
        markErr("avatar");
        scrollToField("avatar");
        return;
      }
      if (idDocFile) {
        const fd = new FormData();
        fd.append("file", idDocFile);
        let docRes: Awaited<ReturnType<typeof uploadIdDocumentFn>>;
        try {
          docRes = await uploadIdDocumentFn({ data: fd });
        } catch (e) {
          setBusy(false); submittingRef.current = false;
          toast.error(
            e instanceof Error && e.message
              ? e.message
              : "Caricamento documento non riuscito.",
          );
          return;
        }
        if (!docRes.ok) {
          setBusy(false); submittingRef.current = false;
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
          setBusy(false); submittingRef.current = false;
          toast.error(
            e instanceof Error && e.message
              ? e.message
              : "Caricamento documento non riuscito.",
          );
          return;
        }
        if (!docRes.ok) {
          setBusy(false); submittingRef.current = false;
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
          setBusy(false); submittingRef.current = false;
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
          setBusy(false); submittingRef.current = false;
          toast.error(res.error);
          return;
        }
        uploadedAvatarUrl = res.path;
      }
      // Esegui gli upload in parallelo: il blocco sopra è stato già
      // eseguito riga per riga in serie; le ottimizzazioni di parallelismo
      // sono applicate sotto solo se necessario. Manteniamo la semantica
      // ma loggiamo il tempo totale degli upload.
      console.info(
        "[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] upload completati",
        { idDoc: !!uploadedPath, idDocBack: !!uploadedBackPath, avatar: !!uploadedAvatarUrl },
      );
    }
    const phoneFull = buildPhoneFull(form.phone_code, form.phone_number);
    const contactPhoneFull = buildPhoneFull(form.contact_person_phone_code, form.contact_person_phone_number);
    let serviceArea: { service_area_lat: number | null; service_area_lng: number | null } = {
      service_area_lat: null,
      service_area_lng: null,
    };
    let restCoords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
    const selectedZones = areaMode === "zones" ? parseSelectedZones(form.service_area_district) : [];
    const allZonesSelected = selectedZones.includes(ALL_ZONES_OPTION);
    const normalizedSelectedZones = allZonesSelected ? [] : selectedZones;
    if (role === "worker") {
      if (!form.service_area_city.trim()) {
        setBusy(false); submittingRef.current = false;
        toast.error("Indica la città di partenza per la tua area di interesse.");
        return;
      }
      if (!isLocationAllowed({ city: form.service_area_city.trim() })) {
        setBusy(false); submittingRef.current = false;
        toast.error(LAUNCH_AREA_ERROR_MESSAGE);
        return;
      }
      if (areaMode === "zones" && selectedZones.length === 0) {
        setBusy(false); submittingRef.current = false;
        toast.error("Indica la zona o il quartiere della tua area di interesse.");
        return;
      }
      if (!ALLOWED_RADIUS_M.has(parseInt(form.service_area_radius_m))) {
        setBusy(false); submittingRef.current = false;
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
      } else if (gpsServiceArea) {
        serviceArea = {
          service_area_lat: gpsServiceArea.lat,
          service_area_lng: gpsServiceArea.lng,
        };
      } else {
        const fullAddr = [form.service_area_district.trim(), form.service_area_city.trim(), "Italia"]
          .filter(Boolean)
          .join(", ");
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
            first_name: personal.first_name.trim(),
            last_name: personal.last_name.trim(),
            full_name: `${personal.first_name.trim()} ${personal.last_name.trim()}`.trim() || null,
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
            full_name:
              `${personal.first_name ?? ""} ${personal.last_name ?? ""}`.trim() ||
              form.full_name ||
              (profile as any)?.full_name ||
              null,
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
            work_area_mode: areaMode,
            service_area_city: form.service_area_city.trim() || null,
            service_area_district:
              areaMode === "georadar"
                ? form.service_area_district.trim() || null
                : allZonesSelected
                  ? ALL_ZONES_OPTION
                  : normalizedSelectedZones.join(", ") || null,
            selected_zones: areaMode === "zones" ? normalizedSelectedZones : [],
            all_zones: areaMode === "zones" ? allZonesSelected : false,
            service_area_radius_m: (() => {
              const v = parseInt(form.service_area_radius_m);
              return ALLOWED_RADIUS_M.has(v) ? v : 10000;
            })(),
            ...(requireIdDocument
              ? {
                  id_document_path: uploadedPath,
                  id_document_back_path: uploadedBackPath,
                }
              : {}),
            avatar_url: uploadedAvatarUrl,
            first_name: personal.first_name.trim() || (profile as any)?.first_name || null,
            last_name: personal.last_name.trim() || (profile as any)?.last_name || null,
            birth_date: personal.birth_date,
            birth_place: personal.birth_place.trim(),
            // Con flag OFF non inviamo alcun valore per `tax_code`: così
            // eventuali dati storici in DB restano intatti (nessun NULL
            // forzato) e nessuna validazione backend viene innescata.
            ...(taxCodeEnabled
              ? { tax_code: personal.tax_code.trim().toUpperCase() }
              : {}),
            nationality: personal.nationality.trim(),
            residence_address: `${personal.residence_street.trim()}, ${personal.residence_street_number.trim()}`,
            residence_city: personal.residence_city.trim(),
            residence_postal_code: personal.residence_postal_code.trim(),
            residence_province: personal.residence_province.trim().toUpperCase(),
            ...(requireIdDocument
              ? {
                  id_document_type: personal.id_document_type,
                  id_document_number: personal.id_document_number.trim(),
                  id_document_issued_at: personal.id_document_issued_at,
                  id_document_expires_at: personal.id_document_expires_at,
                  id_document_issuer: personal.id_document_issuer.trim(),
                }
              : {}),
            ...serviceArea,
            // Campi facoltativi sezione "Esperienza e preferenze"
            experience_years: optExp.experience_years.trim() || null,
            experience_level: optExp.experience_level || null,
            hourly_rate: (() => {
              const raw = optExp.hourly_rate.trim();
              if (!raw) return null;
              // Sentinel: "Oltre 30 €/h" salvato come 31 per restare coerente
              // col tipo numerico della colonna hourly_rate.
              if (raw === "oltre_30") return 31;
              const v = raw.replace(",", ".");
              if (!v) return null;
              const n = Number(v);
              return Number.isFinite(n) && n >= 0 ? n : null;
            })(),
            is_motorized: optExp.is_motorized === "yes" ? true : optExp.is_motorized === "no" ? false : null,
          };
    // Salva i campi del profilo. Aggiungiamo un timeout lato client per
    // evitare loading infinito se la rete è instabile.
    const tUpdate = performance.now();
    const SAVE_TIMEOUT_MS = 20_000;
    let updateResult: { error: { message: string } | null };
    try {
      updateResult = (await Promise.race([
        updateMyProfile(update as Record<string, unknown>),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("__timeout__")), SAVE_TIMEOUT_MS),
        ),
      ])) as { error: { message: string } | null };
    } catch (e) {
      setBusy(false); submittingRef.current = false;
      const msg = e instanceof Error ? e.message : "";
      console.error("[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] errore update", msg);
      if (msg === "__timeout__") {
        toast.error("Il salvataggio sta richiedendo più tempo del previsto. Controlla la connessione e riprova.");
      } else {
        toast.error("Non siamo riusciti a salvare il profilo. Riprova.");
      }
      return;
    }
    console.info(
      "[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] tempo update profiles (ms)",
      Math.round(performance.now() - tUpdate),
    );
    const { error } = updateResult;
    if (error) {
      setBusy(false); submittingRef.current = false;
      console.error("[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] supabase error", error.message);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("profiles_vat_number_unique") || msg.includes("duplicate key")) {
        toast.error(
          "Questa Partita IVA risulta già registrata. Accedi con l'account esistente oppure contatta l'assistenza.",
        );
      } else {
        toast.error("Non siamo riusciti a salvare il profilo. Riprova.");
      }
      return;
    }
    setBusy(false); submittingRef.current = false;
    if (role === "worker") {
      console.info("[PUPILLO_WORKER_OPTIONAL_EXPERIENCE_ONBOARDING_DEBUG]", {
        worker_user_id: user.id,
        years_experience: optExp.experience_years || null,
        experience_level: optExp.experience_level || null,
        desired_hourly_rate: optExp.hourly_rate || null,
        has_vehicle: optExp.is_motorized || "non_specificato",
        dati_salvati_correttamente: true,
      });
    }
    toast.success("Profilo salvato correttamente");
    console.info(
      "[PUPILLO_PROFILE_SAVE_PERFORMANCE_DEBUG] tempo totale salvataggio (ms)",
      Math.round(performance.now() - t0),
    );
    // Per il lavoratore: se il profilo è completo al 100% e non ha ancora
    // impostato disponibilità attive, mostra il popup motivazionale che lo
    // invita a configurarle subito.
    if (role === "worker") {
      try {
        const { count, error: availErr } = await supabase
          .from("worker_availability")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", user.id);
        const hasAvailability = !availErr && (count ?? 0) > 0;
        const promptDismissed = localStorage.getItem("pupillo_availability_prompt_dismissed") === "true";
        console.info("[PUPILLO_WORKER_AVAILABILITY_PROMPT_DEBUG]", {
          worker_user_id: user.id,
          profile_completed: true,
          has_availability: hasAvailability,
          prompt_dismissed: promptDismissed,
          show_popup: !hasAvailability && !promptDismissed,
        });
        void refresh();
        if (!hasAvailability && !promptDismissed) {
          setAvailabilityPromptOpen(true);
          return;
        }
      } catch (e) {
        console.error("[PUPILLO_WORKER_AVAILABILITY_PROMPT_DEBUG] check failed", e);
      }
    }
    // Naviga subito al dashboard senza attendere il refresh del contesto
    // auth: il refresh può essere lento e non è bloccante per l'UI. Il
    // contesto viene comunque rinfrescato in background.
    nav({ to: "/dashboard" });
    void refresh();
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
      <form onSubmit={submit} className="w-full max-w-5xl mx-auto space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div id="sec-personal" className="grid gap-x-6 gap-y-4 md:grid-cols-2 items-start scroll-mt-24">
          {role !== "worker" ? (
            <div className="space-y-4">
              <div>
                {/* Nome e cognome distinti: obbligatori e modificabili se il
                    login social non li ha forniti. */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div data-field="first_name" className="scroll-mt-24">
                    <Label>Nome *</Label>
                    {firstNameEditableRef.current !== false ? (
                      <Input
                        required
                        value={personal.first_name}
                        onChange={(e) => setPersonal({ ...personal, first_name: e.target.value })}
                        className={cn(hasErr("first_name") && errorFieldClass)}
                        aria-invalid={hasErr("first_name")}
                      />
                    ) : (
                      <>
                        <Input
                          required
                          readOnly
                          value={personal.first_name}
                          className="bg-muted/50 cursor-not-allowed"
                          aria-readonly="true"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Dato inserito in fase di registrazione. Per modificarlo contatta il supporto clienti.
                        </p>
                      </>
                    )}
                  </div>
                  <div data-field="last_name" className="scroll-mt-24">
                    <Label>Cognome *</Label>
                    {lastNameEditableRef.current !== false ? (
                      <Input
                        required
                        value={personal.last_name}
                        onChange={(e) => setPersonal({ ...personal, last_name: e.target.value })}
                        className={cn(hasErr("last_name") && errorFieldClass)}
                        aria-invalid={hasErr("last_name")}
                      />
                    ) : (
                      <>
                        <Input
                          required
                          readOnly
                          value={personal.last_name}
                          className="bg-muted/50 cursor-not-allowed"
                          aria-readonly="true"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Dato inserito in fase di registrazione. Per modificarlo contatta il supporto clienti.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {role === "restaurant" ? (
                <div>
                  <Label>Nome locale</Label>
                  <Input
                    required
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    data-field="business_name"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div
            id="sec-phone"
            data-field="phone"
            className={cn(
              "scroll-mt-24 rounded-lg border bg-card/40 p-3 space-y-2",
              hasErr("phone") && errorFieldClass,
            )}
          >
            <div>
              <Label className="text-base font-semibold">Numero di cellulare *</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Per completare il profilo e usare Pupillo devi verificare il tuo numero di cellulare.
              </p>
            </div>
            <PhoneInput
              required
              code={form.phone_code}
              number={form.phone_number}
              onCodeChange={(c) => {
                setForm({ ...form, phone_code: c });
                setOtpSent(false);
                setOtpError(null);
                if (!profile?.phone_verified) setPhoneVerifiedOptimistic(false);
              }}
              onNumberChange={(n) => {
                setForm({ ...form, phone_number: n });
                setOtpSent(false);
                setOtpError(null);
                if (!profile?.phone_verified) setPhoneVerifiedOptimistic(false);
              }}
              disabled={!!profile?.phone_verified || phoneVerifiedOptimistic}
            />
            {profile?.phone_verified || phoneVerifiedOptimistic ? (
              <div className="mt-1.5 space-y-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Numero verificato correttamente
                </span>
                <p className="text-xs text-muted-foreground">
                  Per modificare il numero di cellulare verificato,{" "}
                  <a
                    href="mailto:supporto@pupillo.app?subject=Modifica%20numero%20di%20cellulare%20verificato"
                    className="text-primary underline"
                  >
                    contatta il supporto clienti
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {!otpSent ? (
                  <Button
                    type="button"
                    onClick={async () => {
                      // Hard double-click guard: ignore any click that arrives
                      // while a previous OTP request is still in flight, even
                      // if React hasn't flipped `otpBusy` yet.
                      if (otpInFlightRef.current) return;
                      if (!isValidPhone(form.phone_code, form.phone_number)) {
                        toast.error("Inserisci un numero di cellulare valido.");
                        return;
                      }
                      otpInFlightRef.current = true;
                      setOtpAction("send");
                      setOtpBusy(true);
                      setOtpError(null);
                      try {
                        const res = await startPhoneFn({
                          data: {
                            phoneCountryCode: form.phone_code,
                            phoneNumber: form.phone_number,
                            sendSummary: false,
                          },
                        });
                        console.info("[PUPILLO_PHONE_ONBOARDING_DEBUG] OTP send", { user_id: user?.id, res });
                        if (!res.ok) {
                          const msg = res.error ?? "Invio codice fallito. Riprova.";
                          toast.error(msg);
                          setOtpError({ kind: res.cooldownSeconds ? "rate_limited" : "generic", message: msg });
                          if (res.cooldownSeconds) setOtpCooldown(res.cooldownSeconds);
                          return;
                        }
                        setOtpSent(true);
                        setOtpCooldown(60);
                        toast.success(res.simulated ? "Codice di test inviato (modalità preview)." : "Codice inviato via WhatsApp.");
                      } finally {
                        setOtpBusy(false);
                        setOtpAction(null);
                        otpInFlightRef.current = false;
                      }
                    }}
                    disabled={otpBusy || !isValidPhone(form.phone_code, form.phone_number)}
                    aria-busy={otpAction === "send"}
                  >
                    {otpAction === "send" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Invio in corso…
                      </>
                    ) : (
                      "Invia codice di verifica"
                    )}
                  </Button>
                ) : (
                  <>
                    <Label>Codice di verifica (6 cifre)</Label>
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        if (otpError) setOtpError(null);
                      }}
                      placeholder="000000"
                      className={`text-center text-xl tracking-[0.4em] max-w-[200px] ${
                        otpError ? "border-destructive focus-visible:ring-destructive" : ""
                      }`}
                      aria-invalid={!!otpError}
                      aria-describedby={otpError ? "otp-error" : undefined}
                      disabled={otpBusy}
                    />
                    {otpError ? (
                      <p
                        id="otp-error"
                        role="alert"
                        className="text-sm font-medium text-destructive"
                      >
                        {otpError.kind === "expired"
                          ? "Codice scaduto. Richiedi un nuovo codice e riprova."
                          : otpError.kind === "invalid"
                            ? "Codice non valido. Controlla le 6 cifre ricevute su WhatsApp."
                            : otpError.message}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={async () => {
                          if (otpInFlightRef.current) return;
                          if (!/^\d{6}$/.test(otpCode)) {
                            const msg = "Inserisci un codice di 6 cifre.";
                            toast.error(msg);
                            setOtpError({ kind: "invalid", message: msg });
                            return;
                          }
                          otpInFlightRef.current = true;
                          setOtpAction("verify");
                          setOtpBusy(true);
                          setOtpError(null);
                          try {
                            const res = await verifyPhoneFn({ data: { code: otpCode } });
                            console.info("[PUPILLO_PHONE_ONBOARDING_DEBUG] OTP verify", { user_id: user?.id, res });
                            if (!res.ok) {
                              const raw = (res.error ?? "Codice non valido.").toString();
                              const lower = raw.toLowerCase();
                              const kind: "expired" | "invalid" | "generic" =
                                lower.includes("scadut") || lower.includes("expire")
                                  ? "expired"
                                  : lower.includes("non valido") ||
                                      lower.includes("invalid") ||
                                      lower.includes("errat") ||
                                      lower.includes("wrong")
                                    ? "invalid"
                                    : "generic";
                              toast.error(raw);
                              setOtpError({ kind, message: raw });
                              return;
                            }
                            toast.success("Numero verificato correttamente.");
                            setOtpCode("");
                            setOtpSent(false);
                            // Aggiorna lo step UI immediatamente — il refresh
                            // del contesto auth viene fatto in background.
                            setPhoneVerifiedOptimistic(true);
                            console.info(
                              "[PUPILLO_PHONE_ONBOARDING_DEBUG] phone_verified=true (optimistic) applied to onboarding step",
                              { user_id: user?.id },
                            );
                            otpJustVerifiedRef.current = true;
                            patchProfile({
                              phone_verified: true,
                              phone_verified_at: new Date().toISOString(),
                            });
                          } finally {
                            setOtpBusy(false);
                            setOtpAction(null);
                            otpInFlightRef.current = false;
                          }
                        }}
                        disabled={otpBusy || otpCode.length !== 6}
                        aria-busy={otpAction === "verify"}
                      >
                        {otpAction === "verify" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Verifica in corso…
                          </>
                        ) : (
                          "Verifica codice"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          if (otpInFlightRef.current) return;
                          if (otpCooldown > 0) return;
                          otpInFlightRef.current = true;
                          setOtpAction("resend");
                          setOtpBusy(true);
                          setOtpError(null);
                          try {
                            const res = await resendPhoneFn({ data: undefined as any });
                            console.info("[PUPILLO_PHONE_ONBOARDING_DEBUG] OTP resend", { user_id: user?.id, res });
                            if (!res.ok) {
                              const msg = res.error ?? "Reinvio fallito.";
                              toast.error(msg);
                              setOtpError({
                                kind: res.cooldownSeconds ? "rate_limited" : "generic",
                                message: msg,
                              });
                              if (res.cooldownSeconds) setOtpCooldown(res.cooldownSeconds);
                              return;
                            }
                            setOtpCode("");
                            setOtpCooldown(60);
                            toast.success("Codice reinviato.");
                          } finally {
                            setOtpBusy(false);
                            setOtpAction(null);
                            otpInFlightRef.current = false;
                          }
                        }}
                        disabled={otpBusy || otpCooldown > 0}
                        aria-busy={otpAction === "resend"}
                      >
                        {otpAction === "resend" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Reinvio…
                          </>
                        ) : otpCooldown > 0 ? (
                          `Reinvia (${otpCooldown}s)`
                        ) : (
                          "Reinvia codice"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode("");
                          setOtpError(null);
                        }}
                        disabled={otpBusy}
                      >
                        Cambia numero
                      </Button>
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Il numero verrà usato per le comunicazioni operative su WhatsApp.
                </p>
              </div>
            )}
          </div>
        </div>
        {role === "restaurant" ? (
          <>
            <div id="sec-business" className="grid gap-x-6 gap-y-4 md:grid-cols-2 items-start scroll-mt-24">
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
                    data-field="vat_number"
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
              <div data-field="venue_type" className="scroll-mt-24">
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
                    data-field="venue_type_other"
                  />
                )}
              </div>
              <div data-field="price_range" className="scroll-mt-24">
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
            <div id="sec-location" className="grid gap-x-6 gap-y-4 md:grid-cols-[1fr_140px] items-start scroll-mt-24">
              <div>
                <Label>Indirizzo *</Label>
                <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-field="address" />
              </div>
              <div>
                <Label>N. civico</Label>
                <Input
                  value={form.street_number}
                  onChange={(e) => setForm({ ...form, street_number: e.target.value })}
                />
              </div>
            </div>
            <LaunchAreaNotice />
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 items-start">
              <div data-field="province" className="scroll-mt-24">
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
              <div data-field="city" className="scroll-mt-24">
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
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-3 items-start">
              <div data-field="district" className="scroll-mt-24">
                 <Label>Zona / quartiere</Label>
                 <DistrictField
                   province={form.province}
                   city={form.city}
                   cap={form.postal_code}
                   value={form.district}
                   onChange={(v) => setForm({ ...form, district: v, postal_code: "" })}
                 />
              </div>
              <div data-field="postal_code" className="scroll-mt-24">
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
                <Select
                  value={form.country || "Italia"}
                  onValueChange={(v) => setForm({ ...form, country: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona paese" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Italia",
                      "Francia",
                      "Spagna",
                      "Germania",
                      "Svizzera",
                      "Austria",
                      "Regno Unito",
                      "Albania",
                      "Romania",
                      "Marocco",
                      "Egitto",
                      "Tunisia",
                      "Altro",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      data-field="contact_person_first_name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cognome</Label>
                    <Input
                      value={form.contact_person_last_name}
                      onChange={(e) => setForm({ ...form, contact_person_last_name: e.target.value })}
                      data-field="contact_person_last_name"
                    />
                  </div>
                  <div data-field="contact_person_role" className="scroll-mt-24">
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
                        data-field="contact_person_role_other"
                      />
                    )}
                  </div>
                  <div data-field="contact_person_phone" className="scroll-mt-24">
                    <Label className="text-xs">Telefono</Label>
                    <PhoneInput
                      code={form.contact_person_phone_code}
                      number={form.contact_person_phone_number}
                      onCodeChange={(c) => setForm({ ...form, contact_person_phone_code: c })}
                      onNumberChange={(n) => setForm({ ...form, contact_person_phone_number: n })}
                    />
                  </div>
                  <div className="md:col-span-2" data-field="contact_person_email">
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
              <RestaurantRequirementsEditor
                value={requirements}
                onChange={(next) => {
                  requirementsTouchedRef.current = true;
                  setRequirements(next);
                }}
              />
            </div>
          </>
        ) : role === "worker" ? (
          <>
            <div
              id="sec-avatar"
              data-field="avatar"
              className={cn(
                "rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24",
                hasErr("avatar") && errorFieldClass,
              )}
            >
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
                <div data-field="first_name" className="scroll-mt-24">
                  <Label>Nome *</Label>
                  {firstNameEditableRef.current !== false ? (
                    <Input
                      required
                      value={personal.first_name}
                      onChange={(e) =>
                        setPersonal({ ...personal, first_name: e.target.value })
                      }
                      className={cn(hasErr("first_name") && errorFieldClass)}
                      aria-invalid={hasErr("first_name")}
                    />
                  ) : (
                    <>
                      <Input
                        required
                        readOnly
                        value={personal.first_name}
                        className={cn(
                          "bg-muted/50 cursor-not-allowed",
                          hasErr("first_name") && errorFieldClass,
                        )}
                        aria-readonly="true"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Dato inserito in fase di registrazione. Per modificarlo contatta il supporto clienti.
                      </p>
                    </>
                  )}
                </div>
                <div data-field="last_name" className="scroll-mt-24">
                  <Label>Cognome *</Label>
                  {lastNameEditableRef.current !== false ? (
                    <Input
                      required
                      value={personal.last_name}
                      onChange={(e) =>
                        setPersonal({ ...personal, last_name: e.target.value })
                      }
                      className={cn(hasErr("last_name") && errorFieldClass)}
                      aria-invalid={hasErr("last_name")}
                    />
                  ) : (
                    <>
                      <Input
                        required
                        readOnly
                        value={personal.last_name}
                        className={cn(
                          "bg-muted/50 cursor-not-allowed",
                          hasErr("last_name") && errorFieldClass,
                        )}
                        aria-readonly="true"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Dato inserito in fase di registrazione. Per modificarlo contatta il supporto clienti.
                      </p>
                    </>
                  )}
                </div>
                <div data-field="birth_date" className={cn("scroll-mt-24", hasErr("birth_date") && errorFieldClass)}>
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
                <div data-field="birth_place" className={cn("scroll-mt-24", hasErr("birth_place") && errorFieldClass)}>
                  <Label>Luogo di nascita *</Label>
                  <Input required value={personal.birth_place} onChange={(e) => setPersonal({ ...personal, birth_place: e.target.value })} />
                </div>
                {taxCodeEnabled && (
                <div data-field="tax_code" className={cn("scroll-mt-24", hasErr("tax_code") && errorFieldClass)}>
                  <Label>Codice fiscale *</Label>
                  <Input
                    required
                    maxLength={16}
                    value={personal.tax_code}
                    onChange={(e) => {
                      setCfCoherenceError(null);
                      setPersonal({ ...personal, tax_code: e.target.value.toUpperCase() });
                    }}
                    onBlur={() => {
                      const cf = personal.tax_code.trim().toUpperCase();
                      if (!cf) return;
                      // Controllo di coerenza al blur solo se abbiamo anche
                      // data e luogo di nascita: altrimenti si valida solo
                      // il formato (già segnalato inline sotto).
                      if (!personal.birth_date && !personal.birth_place.trim()) return;
                      const res = validateCodiceFiscale({
                        cf,
                        birthDate: personal.birth_date,
                        birthPlace: personal.birth_place,
                        firstName: personal.first_name,
                        lastName: personal.last_name,
                      });
                      setCfCoherenceError(res.ok ? null : res.error);
                    }}
                  />
                  {personal.tax_code && !CF_REGEX.test(personal.tax_code.trim().toUpperCase()) && (
                    <p className="text-xs text-destructive mt-1">Codice fiscale non valido.</p>
                  )}
                  {cfCoherenceError && CF_REGEX.test(personal.tax_code.trim().toUpperCase()) && (
                    <p className="text-xs text-destructive mt-1">{cfCoherenceError}</p>
                  )}
                </div>
                )}
                <div data-field="nationality" className={cn("scroll-mt-24", hasErr("nationality") && errorFieldClass)}>
                  <Label>Nazionalità *</Label>
                  <SearchableSelect
                    options={NATIONALITIES.map((n) => ({
                      value: n.value,
                      label: `${n.flag} ${n.value}`,
                    }))}
                    value={personal.nationality?.trim() || ""}
                    onChange={(v) => setPersonal({ ...personal, nationality: v })}
                    placeholder="Seleziona nazionalità"
                    searchPlaceholder="Cerca nazionalità…"
                  />
                  {hasErr("nationality") && (
                    <p className="text-xs text-destructive mt-1">
                      Seleziona la tua nazionalità per continuare.
                    </p>
                  )}
                </div>
                <div data-field="residence_city" className={cn("scroll-mt-24", hasErr("residence_city") && errorFieldClass)}>
                  <Label>Città di residenza *</Label>
                  <SearchableSelect
                    options={RESIDENCE_CITY_OPTIONS}
                    value={personal.residence_city}
                    placeholder="Seleziona città"
                    searchPlaceholder="Cerca città"
                    onChange={(city) => {
                      const entry = findResidenceComune(city);
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {RESIDENCE_HELPER_TEXT}
                  </p>
                </div>
                <div data-field="residence_province">
                  <Label>Provincia *</Label>
                  <Input
                    value={personal.residence_province}
                    readOnly
                    disabled
                    placeholder="Auto"
                    aria-readonly="true"
                  />
                </div>
                <div data-field="residence_postal_code" className={cn("scroll-mt-24", hasErr("residence_postal_code") && errorFieldClass)}>
                  <Label>CAP *</Label>
                  <CapField
                    province={
                      findResidenceComune(
                        personal.residence_city,
                        personal.residence_province,
                      )?.province ?? null
                    }
                    city={personal.residence_city || null}
                    value={personal.residence_postal_code}
                    disabled={!personal.residence_city}
                    onChange={(cap) =>
                      setPersonal((s) => ({ ...s, residence_postal_code: cap }))
                    }
                  />
                </div>
                <div className={cn("md:col-span-2 scroll-mt-24", hasErr("residence_street") && errorFieldClass)} data-field="residence_street">
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
                <div data-field="residence_street_number" className={cn("scroll-mt-24", hasErr("residence_street_number") && errorFieldClass)}>
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

            {requireIdDocument && (
            <div id="sec-documento" className="rounded-xl border bg-muted/30 p-4 space-y-3 scroll-mt-24">
              <h3 className="font-semibold">🪪 Documento di identità *</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div data-field="id_document_type" className={cn("scroll-mt-24", hasErr("id_document_type") && errorFieldClass)}>
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
                <div data-field="id_document_number" className={cn("scroll-mt-24", hasErr("id_document_number") && errorFieldClass)}>
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
                <div data-field="id_document_issued_at" className={cn("scroll-mt-24", hasErr("id_document_issued_at") && errorFieldClass)}>
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
                <div data-field="id_document_expires_at" className={cn("scroll-mt-24", hasErr("id_document_expires_at") && errorFieldClass)}>
                  <Label>Data scadenza *</Label>
                  <DateField
                    required
                    value={personal.id_document_expires_at}
                    min={
                      personal.id_document_issued_at && personal.id_document_issued_at > todayISORome
                        ? personal.id_document_issued_at
                        : todayISORome
                    }
                    error={dateFieldErrors.id_document_expires_at}
                    onChange={(iso) => {
                      clearDateError("id_document_expires_at");
                      setPersonal({ ...personal, id_document_expires_at: iso });
                    }}
                  />
                </div>
                <div className={cn("md:col-span-2 scroll-mt-24", hasErr("id_document_issuer") && errorFieldClass)} data-field="id_document_issuer">
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
            )}

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
            <div id="sec-experience" className="rounded-xl border bg-muted/30 p-4 space-y-4 scroll-mt-24">
              <div>
                <h3 className="font-semibold">Esperienza e preferenze</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Queste informazioni aiutano i ristoratori a capire meglio il tuo profilo. Puoi compilarle ora o modificarle più avanti. Tutti i campi sono facoltativi.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Anni di esperienza</Label>
                  <Select
                    value={optExp.experience_years || "none"}
                    onValueChange={(v) => setOptExp({ ...optExp, experience_years: v === "none" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Non specificato" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non specificato</SelectItem>
                      <SelectItem value="meno_di_1">Meno di 1 anno</SelectItem>
                      <SelectItem value="1">1 anno</SelectItem>
                      <SelectItem value="2">2 anni</SelectItem>
                      <SelectItem value="3">3 anni</SelectItem>
                      <SelectItem value="4">4 anni</SelectItem>
                      <SelectItem value="5">5 anni</SelectItem>
                      <SelectItem value="6_10">6-10 anni</SelectItem>
                      <SelectItem value="oltre_10">Oltre 10 anni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Livello di esperienza</Label>
                  <Select
                    value={optExp.experience_level || "none"}
                    onValueChange={(v) => setOptExp({ ...optExp, experience_level: (v === "none" ? "" : v) as typeof optExp.experience_level })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna selezione</SelectItem>
                      <SelectItem value="junior">Basic</SelectItem>
                      <SelectItem value="intermediate">Pro</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="esperto">Esperto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tariffa oraria desiderata (€/h)</Label>
                  <Select
                    value={optExp.hourly_rate || "none"}
                    onValueChange={(v) => setOptExp({ ...optExp, hourly_rate: v === "none" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Non specificato" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non specificato</SelectItem>
                      <SelectItem value="8">8 €/h</SelectItem>
                      <SelectItem value="9">9 €/h</SelectItem>
                      <SelectItem value="10">10 €/h</SelectItem>
                      <SelectItem value="11">11 €/h</SelectItem>
                      <SelectItem value="12">12 €/h</SelectItem>
                      <SelectItem value="13">13 €/h</SelectItem>
                      <SelectItem value="14">14 €/h</SelectItem>
                      <SelectItem value="15">15 €/h</SelectItem>
                      <SelectItem value="16">16 €/h</SelectItem>
                      <SelectItem value="18">18 €/h</SelectItem>
                      <SelectItem value="20">20 €/h</SelectItem>
                      <SelectItem value="25">25 €/h</SelectItem>
                      <SelectItem value="30">30 €/h</SelectItem>
                      <SelectItem value="oltre_30">Oltre 30 €/h</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    La tariffa è indicativa. Il compenso finale dipende dal turno proposto dal ristoratore.
                  </p>
                </div>
                <div>
                  <Label>Sei automunito?</Label>
                  <Select
                    value={optExp.is_motorized || "none"}
                    onValueChange={(v) => setOptExp({ ...optExp, is_motorized: (v === "none" ? "" : v) as typeof optExp.is_motorized })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non specificato</SelectItem>
                      <SelectItem value="yes">Sì</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                      onClick={() => {
                        areaModeTouchedRef.current = true;
                        setAreaMode(opt.id);
                      }}
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
              <LaunchAreaNotice variant="worker" />
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
                {(areaMode === "zones" || areaMode === "georadar") && (
                <div>
                  <Label>{areaMode === "zones" ? "Zona / quartiere *" : "Zona / quartiere"}</Label>
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
                        service_area_district: loc.district || prev.service_area_district,
                      }));
                      setGpsServiceArea({ lat: loc.lat, lng: loc.lng });
                      setServiceAreaPreview({ lat: loc.lat, lng: loc.lng });
                      setServiceAreaError(null);
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
                    : "Usa la posizione attuale o inserisci città e zona per vedere l'anteprima."}
                </div>
              </div>
              )}
            </div>
            {/* Upload UI moved inside the "Documento di identità" section above. */}
          </>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: !!v })} />
          <span>
            Ho letto e accetto le{" "}
            <Link
              to="/terms"
              className="underline hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
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
          {busy ? "Salvataggio in corso..." : "Salva e continua"}
        </Button>
      </form>
      <Dialog
        open={availabilityPromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAvailabilityPromptOpen(false);
            nav({ to: "/dashboard" });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vuoi impostare subito le tue disponibilità?</DialogTitle>
            <DialogDescription>
              Profilo salvato correttamente. Imposta ora i giorni e gli orari in cui sei disponibile per iniziare subito a ricevere richieste di lavoro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                console.info("[PUPILLO_WORKER_AVAILABILITY_PROMPT_DEBUG] dismissed");
                localStorage.setItem("pupillo_availability_prompt_dismissed", "true");
                setAvailabilityPromptOpen(false);
                nav({ to: "/dashboard" });
              }}
            >
              Lo farò più tardi
            </Button>
            <Button
              type="button"
              onClick={() => {
                console.info("[PUPILLO_WORKER_AVAILABILITY_PROMPT_DEBUG] go to availability");
                setAvailabilityPromptOpen(false);
                nav({ to: "/availability" });
              }}
            >
              Imposta disponibilità
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
