import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateSupportTicketStatus } from "@/lib/assistant.functions";

type Ticket = {
  id: string;
  user_id: string;
  user_role: string | null;
  category: string;
  message: string;
  page_url: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["aperto", "in_lavorazione", "risolto", "chiuso"] as const;

export function AdminSupportTicketsSection() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const updateStatus = useServerFn(updateSupportTicketStatus);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const change = async (id: string, status: typeof STATUSES[number]) => {
    try {
      await updateStatus({ data: { id, status } });
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore aggiornamento");
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="font-medium">Segnalazioni utenti</div>
          <div className="text-xs text-muted-foreground">Ticket inviati dalla chat di assistenza</div>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Caricamento…</div>
      ) : tickets.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nessuna segnalazione.</div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-lg border bg-background p-3 text-sm space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-xs">{t.category}</span>
                {t.user_role && <span className="text-xs text-muted-foreground capitalize">{t.user_role}</span>}
                <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("it-IT")}</span>
                <div className="ml-auto">
                  <Select value={t.status} onValueChange={(v) => change(t.id, v as typeof STATUSES[number])}>
                    <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="whitespace-pre-wrap break-words">{t.message}</div>
              <div className="text-xs text-muted-foreground break-all">
                Utente: <span className="font-mono">{t.user_id.slice(0, 8)}…</span>
                {t.page_url && <> · Pagina: <span className="font-mono">{t.page_url}</span></>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}