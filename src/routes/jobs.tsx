import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, MapPin, Euro, MessageSquare } from "lucide-react";
import { formatTariff } from "@/lib/format";
import { publicLocationLabel } from "@/lib/public-location";

export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "Le mie offerte — Pupillo" }] }),
  component: () => <RequireAuth><Jobs /></RequireAuth>,
});

type Row = {
  id: string; status: string; created_at: string; restaurant_id: string;
  announcement: { id: string; service_date: string; service_time: string; duration_hours: number; tariff_amount: number; tariff_type: string; speed: string; job_city: string | null; job_province: string | null; assigned_worker_id: string | null } | null;
  restaurant: { full_name: string | null; business_name: string | null; city: string | null; neighborhood: string | null } | null;
};

function Jobs() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: apps } = await supabase.from("applications")
      .select("id, status, created_at, restaurant_id, announcement_id")
      .eq("worker_id", user.id).order("created_at", { ascending: false });
    const annIds = (apps ?? []).map(a => a.announcement_id);
    const restIds = (apps ?? []).map(a => a.restaurant_id);
    const [{ data: anns }, { data: rests }] = await Promise.all([
      annIds.length ? supabase.from("announcements").select("id, service_date, service_time, duration_hours, tariff_amount, tariff_type, speed, job_city, job_province, assigned_worker_id").in("id", annIds) : Promise.resolve({ data: [] }),
      restIds.length ? supabase.from("profiles").select("id, full_name, business_name, city, neighborhood").in("id", restIds) : Promise.resolve({ data: [] }),
    ]);
    const annMap = new Map((anns ?? []).map((a: any) => [a.id, a]));
    const restMap = new Map((rests ?? []).map((r: any) => [r.id, r]));
    setRows((apps ?? []).map((a: any) => ({
      ...a,
      announcement: annMap.get(a.announcement_id) ?? null,
      restaurant: restMap.get(a.restaurant_id) ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const respond = async (id: string, status: "interested" | "not_interested") => {
    const { error } = await supabase.from("applications").update({
      status, worker_response_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "interested" && user) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("application_id", id)
        .eq("sender_id", user.id)
        .eq("message_type", "auto_application")
        .maybeSingle();
      if (!existing) {
        await supabase.from("messages").insert({
          application_id: id,
          sender_id: user.id,
          message_type: "auto_application",
          body: "Ciao! Ho inviato la mia candidatura per il turno pubblicato.\n\nSono disponibile nell'orario richiesto e resto a disposizione per conferma o ulteriori informazioni. A presto!",
        });
      }
      toast.success("Candidatura inviata correttamente");
      navigate({ to: "/messages/$id", params: { id } });
      return;
    }
    toast.success("Offerta rifiutata");
    load();
  };

  if (role !== "worker") return <AppShell><p className="text-muted-foreground">Sezione riservata ai lavoratori.</p></AppShell>;

  return (
    <AppShell>
      <PageHeader title="Le mie offerte" subtitle="Offerte ricevute dai ristoratori" />
      {loading ? <p className="text-muted-foreground">Caricamento…</p> : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Nessuna offerta ricevuta.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(r => (
            <div key={r.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="font-semibold">{r.restaurant?.business_name || r.restaurant?.full_name || "Ristoratore"}</div>
                <span className="text-xs rounded-full bg-secondary px-2 py-1 capitalize">{r.status}</span>
              </div>
              {r.announcement && (
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(r.announcement.service_date).toLocaleDateString("it-IT")} · {r.announcement.service_time?.slice(0,5)} ({r.announcement.duration_hours}h)</div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{publicLocationLabel({
                    job_city: r.announcement.job_city,
                    city: r.restaurant?.city,
                    neighborhood: r.restaurant?.neighborhood,
                  })}</div>
                  <div className="flex items-center gap-2"><Euro className="h-4 w-4" />{formatTariff(r.announcement.tariff_amount, r.announcement.tariff_type)}</div>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                {r.status === "pending" && (<>
                  <Button size="sm" className="flex-1" onClick={() => respond(r.id, "interested")}>Sono interessato</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => respond(r.id, "not_interested")}>Rifiuta</Button>
                </>)}
                <Link to="/messages/$id" params={{ id: r.id }}><Button size="sm" variant="secondary" className="gap-2"><MessageSquare className="h-4 w-4" />Chat</Button></Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}