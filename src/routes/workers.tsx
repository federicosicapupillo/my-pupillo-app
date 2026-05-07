import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/workers")({
  head: () => ({ meta: [{ title: "Cerca lavoratori — Pupillo" }] }),
  component: () => <RequireAuth><WorkersPage /></RequireAuth>,
});

type W = { id: string; full_name: string | null; age: number | null; languages: string[] | null; professional_profile: string | null };
type Ann = { id: string; service_date: string; location_address: string };

function WorkersPage() {
  const { user, role } = useAuth();
  const [workers, setWorkers] = useState<W[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "worker");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, full_name, age, languages, professional_profile").in("id", ids);
        setWorkers((data as W[]) ?? []);
      }
      if (user) {
        const { data } = await supabase.from("announcements").select("id, service_date, location_address").eq("restaurant_id", user.id).eq("status", "active");
        setAnns((data as Ann[]) ?? []);
        if (data?.[0]) setSelected(data[0].id);
      }
    })();
  }, [user]);

  if (role !== "restaurant") return <AppShell><p>Solo i ristoratori.</p></AppShell>;

  const invite = async (workerId: string) => {
    if (!selected || !user) { toast.error("Seleziona prima un annuncio"); return; }
    const { error } = await supabase.from("applications").insert({
      announcement_id: selected,
      worker_id: workerId,
      restaurant_id: user.id,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else {
      await supabase.from("notifications").insert({ user_id: workerId, title: "Nuova offerta di lavoro", body: "Un ristoratore ti ha contattato.", link: "/jobs" });
      toast.success("Lavoratore contattato!");
    }
  };

  return (
    <AppShell>
      <PageHeader title="Cerca lavoratori" subtitle="Trova personale extra disponibile" />
      <div className="mb-4 max-w-md">
        <label className="text-sm font-medium">Annuncio per cui contattare</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Nessun annuncio attivo" /></SelectTrigger>
          <SelectContent>
            {anns.map((a) => <SelectItem key={a.id} value={a.id}>{new Date(a.service_date).toLocaleDateString("it-IT")} · {a.location_address}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workers.map((w) => (
          <div key={w.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">{w.full_name?.[0] ?? "?"}</div>
              <div>
                <div className="font-semibold">{w.full_name || "Lavoratore"}</div>
                {w.age && <div className="text-xs text-muted-foreground">{w.age} anni</div>}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{w.professional_profile || "Profilo non specificato"}</p>
            {w.languages && w.languages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {w.languages.map((l) => <span key={l} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{l}</span>)}
              </div>
            )}
            <Button size="sm" className="mt-4 w-full" onClick={() => invite(w.id)} disabled={!selected}>Contatta</Button>
          </div>
        ))}
        {workers.length === 0 && <p className="text-muted-foreground">Nessun lavoratore registrato.</p>}
      </div>
    </AppShell>
  );
}