import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const suggestionsQuery = queryOptions({
  queryKey: ["admin-user-suggestions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("user_suggestions").select("id,user_id,message,created_at").order("created_at", { ascending: false });
    if (error) throw new Error("Impossibile caricare i suggerimenti.");
    return data ?? [];
  },
});

export function AdminSuggestionsSection() {
  const { data, refetch, isFetching } = useSuspenseQuery(suggestionsQuery);
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Suggerimenti ricevuti</h2><Button variant="ghost" size="icon" aria-label="Aggiorna suggerimenti" title="Aggiorna suggerimenti" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="size-4" /></Button></div>
    {data.length === 0 ? <p className="text-sm text-muted-foreground">Nessun suggerimento ricevuto.</p> : <ul className="space-y-3">{data.map((item) => <li key={item.id} className="rounded-lg border border-border bg-card p-4">
      <p className="whitespace-pre-wrap break-words text-sm">{item.message}</p>
      <p className="mt-3 break-all text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("it-IT")} · Utente: {item.user_id}</p>
    </li>)}</ul>}
  </section>;
}