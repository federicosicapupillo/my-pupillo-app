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
import { verifyVat } from "@/server/vat.functions";
import { useServerFn } from "@tanstack/react-start";

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
      service_area_radius_m: String(profile.service_area_radius_m ?? 500),
      terms_accepted: profile.terms_accepted,
    }));
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.terms_accepted) { toast.error("Devi accettare le condizioni d'uso"); return; }
    setBusy(true);
    let serviceArea: { service_area_lat: number | null; service_area_lng: number | null } = { service_area_lat: null, service_area_lng: null };
    if (role === "worker" && form.service_area_address.trim().length >= 3) {
      const r = await geocodeAddressWithRetry(form.service_area_address.trim(), { maxAttempts: 2 });
      if (r.ok) serviceArea = { service_area_lat: r.lat, service_area_lng: r.lng };
    }
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
      service_area_radius_m: parseInt(form.service_area_radius_m) || 500,
      ...serviceArea,
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    if (role === "restaurant" && form.vat_number.trim()) {
      try {
        const r = await verifyVatFn({ data: { vat_number: form.vat_number.trim() } });
        if (r.status === "valid") toast.success(`P.IVA verificata${r.companyName ? `: ${r.companyName}` : ""}`);
        else if (r.status === "invalid") toast.error("Partita IVA non valida");
        else toast.warning("Verifica P.IVA non disponibile, riproveremo più tardi");
      } catch (e) {
        toast.warning("Verifica P.IVA non riuscita");
      }
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