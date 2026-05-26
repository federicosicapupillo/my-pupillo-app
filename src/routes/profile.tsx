import { PayOnHireBox } from "@/components/PayOnHireInfo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, Trash2, FileText, Coins, Star, Eye, EyeOff, User, Building2, BadgeCheck, ShieldCheck } from "lucide-react";
import { SpokenLanguagesView, normalizeSpokenLanguages } from "@/components/SpokenLanguages";
import { venueTypeLabel } from "@/lib/venue-types";
import { priceRangeLabel } from "@/lib/price-range";
import { provinceCode } from "@/lib/italian-locations";
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
import { Lock } from "lucide-react";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

const NATIONALITIES = [
  "Italiana", "Albanese", "Rumena", "Marocchina", "Egiziana", "Tunisina",
  "Francese", "Spagnola", "Tedesca", "Inglese", "Ucraina", "Moldava",
  "Peruviana", "Brasiliana", "Argentina", "Cinese", "Indiana", "Pakistana",
  "Bangladese", "Filippina",
];

type WorkerDraft = {
  nationality: string;
  residence_address: string;
  residence_city: string;
  residence_province: string;
  service_area_city: string;
  professional_profile: string;
  roles: string[];
};

function workerDraftFromProfile(profile: any): WorkerDraft {
  const roles = [
    ...((profile?.secondary_roles as string[] | null | undefined) ?? []),
    ...(profile?.primary_role ? [profile.primary_role] : []),
  ].filter(Boolean);
  return {
    nationality: profile?.nationality ?? "",
    residence_address: profile?.residence_address ?? "",
    residence_city: profile?.residence_city ?? profile?.city ?? "",
    residence_province: profile?.residence_province ?? profile?.province ?? "",
    service_area_city: profile?.service_area_city ?? "",
    professional_profile: profile?.professional_profile ?? "",
    roles: Array.from(new Set(roles)),
  };
}

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profilo — Pupillo" }] }),
  component: () => <RequireAuth><Profile /></RequireAuth>,
});

function Profile() {
  const { profile, role, user, refresh } = useAuth();
  const uploadAvatarFn = useServerFn(uploadAvatar);
  const currentAvatarUrl = useAvatarUrl(role === "worker" ? user?.id : null);
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingWorker, setEditingWorker] = useState(false);
  const [savingWorker, setSavingWorker] = useState(false);
  const [workerDraft, setWorkerDraft] = useState(() => workerDraftFromProfile(profile));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (role !== "worker" || editingWorker) return;
    setWorkerDraft(workerDraftFromProfile(profile));
    setAvatarFile(null);
    setAvatarPreview(null);
  }, [profile, role, editingWorker]);

  const startWorkerEdit = () => {
    setWorkerDraft(workerDraftFromProfile(profile));
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditingWorker(true);
  };

  const cancelWorkerEdit = () => {
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setWorkerDraft(workerDraftFromProfile(profile));
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditingWorker(false);
  };

  const saveWorkerProfile = async () => {
    if (!user) return;
    setSavingWorker(true);
    try {
      let uploadedAvatarPath: string | undefined;
      let signedAvatarUrl: string | null = null;
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const res = await uploadAvatarFn({ data: fd });
        if (!res.ok) {
          toast.error(res.error);
          setSavingWorker(false);
          return;
        }
        uploadedAvatarPath = res.path;
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(res.path, 60 * 60);
        signedAvatarUrl = signed?.signedUrl ?? null;
      }
      const update: Record<string, unknown> = {
        nationality: workerDraft.nationality.trim() || null,
        residence_address: workerDraft.residence_address.trim() || null,
        residence_city: workerDraft.residence_city.trim() || null,
        residence_province: workerDraft.residence_province.trim().toUpperCase() || null,
        service_area_city: workerDraft.service_area_city.trim() || null,
        professional_profile: workerDraft.professional_profile.trim() || null,
        primary_role: workerDraft.roles[0] ?? null,
        secondary_roles: workerDraft.roles,
      };
      if (uploadedAvatarPath) update.avatar_url = uploadedAvatarPath;
      const { error } = await supabase.from("profiles").update(update as any).eq("id", user.id);
      if (error) throw error;
      if (signedAvatarUrl) updateAvatarUrlCache(user.id, signedAvatarUrl, profile?.full_name ?? null);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditingWorker(false);
      toast.success("Profilo aggiornato correttamente.");
      await refresh();
    } catch {
      toast.error("Errore durante il salvataggio. Riprova.");
    } finally {
      setSavingWorker(false);
    }
  };

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
        action={
          role === "worker" ? (
            editingWorker ? null : <Button onClick={startWorkerEdit}>Modifica</Button>
          ) : null
        }
      />
      {role === "restaurant" && <PayOnHireBox className="mb-6 max-w-2xl" />}
      {role === "worker" ? (
      <div className="rounded-2xl border bg-card p-6 max-w-2xl space-y-3">
          <WorkerProfileEditor
            profile={profile as any}
            email={user?.email ?? null}
            avatarUrl={(profile as any)?.avatar_url ? (avatarPreview ?? currentAvatarUrl ?? null) : (avatarPreview ?? null)}
            editing={editingWorker}
            saving={savingWorker}
            draft={workerDraft}
            onDraftChange={setWorkerDraft}
            onPickAvatar={(file: File | null, preview: string | null) => {
              setAvatarFile(file);
              setAvatarPreview(preview);
            }}
            onEdit={startWorkerEdit}
            onCancel={cancelWorkerEdit}
            onSave={saveWorkerProfile}
          />
      </div>
      ) : role === "restaurant" ? (
        <RestaurantProfileView profile={profile as any} email={user?.email ?? null} />
      ) : null}

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
        <Button variant="destructive" className="mt-3" onClick={() => setDeleteOpen(true)}>Elimina account</Button>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </AppShell>
  );
}

function WorkerProfileEditor({
  profile,
  email,
  avatarUrl,
  editing,
  saving,
  draft,
  onDraftChange,
  onPickAvatar,
  onEdit,
  onCancel,
  onSave,
}: {
  profile: any;
  email: string | null;
  avatarUrl: string | null;
  editing: boolean;
  saving: boolean;
  draft: WorkerDraft;
  onDraftChange: (next: WorkerDraft) => void;
  onPickAvatar: (file: File | null, preview: string | null) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name;
  const avatarInitials = fullName
    ? fullName.split(/\s+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("")
    : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {editing ? (
            <AvatarUpload value={avatarUrl} onPickFile={onPickAvatar} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border bg-muted flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Foto profilo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground">{avatarInitials || "—"}</span>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Foto profilo</div>
                <p className="text-sm text-muted-foreground">{avatarUrl ? "Foto caricata" : "Nessuna foto caricata"}</p>
              </div>
            </div>
          )}
        </div>
        {!editing && <Button variant="outline" onClick={onEdit}>Modifica</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <LockedInput label="Nome" value={profile?.first_name ?? ""} />
        <LockedInput label="Cognome" value={profile?.last_name ?? ""} />
        <LockedInput label="Email" value={email ?? profile?.email ?? ""} />
        <LockedInput label="Telefono" value={profile?.phone_full ?? profile?.phone ?? ""} />
        <EditableInput
          label="Nazionalità"
          editing={editing}
          value={draft.nationality}
          onChange={(nationality) => onDraftChange({ ...draft, nationality })}
          options={NATIONALITIES}
        />
        <EditableInput
          label="Città di residenza"
          editing={editing}
          value={draft.residence_city}
          onChange={(residence_city) => onDraftChange({ ...draft, residence_city })}
        />
        <EditableInput
          label="Provincia"
          editing={editing}
          value={draft.residence_province}
          onChange={(residence_province) => onDraftChange({ ...draft, residence_province })}
        />
        <EditableInput
          label="Città di partenza"
          editing={editing}
          value={draft.service_area_city}
          onChange={(service_area_city) => onDraftChange({ ...draft, service_area_city })}
          options={WORKER_CITIES as unknown as string[]}
        />
        <div className="md:col-span-2">
          <Label>Indirizzo di residenza</Label>
          <Input
            value={draft.residence_address}
            readOnly={!editing}
            onChange={(e) => onDraftChange({ ...draft, residence_address: e.target.value })}
            className={!editing ? "bg-muted/50" : undefined}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Esperienze</Label>
          <Textarea
            value={draft.professional_profile}
            readOnly={!editing}
            onChange={(e) => onDraftChange({ ...draft, professional_profile: e.target.value })}
            className={!editing ? "bg-muted/50" : undefined}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Competenze / ruoli</Label>
          {editing ? (
            <WorkerRolesMultiSelect value={draft.roles} onChange={(roles) => onDraftChange({ ...draft, roles })} />
          ) : (
            <p className="mt-1 text-sm font-medium">{draft.roles.join(", ") || "—"}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Lingue parlate</div>
          <SpokenLanguagesView value={normalizeSpokenLanguages(profile?.spoken_languages)} />
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvataggio in corso…" : "Salva modifiche"}</Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Annulla</Button>
        </div>
      )}
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
    <div className="space-y-6 max-w-2xl">
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

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>I dati verificati sono bloccati. Per modificarli contatta il servizio clienti.</span>
      </p>
    </div>
  );
}