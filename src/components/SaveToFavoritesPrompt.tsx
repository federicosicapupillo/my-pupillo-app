import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, HeartHandshake, Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Props = {
  restaurantId: string;
  workerId: string;
  workerName?: string | null;
  /** application id used for "Ricontatta" link (opens existing chat) */
  applicationId?: string | null;
  className?: string;
};

/**
 * Promemoria mostrato al ristoratore dopo aver recensito un lavoratore.
 * - Se non è ancora nei preferiti: mostra invito "Salva nei preferiti" / "Non ora".
 * - Se già nei preferiti: mostra badge + pulsante "Ricontatta gratuitamente".
 * - Si nasconde dopo "Non ora" per la sessione corrente.
 */
export function SaveToFavoritesPrompt({ restaurantId, workerId, workerName, applicationId, className }: Props) {
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("restaurant_worker_favorites")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("worker_id", workerId)
        .maybeSingle();
      if (!cancel) {
        setIsFav(!!data);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [restaurantId, workerId]);

  if (loading || dismissed) return null;

  const save = async () => {
    setSaving(true);
    // Evita duplicati: prima ricontrolla
    const { data: existing } = await supabase
      .from("restaurant_worker_favorites")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("worker_id", workerId)
      .maybeSingle();
    if (existing) {
      setIsFav(true);
      setSaving(false);
      toast.success("Lavoratore già nei preferiti.");
      return;
    }
    const { error } = await supabase.from("restaurant_worker_favorites").insert({
      restaurant_id: restaurantId,
      worker_id: workerId,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Impossibile salvare nei preferiti");
      return;
    }
    setIsFav(true);
    toast.success("Lavoratore salvato nei preferiti.");
  };

  if (isFav) {
    return (
      <div className={`rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 ${className ?? ""}`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-emerald-500/20 p-2 text-emerald-700 dark:text-emerald-400">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Nei preferiti
            </div>
            <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 mt-0.5">
              {workerName ? `${workerName} è tra i tuoi preferiti. ` : "Questo lavoratore è già nei tuoi preferiti. "}
              Puoi ricontattarlo gratuitamente per i prossimi turni.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {applicationId ? (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/messages/$id" params={{ id: applicationId }}>
                    <MessageSquare className="h-3.5 w-3.5" /> Ricontatta per un nuovo turno
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/ristoratore/collaboratori">
                    <MessageSquare className="h-3.5 w-3.5" /> Ricontatta per un nuovo turno
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-full bg-primary/20 p-2 text-primary">
          <Heart className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            Ti sei trovato bene con questo lavoratore?
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Salvalo nei preferiti: potrai ritrovarlo facilmente e contattarlo{" "}
            <span className="font-medium text-foreground">gratuitamente</span> per proporgli i prossimi turni.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              <Heart className="h-3.5 w-3.5" />
              {saving ? "Salvataggio…" : "Salva nei preferiti"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={saving}>
              Non ora
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
