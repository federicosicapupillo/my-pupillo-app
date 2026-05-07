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

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Completa il profilo — Pupillo" }] }),
  component: () => <RequireAuth><Onboarding /></RequireAuth>,
});

function Onboarding() {
  const { user, role, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "", phone: "", age: "", professional_profile: "", languages: "",
    business_name: "", vat_number: "", venue_type: "", address: "", price_range: "",
    terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);

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
      terms_accepted: profile.terms_accepted,
    }));
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.terms_accepted) { toast.error("Devi accettare le condizioni d'uso"); return; }
    setBusy(true);
    const update = role === "restaurant" ? {
      full_name: form.full_name, phone: form.phone,
      terms_accepted: true, profile_completed: true,
      business_name: form.business_name, vat_number: form.vat_number,
      venue_type: form.venue_type, address: form.address, price_range: form.price_range,
    } : {
      full_name: form.full_name, phone: form.phone,
      terms_accepted: true, profile_completed: true,
      age: form.age ? parseInt(form.age) : null,
      professional_profile: form.professional_profile,
      languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
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
              <div><Label>Partita IVA</Label><Input required value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
              <div><Label>Tipologia locale</Label><Input placeholder="Pizzeria, Ristorante…" value={form.venue_type} onChange={(e) => setForm({ ...form, venue_type: e.target.value })} /></div>
              <div><Label>Fascia di prezzo</Label><Input placeholder="€, €€, €€€" value={form.price_range} onChange={(e) => setForm({ ...form, price_range: e.target.value })} /></div>
            </div>
            <div><Label>Indirizzo</Label><Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Età</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              <div><Label>Lingue parlate (separate da virgola)</Label><Input placeholder="Italiano, Inglese" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} /></div>
            </div>
            <div><Label>Profilo professionale</Label><Textarea rows={4} value={form.professional_profile} onChange={(e) => setForm({ ...form, professional_profile: e.target.value })} /></div>
          </>
        )}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: !!v })} />
          <span>Ho letto e accetto le condizioni d'uso e la privacy policy.</span>
        </label>
        <Button type="submit" disabled={busy}>{busy ? "Salvataggio..." : "Salva e continua"}</Button>
      </form>
    </AppShell>
  );
}