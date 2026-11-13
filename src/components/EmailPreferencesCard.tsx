import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Switch } from "@/components/ui/switch";

type Prefs = { messages: boolean; applications: boolean; shifts: boolean; reviews: boolean };
const DEFAULTS: Prefs = { messages: true, applications: true, shifts: true, reviews: true };
const ITEMS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "messages", label: "Nuovi messaggi", hint: "Una sola email per conversazione finché non la leggi" },
  { key: "applications", label: "Candidature e proposte", hint: "Nuove candidature, accettazioni e conferme" },
  { key: "shifts", label: "Turni", hint: "Turni confermati, annullati, ritardi e no-show" },
  { key: "reviews", label: "Recensioni", hint: "Recensioni da lasciare e ricevute" },
];

export function EmailPreferencesCard() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("notification_email_preferences").select("messages, applications, shifts, reviews")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setPrefs(data as Prefs); setLoaded(true); });
  }, [user]);

  const toggle = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase.from("notification_email_preferences")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
    if (error) { setPrefs(prefs); toast.error("Non siamo riusciti a salvare la preferenza. Riprova."); }
    else toast.success("Preferenza salvata");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Email di notifica</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Scegli per quali notifiche importanti vuoi ricevere anche un'email.</p>
      <ul className="mt-4 space-y-3">
        {ITEMS.map((it) => (
          <li key={it.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{it.label}</p>
              <p className="text-xs text-muted-foreground">{it.hint}</p>
            </div>
            <Switch checked={prefs[it.key]} disabled={!loaded} onCheckedChange={(v) => toggle(it.key, v)} aria-label={it.label} />
          </li>
        ))}
      </ul>
    </section>
  );
}
