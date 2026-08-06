import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { clearPendingSignupRole, type SignupRole } from "@/lib/signup-role";

export const Route = createFileRoute("/choose-role")({
  head: () => ({
    meta: [
      { title: "Scegli il tuo ruolo — Pupillo" },
      { name: "description", content: "Indica se usi Pupillo come ristoratore o come lavoratore per completare la registrazione." },
      { property: "og:title", content: "Scegli il tuo ruolo — Pupillo" },
      { property: "og:description", content: "Indica se usi Pupillo come ristoratore o come lavoratore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChooseRolePage,
});

/**
 * Scelta ruolo esplicita: raggiunta dagli account (tipicamente social) che
 * arrivano senza ruolo in DB. Nessun fallback automatico a "lavoratore".
 */
function ChooseRolePage() {
  const { user, role, loading, extrasLoaded, refresh } = useAuth();
  const nav = useNavigate();
  const [choice, setChoice] = useState<SignupRole | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    if (extrasLoaded && role) {
      // Il DB ha già un ruolo autorevole: qui non c'è nulla da scegliere.
      clearPendingSignupRole();
      nav({ to: role === "admin" ? "/admin" : "/onboarding" });
    }
  }, [user, role, loading, extrasLoaded, nav]);

  const confirm = async () => {
    if (!choice || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("claim_signup_role" as never, { _role: choice } as never);
    if (error) {
      setBusy(false);
      console.error("[auth] claim_signup_role failed", error);
      toast.error("Non è stato possibile salvare la scelta. Riprova.");
      return;
    }
    clearPendingSignupRole();
    await refresh();
    setBusy(false);
    nav({ to: "/onboarding" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Come usi Pupillo?</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per completare la registrazione indica il tipo di account. La scelta è definitiva.
          </p>
        </div>
        <div>
          <Label className="mb-2 block">Sono un *</Label>
          <RadioGroup
            value={choice ?? ""}
            onValueChange={(v) => setChoice(v as SignupRole)}
            className="grid grid-cols-1 gap-3"
          >
            <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="restaurant" /> Ristoratore
            </label>
            <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="worker" /> Lavoratore
            </label>
          </RadioGroup>
        </div>
        <Button className="w-full" disabled={!choice || busy} onClick={confirm}>
          {busy ? "Attendi…" : "Conferma e continua"}
        </Button>
      </div>
    </div>
  );
}
