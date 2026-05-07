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
import { KeyRound, Trash2, FileText, Coins, Star } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profilo — Pupillo" }] }),
  component: () => <RequireAuth><Profile /></RequireAuth>,
});

function Profile() {
  const { profile, role, user, signOut } = useAuth();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("La password deve avere almeno 6 caratteri"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password aggiornata"); setPwd(""); }
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
      <div className="rounded-2xl border bg-card p-6 max-w-2xl space-y-3">
        <Row label="Email" value={user?.email} />
        <Row label="Ruolo" value={role} />
        <Row label="Nome" value={profile?.full_name} />
        <Row label="Telefono" value={profile?.phone} />
        {role === "restaurant" && (<>
          <Row label="Nome locale" value={profile?.business_name} />
          <Row label="Partita IVA" value={profile?.vat_number} />
          <Row label="Stato verifica P.IVA" value={vatStatusLabel(profile?.vat_status)} />
          {profile?.vat_company_name && <Row label="Ragione sociale (VIES)" value={profile.vat_company_name} />}
          <Row label="Tipo locale" value={profile?.venue_type} />
          <Row label="Indirizzo" value={profile?.address} />
          <Row label="Fascia prezzo" value={profile?.price_range} />
        </>)}
        {role === "worker" && (<>
          <Row label="Età" value={profile?.age?.toString()} />
          <Row label="Lingue" value={profile?.languages?.join(", ")} />
          <Row label="Profilo professionale" value={profile?.professional_profile} />
        </>)}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" />Cambia password</h2>
        <form onSubmit={changePassword} className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="flex-1"><Label className="sr-only">Nuova password</Label><Input type="password" minLength={6} placeholder="Nuova password" value={pwd} onChange={e => setPwd(e.target.value)} /></div>
          <Button type="submit" disabled={busy || !pwd}>Aggiorna</Button>
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

function vatStatusLabel(s?: string | null) {
  if (!s) return null;
  if (s === "valid") return "Verificata ✓";
  if (s === "invalid") return "Non valida ✗";
  if (s === "pending") return "In verifica…";
  return "Errore di verifica";
}