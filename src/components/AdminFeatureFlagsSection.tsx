import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { invalidateReferralFeatureFlags } from "@/lib/use-referral-enabled";
import { invalidateWorkerTaxCodeFeatureFlag } from "@/lib/use-worker-tax-code-enabled";

type FeatureFlag = {
  key: string;
  enabled: boolean;
  scope: string;
  description: string | null;
  updated_at: string | null;
};

export function AdminFeatureFlagsSection() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key,enabled,scope,description,updated_at")
      .order("key", { ascending: true });
    if (error) { setError(error.message); return; }
    setFlags((data ?? []) as FeatureFlag[]);
  }

  useEffect(() => { void load(); }, []);

  async function toggle(key: string, next: boolean) {
    setBusyKey(key);
    const prev = flags;
    setFlags((fs) => fs?.map(f => f.key === key ? { ...f, enabled: next } : f) ?? fs);
    const { error } = await supabase
      .from("feature_flags")
      .update({ enabled: next, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq("key", key);
    setBusyKey(null);
    if (error) {
      setFlags(prev);
      toast.error(`Aggiornamento fallito: ${error.message}`);
      return;
    }
    toast.success(`Flag "${key}" ${next ? "attivato" : "disattivato"}`);
    if (key === "worker_referral_enabled" || key === "restaurant_referral_enabled") {
      invalidateReferralFeatureFlags();
    }
    if (key === "worker_tax_code_enabled") {
      invalidateWorkerTaxCodeFeatureFlag();
    }
    void load();
  }

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Funzionalità (feature flag)</h3>
        <p className="text-sm text-muted-foreground">
          Attiva o disattiva funzionalità della piattaforma. I flag con ambito "città" avranno una gestione dedicata in una fase successiva.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Errore caricamento: {error}
        </div>
      )}

      {!flags && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
        </div>
      )}

      {flags && flags.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun feature flag configurato.</p>
      )}

      {flags && flags.length > 0 && (
        <ul className="divide-y border rounded-lg">
          {flags.map((f) => (
            <li key={f.key} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{f.description ?? f.key}</span>
                  <Badge variant={f.scope === "city" ? "outline" : "secondary"} className="text-xs">
                    {f.scope}
                  </Badge>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">{f.key}</div>
                {f.scope === "city" && (
                  <div className="text-xs text-muted-foreground italic">
                    Gestione elenco città in arrivo.
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {busyKey === f.key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  checked={f.enabled}
                  disabled={busyKey === f.key}
                  onCheckedChange={(v) => toggle(f.key, v)}
                  aria-label={`Attiva ${f.key}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}