import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

type Row = {
  id: string;
  restaurant_user_id: string;
  worker_user_id: string;
  shift_id: string | null;
  application_id: string | null;
  status: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  restaurant_name?: string;
  worker_name?: string;
  restaurant_blocked?: boolean;
  shift_date?: string | null;
};

export function AdminRequiredReviewsSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "completed">("overdue");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("required_reviews")
      .select("*")
      .order("due_date", { ascending: false })
      .limit(500);
    const items = (data ?? []) as Row[];
    const userIds = Array.from(new Set(items.flatMap((r) => [r.restaurant_user_id, r.worker_user_id])));
    const shiftIds = Array.from(new Set(items.map((r) => r.shift_id).filter(Boolean))) as string[];
    const [{ data: profs }, { data: shifts }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name, business_name, review_blocked").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      shiftIds.length
        ? supabase.from("shifts").select("id, shift_date").in("id", shiftIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => (pmap[p.id] = p));
    const smap: Record<string, any> = {};
    (shifts ?? []).forEach((s: any) => (smap[s.id] = s));
    setRows(
      items.map((r) => ({
        ...r,
        restaurant_name: pmap[r.restaurant_user_id]?.business_name ?? pmap[r.restaurant_user_id]?.full_name ?? "—",
        worker_name: pmap[r.worker_user_id]?.full_name ?? "—",
        restaurant_blocked: !!pmap[r.restaurant_user_id]?.review_blocked,
        shift_date: r.shift_id ? smap[r.shift_id]?.shift_date ?? null : null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  const dismiss = async (r: Row) => {
    const { error } = await (supabase as any)
      .from("required_reviews")
      .update({ status: "dismissed_by_admin", completed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (user) {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "admin_dismiss_required_review",
        entity_type: "required_review",
        entity_id: r.id,
        metadata: { restaurant_user_id: r.restaurant_user_id },
      });
    }
    toast.success("Recensione marcata come risolta");
    load();
  };

  const sendReminder = async (r: Row) => {
    const { error } = await supabase.from("notifications").insert({
      user_id: r.restaurant_user_id,
      title: "Promemoria recensione",
      body: "Ricordati di lasciare la recensione del lavoratore per il turno completato.",
      link: r.application_id ? `/messages/${r.application_id}` : "/shifts",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Promemoria inviato");
  };

  const daysLate = (r: Row) => {
    const ms = Date.now() - new Date(r.due_date).getTime();
    return ms > 0 ? Math.floor(ms / (1000 * 60 * 60 * 24)) : 0;
  };

  return (
    <div className="mt-8 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
        <div className="font-medium">Recensioni obbligatorie</div>
        <div className="flex flex-wrap gap-2">
          {(["overdue", "pending", "completed", "all"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "overdue" ? "Scadute" : f === "pending" ? "In corso" : f === "completed" ? "Completate" : "Tutte"}
            </Button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun record.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Ristoratore</th>
                <th className="pr-3">Lavoratore</th>
                <th className="pr-3">Turno</th>
                <th className="pr-3">Scadenza</th>
                <th className="pr-3">Stato</th>
                <th className="pr-3">Ritardo</th>
                <th className="pr-3">Blocco</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 pr-3">{r.restaurant_name}</td>
                  <td className="pr-3">{r.worker_name}</td>
                  <td className="pr-3">{r.shift_date ? new Date(r.shift_date).toLocaleDateString("it-IT") : "—"}</td>
                  <td className="pr-3">{new Date(r.due_date).toLocaleDateString("it-IT")}</td>
                  <td className="pr-3">
                    {r.status === "overdue" ? (
                      <span className="text-xs text-destructive font-medium">Scaduta</span>
                    ) : r.status === "pending" ? (
                      <span className="text-xs text-amber-600">In corso</span>
                    ) : r.status === "completed" ? (
                      <span className="text-xs text-emerald-600">Completata</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Risolta</span>
                    )}
                  </td>
                  <td className="pr-3">{r.status === "overdue" ? `${daysLate(r)}gg` : "—"}</td>
                  <td className="pr-3">{r.restaurant_blocked ? <span className="text-xs text-destructive">Bloccato</span> : <span className="text-xs text-muted-foreground">No</span>}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {r.status !== "completed" && r.status !== "dismissed_by_admin" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => sendReminder(r)}>Promemoria</Button>
                          <Button size="sm" variant="ghost" onClick={() => dismiss(r)}>Risolvi</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}