import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, Check, Sparkles, ArrowLeft } from "lucide-react";
import { CREDIT_PACKS, PLAN_PRICES, CREDIT_COSTS } from "@/lib/pricing";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Crediti e piano — Pupillo" }] }),
  component: () => <RequireAuth><Billing /></RequireAuth>,
});

type Tx = { id: string; created_at: string; delta: number; balance_after: number; reason: string | null };

function Billing() {
  const { profile, user, role } = useAuth();
  const [tx, setTx] = useState<Tx[]>([]);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, created_at, delta, balance_after, reason")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setTx((data as Tx[]) ?? []);
    })();
  }, [user]);

  if (role && role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Sezione riservata ai ristoratori.</p></AppShell>;
  }

  const credits = profile?.credits ?? 0;
  const plan = profile?.plan ?? "free";
  const isPaid = plan === "pro" || plan === "business";

  if (checkoutKey) {
    return (
      <AppShell>
        <Button variant="ghost" size="sm" className="mb-3 gap-2" onClick={() => setCheckoutKey(null)}>
          <ArrowLeft className="h-4 w-4" />Torna al billing
        </Button>
        <div className="rounded-2xl border bg-card p-4">
          <StripeEmbeddedCheckout
            priceId={checkoutKey}
            customerEmail={user?.email ?? undefined}
            userId={user?.id}
            returnUrl={typeof window !== "undefined" ? `${window.location.origin}/billing` : undefined}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Crediti e piano" subtitle="Gestisci il saldo crediti e il piano del tuo locale" />

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Saldo crediti</div>
              <div className="text-3xl font-bold">{credits}</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <div>Pubblica annuncio · {CREDIT_COSTS.publishAnnouncement} credito</div>
            <div>Annuncio urgente · {CREDIT_COSTS.publishUrgentAnnouncement} crediti</div>
            <div>Invita lavoratore · {CREDIT_COSTS.assignWorker} crediti</div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Piano attivo</div>
              <div className="text-3xl font-bold capitalize">{plan}</div>
            </div>
          </div>
          {isPaid ? (
            <p className="mt-4 text-sm text-muted-foreground">Il tuo piano include pubblicazioni e inviti illimitati.</p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Passa a Pro o Business per pubblicare e invitare senza scalare crediti.</p>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Pacchetti crediti</h2>
      <div className="grid gap-4 md:grid-cols-3 mb-10">
        {Object.entries(CREDIT_PACKS).map(([key, p]) => (
          <div key={key} className="rounded-2xl border bg-card p-5 flex flex-col">
            <div className="text-2xl font-bold">{p.credits} <span className="text-sm font-normal text-muted-foreground">crediti</span></div>
            <div className="text-sm text-muted-foreground mb-4">{p.label}</div>
            <div className="text-3xl font-bold mb-4">€{p.priceEur}</div>
            <Button className="mt-auto" onClick={() => setCheckoutKey(key)}>Acquista</Button>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Piani in abbonamento</h2>
      <div className="grid gap-4 md:grid-cols-2 mb-10">
        {Object.entries(PLAN_PRICES).map(([key, p]) => {
          const current = plan === p.plan;
          return (
            <div key={key} className={`rounded-2xl border p-5 flex flex-col ${current ? "border-primary bg-primary/5" : "bg-card"}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xl font-semibold">{p.label}</div>
                {current && <span className="text-xs rounded-full bg-primary text-primary-foreground px-2 py-0.5">Attivo</span>}
              </div>
              <div className="text-3xl font-bold mb-3">€{p.priceEur}<span className="text-sm font-normal text-muted-foreground">/mese</span></div>
              <ul className="text-sm space-y-1.5 mb-4">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" />Pubblicazioni illimitate</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" />Inviti lavoratori illimitati</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" />Supporto prioritario</li>
              </ul>
              <Button className="mt-auto" disabled={current} onClick={() => setCheckoutKey(key)}>
                {current ? "Piano attivo" : "Attiva"}
              </Button>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mb-3">Storico movimenti</h2>
      <div className="rounded-2xl border bg-card divide-y">
        {tx.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nessun movimento registrato.</p>
        ) : tx.map(t => (
          <div key={t.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-medium">{labelFor(t.reason)}</div>
              <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("it-IT")}</div>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${t.delta < 0 ? "text-destructive" : t.delta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                {t.delta > 0 ? "+" : ""}{t.delta}
              </div>
              <div className="text-xs text-muted-foreground">Saldo: {t.balance_after}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link to="/dashboard"><Button variant="ghost">Torna alla dashboard</Button></Link>
      </div>
    </AppShell>
  );
}

function labelFor(reason: string | null): string {
  switch (reason) {
    case "publish_announcement": return "Pubblicazione annuncio";
    case "publish_urgent_announcement": return "Pubblicazione annuncio urgente";
    case "assign_worker": return "Invito lavoratore";
    case "credit_pack": return "Acquisto pacchetto crediti";
    case "plan_bonus": return "Azione coperta dal piano";
    default: return reason ?? "Movimento";
  }
}