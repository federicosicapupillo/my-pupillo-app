import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Coins, Briefcase, Star, Phone, Mail, Globe, ArrowLeft, MessageSquare, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/restaurants/$id")({
  head: () => ({ meta: [{ title: "Dettaglio ristoratore — Pupillo" }] }),
  component: () => <RequireAuth><RestaurantDetailPage /></RequireAuth>,
});

type Restaurant = Record<string, any>;
type Ann = {
  id: string;
  professional_profile: string | null;
  location_address: string | null;
  status: string | null;
  shift_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hourly_rate: number | null;
  created_at: string | null;
};

function statusBadge(s?: string | null) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700",
    pending: "bg-amber-500/15 text-amber-700",
    suspended: "bg-red-500/15 text-red-700",
    expired: "bg-muted text-muted-foreground",
  };
  return map[s || ""] || "bg-muted text-muted-foreground";
}

function RestaurantDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<Restaurant | null>(null);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof, error }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("announcements")
          .select("id, professional_profile, location_address, status, shift_date, start_time, end_time, hourly_rate, created_at")
          .eq("restaurant_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (error) toast.error("Errore nel caricamento");
      setR(prof || null);
      setAnns((a as Ann[]) || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <AppShell><div className="p-8 text-sm text-muted-foreground">Caricamento…</div></AppShell>;
  }
  if (!r) {
    return (
      <AppShell>
        <PageHeader title="Ristoratore non trovato" />
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Il profilo richiesto non esiste o è stato rimosso.
          <div className="mt-4"><Link to="/mappa"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Torna alla mappa</Button></Link></div>
        </div>
      </AppShell>
    );
  }

  const name = r.business_name || r.full_name || "Locale";
  const fullAddress = [r.address, r.neighborhood, r.city].filter(Boolean).join(", ");
  const activeAnns = anns.filter(a => a.status === "active");

  return (
    <AppShell>
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/mappa" })} className="gap-1">
          <ArrowLeft className="h-4 w-4" />Indietro
        </Button>
      </div>

      <PageHeader
        title={name}
        subtitle={[r.venue_type, r.city].filter(Boolean).join(" · ") || "Ristoratore"}
      />

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`rounded-full px-3 py-1 text-xs capitalize ${statusBadge(r.account_status)}`}>{r.account_status || "—"}</span>
        <span className="rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs capitalize">Piano {r.plan || "free"}</span>
        {r.rating_avg ? <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"><Star className="h-3 w-3" />{Number(r.rating_avg).toFixed(1)}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-4">
          {/* Info card */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold mb-3">Informazioni locale</h2>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field icon={<MapPin className="h-4 w-4" />} label="Indirizzo" value={fullAddress || "—"} />
              <Field label="Tipologia" value={r.venue_type || "—"} />
              <Field label="Città" value={r.city || "—"} />
              <Field label="Zona" value={r.neighborhood || "—"} />
              <Field icon={<Phone className="h-4 w-4" />} label="Telefono" value={r.phone || "—"} />
              <Field icon={<Mail className="h-4 w-4" />} label="Email" value={r.email || "—"} />
              {r.website && <Field icon={<Globe className="h-4 w-4" />} label="Sito" value={r.website} />}
              {r.vat_number && <Field label="P.IVA" value={r.vat_number} />}
            </dl>
            {r.bio && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Descrizione</div>
                <p className="text-sm whitespace-pre-wrap">{r.bio}</p>
              </div>
            )}
          </div>

          {/* Active announcements */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Richieste attive</h2>
              <span className="text-xs text-muted-foreground">{activeAnns.length} attive · {anns.length} totali</span>
            </div>
            {activeAnns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna richiesta attiva al momento.</p>
            ) : (
              <ul className="space-y-2">
                {activeAnns.map(a => (
                  <li key={a.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{a.professional_profile || "Annuncio"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.shift_date || "Data da definire"}
                          {a.start_time && a.end_time ? ` · ${a.start_time}–${a.end_time}` : ""}
                        </div>
                        {a.location_address && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{a.location_address}
                          </div>
                        )}
                      </div>
                      {a.hourly_rate != null && (
                        <span className="text-xs rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5 whitespace-nowrap">
                          €{Number(a.hourly_rate).toFixed(2)}/h
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar / CTA */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="grid grid-cols-2 gap-3 text-center">
              <Stat icon={<Briefcase className="h-4 w-4" />} label="Richieste attive" value={activeAnns.length} />
              <Stat icon={<Coins className="h-4 w-4" />} label="Crediti" value={r.credits ?? 0} />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-sm">Azioni</h3>
            {r.account_status === "active" ? (
              <>
                <Link to="/messages" className="block">
                  <Button className="w-full gap-2"><MessageSquare className="h-4 w-4" />Contatta</Button>
                </Link>
                <Link to="/browse" className="block">
                  <Button variant="outline" className="w-full gap-2"><Briefcase className="h-4 w-4" />Vedi richieste</Button>
                </Link>
              </>
            ) : r.account_status === "pending" ? (
              <p className="text-xs text-muted-foreground">Profilo in attesa di verifica. Le azioni saranno disponibili una volta attivato.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Questo ristoratore non è attualmente attivo.</p>
            )}
            {r.service_area_lat != null && r.service_area_lng != null && (
              <Link to="/mappa" className="block">
                <Button variant="ghost" className="w-full gap-2"><MapIcon className="h-4 w-4" />Mostra sulla mappa</Button>
              </Link>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5 text-sm">{icon}<span className="truncate">{value}</span></div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">{icon}{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}