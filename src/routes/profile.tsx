import { PayOnHireBox } from "@/components/PayOnHireInfo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, Trash2, FileText, Coins, Star, MapPin, ExternalLink, Eye, EyeOff } from "lucide-react";
import { RestaurantRequirementsView, reqFromProfile } from "@/components/RestaurantRequirements";
import { SpokenLanguagesView, normalizeSpokenLanguages } from "@/components/SpokenLanguages";
import { venueTypeLabel } from "@/lib/venue-types";
import { priceRangeLabel } from "@/lib/price-range";
import { ClipboardList } from "lucide-react";
import { hasSavedDefaults } from "@/lib/restaurant-defaults";
import { Settings2 } from "lucide-react";
import { provinceCode } from "@/lib/italian-locations";
import { ReferralCard } from "@/components/ReferralCard";
import { WorkerReputationCard } from "@/components/WorkerReputationCard";
import { WorkerMyReviews } from "@/components/WorkerMyReviews";
import { WorkerReputationBadge } from "@/components/WorkerReputationBadge";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profilo — Pupillo" }] }),
  component: () => <RequireAuth><Profile /></RequireAuth>,
});

function Profile() {
  const { profile, role, user, signOut } = useAuth();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("La password deve avere almeno 6 caratteri"); return; }
    if (!pwdConfirm) { toast.error("Conferma la nuova password"); return; }
    if (pwd !== pwdConfirm) { toast.error("Le password non coincidono."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password aggiornata correttamente."); setPwd(""); setPwdConfirm(""); }
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (!confirm("Sei sicuro di voler cancellare definitivamente il tuo account? L'operazione è irreversibile.")) return;
    // Soft delete: clear personal data + sign out (hard delete needs admin)
    const { error } = await supabase.from("profiles").update({
      full_name: null, phone: null, address: null, business_name: null, vat_number: null,
      venue_type: null, price_range: null, professional_profile: null, age: null,
      languages: [], profile_completed: false, terms_accepted: false,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profilo cancellato. Contatta il supporto per la rimozione completa dei dati.");
    await signOut();
    nav({ to: "/" });
  };

  return (
    <AppShell>
      <PageHeader title="Il tuo profilo" subtitle="Visualizza e modifica le tue informazioni" action={<Link to="/onboarding"><Button>Modifica</Button></Link>} />
      {role === "restaurant" && <PayOnHireBox className="mb-6 max-w-2xl" />}
      <div className="rounded-2xl border bg-card p-6 max-w-2xl space-y-3">
        <Row label="Email" value={user?.email} />
        <Row label="Ruolo" value={role} />
        <Row label="Nome e cognome" value={[(profile as any)?.first_name, (profile as any)?.last_name].filter(Boolean).join(" ") || profile?.full_name} />
        <Row label="Telefono" value={(profile as any)?.phone_full || profile?.phone} />
        {role === "restaurant" && (<>
          <Row label="Nome locale" value={profile?.business_name} />
          <Row label="Partita IVA" value={profile?.vat_number} />
          <Row label="Stato verifica P.IVA" value={vatStatusLabel(profile?.vat_status)} />
          {profile?.vat_company_name && <Row label="Ragione sociale (VIES)" value={profile.vat_company_name} />}
          <Row label="Tipologia locale" value={venueTypeLabel(profile?.venue_type, (profile as any)?.venue_type_other)} />
          <Row label="Provincia" value={(profile as any)?.province ? `${(profile as any).province}${(profile as any)?.province_code || provinceCode((profile as any).province) ? ` (${(profile as any)?.province_code || provinceCode((profile as any).province)})` : ""}` : null} />
          <Row label="Città" value={(profile as any)?.city} />
          <Row label="Indirizzo" value={profile?.address} />
          <Row label="Fascia di prezzo" value={priceRangeLabel(profile?.price_range)} />
        </>)}
        {role === "worker" && (<>
          <Row label="Età" value={profile?.age?.toString()} />
          <Row label="Profilo professionale" value={profile?.professional_profile} />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Lingue parlate</div>
            <SpokenLanguagesView value={normalizeSpokenLanguages((profile as any)?.spoken_languages)} />
          </div>
        </>)}
      </div>

      {role === "restaurant" && (
        <div className="mt-6 max-w-2xl rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Luogo e Accesso</h2>
              <p className="text-sm text-muted-foreground mt-1">Informazioni operative usate negli annunci e mostrate ai lavoratori.</p>
            </div>
            <Link to="/onboarding"><Button size="sm" variant="outline">Modifica</Button></Link>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Indirizzo</div>
              <p className="text-base font-medium">{[profile?.address, profile?.city, profile?.province, profile?.country].filter(Boolean).join(", ") || "—"}</p>
              {(profile as any)?.latitude != null && (profile as any)?.longitude != null && (
                <a className="text-xs text-primary inline-flex items-center gap-1 mt-1" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${(profile as any).latitude}&mlon=${(profile as any).longitude}#map=17/${(profile as any).latitude}/${(profile as any).longitude}`}>
                  <ExternalLink className="h-3 w-3" />Apri sulla mappa
                </a>
              )}
            </div>
            <Field label="Restrizioni all'ingresso" value={(profile as any)?.access_restrictions} />
            <Field label="Indicazioni aggiuntive" value={(profile as any)?.additional_directions} />
            <Field label="Note per il lavoratore" value={(profile as any)?.location_notes} />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Referente operativo</div>
              <p className="text-base font-medium">
                {[(profile as any)?.contact_person_first_name, (profile as any)?.contact_person_last_name].filter(Boolean).join(" ") || "—"}
                {(profile as any)?.contact_person_role && (
                  <span className="text-muted-foreground font-normal"> · {
                    (profile as any).contact_person_role === "Altro"
                      ? ((profile as any).contact_person_role_other || "Altro")
                      : (profile as any).contact_person_role
                  }</span>
                )}
              </p>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                {(profile as any)?.contact_person_phone && <span>📞 {(profile as any).contact_person_phone}</span>}
                {(profile as any)?.contact_person_email && <span>✉️ {(profile as any).contact_person_email}</span>}
              </div>
            </div>
            {(profile as any)?.representative_age != null && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Età del referente (privata)</div>
                <p className="text-base">{(profile as any).representative_age} anni {(profile as any)?.age_verified && <span className="text-xs text-emerald-600">· verificata</span>}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {role === "restaurant" && (
        <div className="mt-6 max-w-4xl rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Requisiti e Competenze</h2>
              <p className="text-sm text-muted-foreground mt-1">Impostazioni standard del locale, precompilate in ogni nuovo annuncio.</p>
            </div>
            <Link to="/onboarding"><Button size="sm" variant="outline">Modifica requisiti</Button></Link>
          </div>
          <RestaurantRequirementsView value={reqFromProfile(profile)} />
        </div>
      )}

      {role === "restaurant" && (
        <DefaultsSection profile={profile} userId={user?.id} />
      )}

      <div className="mt-6 max-w-4xl">
        <ReferralCard />
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" />Cambia password</h2>
        <form onSubmit={changePassword} className="mt-3 space-y-3">
          <div>
            <Label htmlFor="new-pwd">Nuova password *</Label>
            <div className="relative mt-1">
              <Input
                id="new-pwd"
                type={showPwd ? "text" : "password"}
                minLength={6}
                required
                placeholder="Nuova password"
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? "Nascondi password" : "Mostra password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-pwd">Conferma nuova password *</Label>
            <div className="relative mt-1">
              <Input
                id="confirm-pwd"
                type={showPwdConfirm ? "text" : "password"}
                minLength={6}
                required
                placeholder="Conferma nuova password"
                value={pwdConfirm}
                onChange={e => setPwdConfirm(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwdConfirm(v => !v)}
                aria-label={showPwdConfirm ? "Nascondi password" : "Mostra password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPwdConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwdConfirm && pwd !== pwdConfirm && (
              <p className="mt-1 text-xs text-destructive">Le password non coincidono.</p>
            )}
          </div>
          <Button type="submit" disabled={busy || !pwd || !pwdConfirm || pwd !== pwdConfirm}>
            Aggiorna password
          </Button>
        </form>
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Documenti</h2>
        <Link to="/terms" className="text-sm text-primary underline">Leggi le condizioni d'uso e la privacy policy</Link>
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2"><Coins className="h-4 w-4" />Piano e crediti</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">Piano attuale</div>
            <div className="mt-1 text-lg font-semibold capitalize">{profile?.plan ?? "free"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">Crediti disponibili</div>
            <div className="mt-1 text-lg font-semibold">{profile?.credits ?? 0}</div>
          </div>
        </div>
        {role === "restaurant" && (
          <p className="text-xs text-muted-foreground mt-3">I crediti vengono usati per pubblicare annunci urgenti e contattare lavoratori.</p>
        )}
        {role === "worker" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-xs text-muted-foreground">Valutazione</div>
                <div className="text-sm font-semibold">{Number(profile?.rating_avg ?? 0).toFixed(1)} · {profile?.reviews_count ?? 0} recensioni</div>
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Affidabilità</div>
              <div className="text-sm font-semibold">{profile?.reliability_pct ?? 100}%</div>
            </div>
          </div>
        )}
      </div>

      {role === "worker" && user?.id && (
        <div className="mt-6 max-w-2xl">
          <h2 className="font-semibold mb-2">La mia reputazione</h2>
          <WorkerReputationCard workerId={user.id} profile={profile as any} showTips />
        </div>
      )}

      {role === "worker" && user?.id && (
        <div className="mt-6 max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" />Le mie recensioni</h2>
            <WorkerReputationBadge profile={profile as any} />
          </div>
          <div className="rounded-2xl border bg-card p-4 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Valutazione</div>
              <div className="text-lg font-semibold">{Number(profile?.rating_avg ?? 0).toFixed(1)} / 5</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recensioni</div>
              <div className="text-lg font-semibold">{profile?.reviews_count ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Turni completati</div>
              <div className="text-lg font-semibold">{(profile as any)?.completed_shifts ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Affidabilità</div>
              <div className="text-lg font-semibold">{(profile as any)?.completion_pct ?? profile?.reliability_pct ?? 100}%</div>
            </div>
          </div>
          <WorkerMyReviews workerId={user.id} />
        </div>
      )}

      <div className="mt-6 max-w-2xl rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" />Cancella account</h2>
        <p className="text-sm text-muted-foreground mt-1">Cancella i tuoi dati personali dalla piattaforma. L'operazione è irreversibile.</p>
        <Button variant="destructive" className="mt-3" onClick={deleteAccount}>Cancella il mio account</Button>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">{label}</div>
      <p className="text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function vatStatusLabel(s?: string | null) {
  if (!s) return "Non verificata";
  if (s === "valid") return "Partita IVA verificata ✓";
  if (s === "invalid") return "Partita IVA non verificata ✗";
  if (s === "pending") return "Verifica in attesa…";
  return "Verifica non disponibile";
}

function DefaultsSection({ profile, userId }: { profile: any; userId?: string }) {
  const has = hasSavedDefaults(profile);
  const updatedAt = profile?.default_settings_updated_at
    ? new Date(profile.default_settings_updated_at).toLocaleString("it-IT")
    : null;

  const clearDefaults = async () => {
    if (!userId) return;
    if (!confirm("Cancellare le impostazioni predefinite degli annunci?")) return;
    const { error } = await supabase.from("profiles").update({
      default_license_requirement: null,
      default_language_requirements: [],
      default_tattoos_allowed: null,
      default_piercings_allowed: null,
      default_beard_allowed: null,
      default_required_skills: [],
      default_dress_code_items: [],
      default_dress_code_notes: null,
      default_settings_updated_at: null,
    } as any).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("Impostazioni predefinite cancellate"); window.location.reload(); }
  };

  const restoreFromProfile = async () => {
    if (!userId || !profile) return;
    const update: any = {
      default_settings_updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("Impostazioni ripristinate dai dati del profilo"); window.location.reload(); }
  };

  return (
    <div className="mt-6 max-w-4xl rounded-2xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Impostazioni predefinite annunci</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {has
              ? `Queste impostazioni vengono caricate automaticamente quando crei un nuovo annuncio.${updatedAt ? ` Ultimo aggiornamento: ${updatedAt}.` : ""}`
              : "Non hai ancora salvato impostazioni predefinite. Compila un annuncio e seleziona “Salva come predefinite” per crearle."}
          </p>
        </div>
      </div>
      {has && (
        <div className="space-y-3 text-sm">
          <Field label="Luogo predefinito" value={[profile?.address, profile?.neighborhood, profile?.city, profile?.province, profile?.postal_code, profile?.country].filter(Boolean).join(", ")} />
          <Field label="Referente predefinito" value={[
            [profile?.contact_person_first_name, profile?.contact_person_last_name].filter(Boolean).join(" "),
            profile?.contact_person_phone,
            profile?.contact_person_email,
          ].filter(Boolean).join(" · ")} />
          <Field label="Tipologia locale" value={venueTypeLabel(profile?.venue_type, profile?.venue_type_other)} />
          <Field label="Fascia di prezzo" value={priceRangeLabel(profile?.price_range)} />
          <Field label="Lingue richieste" value={(profile?.default_language_requirements || []).join(", ")} />
          <Field label="Patente richiesta" value={profile?.default_license_requirement} />
          <Field label="Competenze richieste" value={(profile?.default_required_skills || []).join(", ")} />
          <Field label="Dress code" value={(profile?.default_dress_code_items || []).join(", ")} />
          <Field label="Note dress code" value={profile?.default_dress_code_notes} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/onboarding"><Button size="sm" variant="outline">Modifica impostazioni predefinite</Button></Link>
        {has && <Button size="sm" variant="outline" onClick={restoreFromProfile}>Ripristina dai dati del profilo</Button>}
        {has && <Button size="sm" variant="destructive" onClick={clearDefaults}>Cancella impostazioni predefinite</Button>}
      </div>
    </div>
  );
}