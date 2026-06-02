import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { KeyRound, Trash2, FileText, Coins, Star, Eye, EyeOff, User, Building2, BadgeCheck, ShieldCheck } from "lucide-react";
import { SpokenLanguagesView, SpokenLanguagesEditor, normalizeSpokenLanguages, type SpokenLanguage } from "@/components/SpokenLanguages";
import { venueTypeLabel } from "@/lib/venue-types";
import { priceRangeLabel } from "@/lib/price-range";
import { provinceCode, splitAddressAndCivic } from "@/lib/italian-locations";
import { ReferralCard } from "@/components/ReferralCard";
import { WorkerReputationCard } from "@/components/WorkerReputationCard";
import { WorkerMyReviews } from "@/components/WorkerMyReviews";
import { WorkerReputationBadge } from "@/components/WorkerReputationBadge";
import { AvatarUpload } from "@/components/AvatarUpload";
import { uploadAvatar } from "@/lib/avatar-upload.functions";
import { useServerFn } from "@tanstack/react-start";
import { updateAvatarUrlCache, useAvatarUrl } from "@/hooks/use-avatar-urls";
import { SearchableSelect } from "@/components/SearchableSelect";
import { WORKER_CITIES } from "@/lib/worker-cities";
import { WorkerRolesMultiSelect } from "@/components/WorkerRolesMultiSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock } from "lucide-react";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profilo — Pupillo" }] }),
  component: () => <RequireAuth><Profile /></RequireAuth>,
});

function Profile() {
  const { profile, role, user, refresh } = useAuth();
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  // Account deletion is handled by DeleteAccountDialog (multi-step flow + RPC).

  return (
    <AppShell>
      <PageHeader
        title="Il tuo profilo"
        subtitle="Visualizza e modifica le tue informazioni"
      />
      {role === "restaurant" && <PayOnHireBox className="mb-6" />}
      {role === "worker" ? (
        <WorkerProfileSections profile={profile as any} email={user?.email ?? null} userId={user?.id ?? null} onSaved={refresh} />
      ) : role === "restaurant" ? (
        <RestaurantProfileView profile={profile as any} email={user?.email ?? null} />
      ) : null}

      <div className="mt-6">
        <ReferralCard />
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-6">
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

      <div className="mt-6 rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Documenti</h2>
        <Link to="/terms" className="text-sm text-primary underline">Leggi le condizioni d'uso e la privacy policy</Link>
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-6">
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
        <div className="mt-6">
          <h2 className="font-semibold mb-2">La mia reputazione</h2>
          <WorkerReputationCard workerId={user.id} profile={profile as any} showTips />
        </div>
      )}

      {role === "worker" && user?.id && (
        <div className="mt-6">
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

      <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" />Cancella account</h2>
        <p className="text-sm text-muted-foreground mt-1">Cancella i tuoi dati personali dalla piattaforma. L'operazione è irreversibile.</p>
        <Button variant="destructive" className="mt-3" onClick={() => setDeleteOpen(true)}>Elimina account</Button>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </AppShell>
  );
}

function ProfileBox({
  title,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
  children,
  canEdit = true,
}: {
  title: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
  canEdit?: boolean;
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-base">{title}</h2>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={onEdit}>Modifica</Button>
        )}
      </header>
      <div className="space-y-3">{children}</div>
      {editing && (
        <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t">
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvataggio…" : "Salva modifiche"}</Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Annulla</Button>
        </div>
      )}
    </section>
  );
}

function useBoxSave(userId: string | null, onSaved: () => Promise<void> | void, messages?: { success?: string; error?: string }) {
  const [saving, setSaving] = useState(false);
  const save = async (patch: Record<string, unknown>): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", userId);
      if (error) throw error;
      toast.success(messages?.success ?? "Profilo aggiornato correttamente.");
      await onSaved();
      return true;
    } catch (error) {
      console.error("Profile box save failed", { error, patch });
      toast.error(messages?.error ?? "Non è stato possibile aggiornare il profilo. Riprova.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

function AvatarBox({ profile, userId, onSaved }: { profile: any; userId: string | null; onSaved: () => Promise<void> | void }) {
  const uploadAvatarFn = useServerFn(uploadAvatar);
  const currentAvatarUrl = useAvatarUrl(userId);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview ?? currentAvatarUrl ?? null;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name;
  const initials = fullName ? fullName.split(/\s+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("") : "";

  const cancel = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setEditing(false);
  };

  const save = async () => {
    if (!userId || !file) { setEditing(false); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadAvatarFn({ data: fd });
      if (!res.ok) { toast.error(res.error); setSaving(false); return; }
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(res.path, 60 * 60);
      const { error } = await supabase.from("profiles").update({ avatar_url: res.path } as any).eq("id", userId);
      if (error) throw error;
      if (signed?.signedUrl) updateAvatarUrlCache(userId, signed.signedUrl, profile?.full_name ?? null);
      toast.success("Profilo aggiornato correttamente.");
      setFile(null); setPreview(null); setEditing(false);
      await onSaved();
    } catch {
      toast.error("Non è stato possibile aggiornare il profilo. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileBox title="Foto profilo" editing={editing} saving={saving} onEdit={() => setEditing(true)} onCancel={cancel} onSave={save}>
      {editing ? (
        <AvatarUpload value={displayUrl} onPickFile={(f, p) => { setFile(f); setPreview(p); }} />
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border bg-muted flex items-center justify-center">
            {displayUrl ? (
              <img src={displayUrl} alt="Foto profilo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">{initials || "—"}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{displayUrl ? "Foto caricata" : "Nessuna foto caricata"}</p>
        </div>
      )}
    </ProfileBox>
  );
}

function PersonalDataBox({ profile, email }: { profile: any; email: string | null }) {
  return (
    <ProfileBox title="Dati personali (verificati)" editing={false} saving={false} onEdit={() => {}} onCancel={() => {}} onSave={() => {}} canEdit={false}>
      <div className="grid gap-3 md:grid-cols-2">
        <LockedInput label="Nome" value={profile?.first_name ?? ""} />
        <LockedInput label="Cognome" value={profile?.last_name ?? ""} />
        <LockedInput label="Email" value={email ?? profile?.email ?? ""} />
        <LockedInput label="Telefono" value={profile?.phone_full ?? profile?.phone ?? ""} />
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-2">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Per modificare questi dati contatta il servizio clienti.</span>
      </p>
    </ProfileBox>
  );
}

function ResidenceBox({ profile, userId, onSaved }: { profile: any; userId: string | null; onSaved: () => Promise<void> | void }) {
  const legacyAddress = splitAddressAndCivic(profile?.residence_address);
  const displayCity = profile?.residence_city ?? profile?.city ?? "";
  const displayStreet = profile?.residence_street ?? legacyAddress.street ?? "";
  const displayNumber = profile?.residence_number ?? legacyAddress.civic ?? "";
  const displayAddress = displayStreet && displayNumber ? `${displayStreet}, ${displayNumber}` : "";
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState<string>(displayCity);
  const [street, setStreet] = useState<string>(displayStreet);
  const [number, setNumber] = useState<string>(displayNumber);
  const [errors, setErrors] = useState<Partial<Record<"city" | "street" | "number", string>>>({});
  const { saving, save } = useBoxSave(userId, onSaved, {
    success: "Residenza aggiornata correttamente.",
    error: "Non è stato possibile aggiornare la residenza. Riprova.",
  });

  const start = () => {
    const currentLegacyAddress = splitAddressAndCivic(profile?.residence_address);
    setCity(profile?.residence_city ?? profile?.city ?? "");
    setStreet(profile?.residence_street ?? currentLegacyAddress.street ?? "");
    setNumber(profile?.residence_number ?? currentLegacyAddress.civic ?? "");
    setErrors({});
    setEditing(true);
  };
  const cancel = () => { setEditing(false); setErrors({}); };

  const validate = () => {
    const next: typeof errors = {};
    if (!city.trim()) next.city = "Seleziona la città di residenza.";
    if (!street.trim()) next.street = "Inserisci la via di residenza.";
    if (!number.trim()) next.number = "Inserisci il numero civico.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    const ok = await save({
      residence_city: city.trim() || null,
      residence_street: street.trim() || null,
      residence_number: number.trim() || null,
      residence_address: `${street.trim()}, ${number.trim()}`,
    });
    if (ok) setEditing(false);
  };

  return (
    <ProfileBox title="Residenza" editing={editing} saving={saving} onEdit={start} onCancel={cancel} onSave={onSave}>
      {editing ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Città di residenza <span className="text-destructive">*</span></Label>
            <SearchableSelect
              options={WORKER_CITIES as unknown as string[]}
              value={city}
              onChange={(v) => { setCity(v); if (errors.city) setErrors(p => ({ ...p, city: undefined })); }}
              placeholder="Seleziona città"
              triggerClassName={errors.city ? "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive/60 focus-visible:border-destructive" : undefined}
            />
            {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city}</p>}
          </div>
          <div className="md:col-span-2">
            <Label>Via <span className="text-destructive">*</span></Label>
            <Input
              value={street}
              onChange={(e) => { setStreet(e.target.value); if (errors.street) setErrors(p => ({ ...p, street: undefined })); }}
              className={cn(errors.street && "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive/60 focus-visible:border-destructive")}
              placeholder="Inserisci la via"
            />
            {errors.street && <p className="mt-1 text-xs text-destructive">{errors.street}</p>}
          </div>
          <div>
            <Label>Numero civico <span className="text-destructive">*</span></Label>
            <Input
              value={number}
              onChange={(e) => { setNumber(e.target.value); if (errors.number) setErrors(p => ({ ...p, number: undefined })); }}
              className={cn(errors.number && "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive/60 focus-visible:border-destructive")}
              placeholder="12, 12/A, 12 bis, SNC…"
            />
            {errors.number && <p className="mt-1 text-xs text-destructive">{errors.number}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Città di residenza</p>
            <p className="text-sm font-medium">{displayCity || "Città non completata"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Indirizzo di residenza</p>
            <p className={cn("text-sm font-medium", !displayAddress && "text-muted-foreground")}>
              {displayAddress || "Indirizzo non completato"}
            </p>
          </div>
        </div>
      )}
    </ProfileBox>
  );
}

function RolesBox({ profile, userId, onSaved }: { profile: any; userId: string | null; onSaved: () => Promise<void> | void }) {
  const initial = Array.from(new Set([
    ...((profile?.secondary_roles as string[] | null | undefined) ?? []),
    ...(profile?.primary_role ? [profile.primary_role] : []),
  ].filter(Boolean)));
  const [editing, setEditing] = useState(false);
  const [roles, setRoles] = useState<string[]>(initial);
  const { saving, save } = useBoxSave(userId, onSaved);

  const start = () => { setRoles(initial); setEditing(true); };
  const onSave = async () => {
    const ok = await save({ primary_role: roles[0] ?? null, secondary_roles: roles });
    if (ok) setEditing(false);
  };

  return (
    <ProfileBox title="Ruoli e competenze" editing={editing} saving={saving} onEdit={start} onCancel={() => setEditing(false)} onSave={onSave}>
      {editing ? (
        <WorkerRolesMultiSelect value={roles} onChange={setRoles} />
      ) : (
        <p className="text-sm font-medium">{initial.join(", ") || "—"}</p>
      )}
    </ProfileBox>
  );
}

function LanguagesBox({ profile, userId, onSaved }: { profile: any; userId: string | null; onSaved: () => Promise<void> | void }) {
  const initial = normalizeSpokenLanguages(profile?.spoken_languages);
  const [editing, setEditing] = useState(false);
  const [langs, setLangs] = useState<SpokenLanguage[]>(initial);
  const { saving, save } = useBoxSave(userId, onSaved);

  const start = () => { setLangs(normalizeSpokenLanguages(profile?.spoken_languages)); setEditing(true); };
  const onSave = async () => {
    const ok = await save({ spoken_languages: langs as any, languages: langs.map((l) => l.language) });
    if (ok) setEditing(false);
  };

  return (
    <ProfileBox title="Lingue parlate" editing={editing} saving={saving} onEdit={start} onCancel={() => setEditing(false)} onSave={onSave}>
      {editing ? (
        <SpokenLanguagesEditor value={langs} onChange={setLangs} />
      ) : (
        <SpokenLanguagesView value={initial} />
      )}
    </ProfileBox>
  );
}

function ExperienceBox({ profile, userId, onSaved }: { profile: any; userId: string | null; onSaved: () => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const initialLevel = (profile?.experience_level === "junior" || profile?.experience_level === "intermediate" || profile?.experience_level === "senior" || profile?.experience_level === "esperto" || profile?.experience_level === "prima_esperienza") ? profile.experience_level : "";
  const initialMotor = profile?.is_motorized === true ? "yes" : profile?.is_motorized === false ? "no" : "";
  const [years, setYears] = useState<string>(profile?.experience_years ?? "");
  const [level, setLevel] = useState<string>(initialLevel);
  const [rate, setRate] = useState<string>(
    profile?.hourly_rate != null
      ? (Number(profile.hourly_rate) >= 31 ? "oltre_30" : String(profile.hourly_rate))
      : "",
  );
  const [motor, setMotor] = useState<"" | "yes" | "no">(initialMotor as any);
  const { saving, save } = useBoxSave(userId, onSaved);

  const start = () => {
    setYears(profile?.experience_years ?? "");
    setLevel(initialLevel);
    setRate(
      profile?.hourly_rate != null
        ? (Number(profile.hourly_rate) >= 31 ? "oltre_30" : String(profile.hourly_rate))
        : "",
    );
    setMotor(initialMotor as any);
    setEditing(true);
  };

  const onSave = async () => {
    const rateVal = rate.trim();
    const rateNum = (() => {
      if (!rateVal) return null;
      if (rateVal === "oltre_30") return 31;
      const n = Number(rateVal.replace(",", "."));
      if (!Number.isFinite(n) || n < 8) return null;
      return n;
    })();
    const ok = await save({
      experience_years: years.trim() || null,
      experience_level: level || null,
      hourly_rate: rateNum,
      is_motorized: motor === "yes" ? true : motor === "no" ? false : null,
    });
    if (typeof console !== "undefined") {
      console.log("[PUPILLO_WORKER_EXPERIENCE_PREFERENCES_EDIT_DEBUG]", {
        worker_user_id: userId,
        years_experience: years.trim() || null,
        experience_level: level || null,
        desired_hourly_rate: rateNum,
        has_vehicle: motor === "yes" ? true : motor === "no" ? false : null,
        dati_salvati_correttamente: ok,
      });
    }
    if (ok) setEditing(false);
  };

  const levelLabel = (l: string | null | undefined) => {
    if (!l) return "—";
    const map: Record<string, string> = {
      prima_esperienza: "Prima esperienza",
      junior: "Junior",
      intermediate: "Intermedio",
      esperto: "Esperto",
      senior: "Senior",
    };
    return map[l] || l;
  };
  const motorLabel = profile?.is_motorized === true ? "Sì" : profile?.is_motorized === false ? "No" : "Non specificato";
  const yearsLabel = (y: string | null | undefined) => {
    if (!y) return "—";
    const map: Record<string, string> = {
      prima_esperienza: "Prima esperienza",
      meno_di_1: "Meno di 1 anno",
      oltre_10: "Oltre 10 anni",
    };
    return map[y] || y;
  };
  const rateLabel = (r: number | null) => {
    if (r == null) return "—";
    if (r >= 31) return "Oltre 30 €/h";
    return `€${r}/h`;
  };

  const YEARS_OPTIONS = [
    { value: "", label: "Non specificato" },
    { value: "prima_esperienza", label: "Prima esperienza" },
    { value: "meno_di_1", label: "Meno di 1 anno" },
    { value: "1", label: "1 anno" },
    { value: "2", label: "2 anni" },
    { value: "3", label: "3 anni" },
    { value: "4", label: "4 anni" },
    { value: "5", label: "5 anni" },
    { value: "6_10", label: "6-10 anni" },
    { value: "oltre_10", label: "Oltre 10 anni" },
  ];

  const LEVEL_OPTIONS = [
    { value: "", label: "Non specificato" },
    { value: "prima_esperienza", label: "Prima esperienza" },
    { value: "junior", label: "Junior" },
    { value: "intermediate", label: "Intermedio" },
    { value: "esperto", label: "Esperto" },
    { value: "senior", label: "Senior" },
  ];

  const RATE_OPTIONS = [
    { value: "", label: "Non specificato" },
    { value: "8", label: "8 €/h" },
    { value: "9", label: "9 €/h" },
    { value: "10", label: "10 €/h" },
    { value: "11", label: "11 €/h" },
    { value: "12", label: "12 €/h" },
    { value: "13", label: "13 €/h" },
    { value: "14", label: "14 €/h" },
    { value: "15", label: "15 €/h" },
    { value: "16", label: "16 €/h" },
    { value: "18", label: "18 €/h" },
    { value: "20", label: "20 €/h" },
    { value: "25", label: "25 €/h" },
    { value: "30", label: "30 €/h" },
    { value: "oltre_30", label: "Oltre 30 €/h" },
  ];

  return (
    <ProfileBox title="Esperienza e preferenze" editing={editing} saving={saving} onEdit={start} onCancel={() => setEditing(false)} onSave={onSave}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Anni di esperienza</Label>
              <Select value={years || "none"} onValueChange={(v) => setYears(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {YEARS_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "none"} value={o.value || "none"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Livello di esperienza</Label>
              <Select value={level || "none"} onValueChange={(v) => setLevel(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "none"} value={o.value || "none"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tariffa oraria desiderata</Label>
              <Select value={rate || "none"} onValueChange={(v) => setRate(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {RATE_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "none"} value={o.value || "none"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">La tariffa è indicativa. Il compenso finale dipende dal turno proposto dal ristoratore.</p>
            </div>
            <div>
              <Label>Sei automunito?</Label>
              <Select value={motor || "none"} onValueChange={(v) => setMotor((v === "none" ? "" : v) as any)}>
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
      ) : (
        <div className="space-y-2 text-sm">
          <Row label="Anni di esperienza" value={yearsLabel(profile?.experience_years)} />
          <Row label="Livello" value={levelLabel(profile?.experience_level)} />
          <Row label="Tariffa oraria desiderata" value={rateLabel(profile?.hourly_rate)} />
          <Row label="Automunito" value={motorLabel} />
        </div>
      )}
    </ProfileBox>
  );
}

function WorkerProfileSections({ profile, email, userId, onSaved }: { profile: any; email: string | null; userId: string | null; onSaved: () => Promise<void> | void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AvatarBox profile={profile} userId={userId} onSaved={onSaved} />
      <PersonalDataBox profile={profile} email={email} />
      <ResidenceBox profile={profile} userId={userId} onSaved={onSaved} />
      <RolesBox profile={profile} userId={userId} onSaved={onSaved} />
      <LanguagesBox profile={profile} userId={userId} onSaved={onSaved} />
      <ExperienceBox profile={profile} userId={userId} onSaved={onSaved} />
    </div>
  );
}

function LockedInput({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} readOnly aria-readonly="true" className="bg-muted/50 cursor-not-allowed" />
    </div>
  );
}

function EditableInput({
  label,
  value,
  editing,
  onChange,
  options,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (next: string) => void;
  options?: readonly string[] | string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      {editing && options ? (
        <SearchableSelect options={options} value={value} onChange={onChange} placeholder="Seleziona" />
      ) : (
        <Input
          value={value}
          readOnly={!editing}
          onChange={(e) => onChange(e.target.value)}
          className={!editing ? "bg-muted/50" : undefined}
        />
      )}
    </div>
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

function SensitiveRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground flex items-center gap-1">
        <Lock className="h-3 w-3" />{label}
      </span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function RestaurantLocationEditor({
  draft,
  onChange,
}: {
  draft: any;
  onChange: (next: any) => void;
}) {
  void draft; void onChange;
  return null;
}

function vatStatusLabel(s?: string | null) {
  if (!s) return "Non verificata";
  if (s === "valid") return "Partita IVA verificata ✓";
  if (s === "invalid") return "Partita IVA non verificata ✗";
  if (s === "pending") return "Verifica in attesa…";
  return "Verifica non disponibile";
}

function InfoRow({
  label,
  value,
  locked,
  badge,
}: {
  label: string;
  value?: string | null;
  locked?: boolean;
  badge?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        {locked && <Lock className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-sm font-medium text-right break-words">
        {value || <span className="text-muted-foreground">—</span>}
        {badge && <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium dark:bg-emerald-900/30 dark:text-emerald-300">{badge}</span>}
      </span>
    </div>
  );
}

function RestaurantProfileView({ profile, email }: { profile: any; email: string | null }) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name;
  const phone = profile?.phone_full || profile?.phone;
  const provLabel = profile?.province
    ? `${profile.province}${profile?.province_code || provinceCode(profile.province) ? ` (${profile?.province_code || provinceCode(profile.province)})` : ""}`
    : null;
  const vatBadge = profile?.vat_status === "valid" ? "Verificata" : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Informazioni account */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><User className="h-4 w-4" /></div>
          <h2 className="font-semibold text-base">Informazioni account</h2>
        </header>
        <div className="space-y-1">
          <InfoRow label="Nome e cognome" value={fullName} locked />
          <InfoRow label="Email" value={email ?? profile?.email} locked />
          <InfoRow label="Ruolo" value="Ristoratore" />
        </div>
      </section>

      {/* Informazioni locale */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 className="h-4 w-4" /></div>
          <h2 className="font-semibold text-base">Informazioni locale</h2>
        </header>
        <div className="space-y-1">
          <InfoRow label="Nome locale" value={profile?.business_name} locked />
          <InfoRow label="Partita IVA" value={profile?.vat_number} locked badge={vatBadge} />
          {profile?.vat_company_name && (
            <InfoRow label="Ragione sociale (VIES)" value={profile.vat_company_name} locked />
          )}
          <InfoRow label="Tipologia locale" value={venueTypeLabel(profile?.venue_type, profile?.venue_type_other)} />
          <InfoRow label="Fascia di prezzo" value={priceRangeLabel(profile?.price_range)} />
          <InfoRow label="Paese" value={profile?.country} />
          <InfoRow label="Provincia" value={provLabel} />
          <InfoRow label="Città" value={profile?.city} />
          <InfoRow label="Indirizzo" value={profile?.address} />
        </div>
      </section>

      {/* Contatti verificati */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><BadgeCheck className="h-4 w-4" /></div>
          <h2 className="font-semibold text-base">Contatti verificati</h2>
        </header>
        <div className="space-y-1">
          <InfoRow
            label="Telefono"
            value={phone}
            locked
            badge={profile?.phone_verified ? "Verificato" : null}
          />
          <InfoRow
            label="Email"
            value={email ?? profile?.email}
            locked
            badge={profile?.email ? "Verificata" : null}
          />
        </div>
      </section>

      {/* Stato profilo */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-4 w-4" /></div>
          <h2 className="font-semibold text-base">Stato profilo</h2>
        </header>
        <div className="space-y-1">
          <InfoRow label="Profilo completato" value={profile?.profile_completed ? "Sì" : "No"} />
          <InfoRow label="Stato P.IVA" value={vatStatusLabel(profile?.vat_status)} />
        </div>
      </section>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1 lg:col-span-2">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>I dati verificati sono bloccati. Per modificarli contatta il servizio clienti.</span>
      </p>
    </div>
  );
}