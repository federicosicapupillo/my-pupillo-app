import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, Check, Sparkles, ArrowLeft, AlertTriangle, Zap } from "lucide-react";
import { CREDIT_PACKS, PLAN_PRICES, CREDITS_PER_HIRE, LOW_CREDITS_THRESHOLD } from "@/lib/pricing";
import { Progress } from "@/components/ui/progress";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Crediti e piano — Pupillo" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    action: typeof search.action === "string" ? search.action : undefined,
  }),
  component: () => <RequireAuth><Billing /></RequireAuth>,
});

type Tx = { id: string; created_at: string; delta: number; balance_after: number; reason: string | null };

function Billing() {
  const { profile, user, role } = useAuth();
  const navigate = useNavigate();
  const { returnTo, action } = useSearch({ from: "/billing" });
  const [tx, setTx] = useState<Tx[]>([]);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<{ code: string; type: string; value: number; applies_to: string } | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);

  const applyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) { toast.error("Inserisci un codice."); return; }
    setDiscountBusy(true);
    // Validiamo con "premium": l'RPC accetta automaticamente anche i codici con applies_to='all',
    // così PUPILLO10 (all) e START20 (premium) funzionano entrambi.
    const { data, error } = await supabase.rpc("validate_discount_code", { _code: code, _applies_to: "premium" });
    setDiscountBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.valid) { toast.error(res?.message ?? "Codice non valido."); setDiscount(null); return; }
    setDiscount({ code: res.code, type: res.type, value: Number(res.value), applies_to: res.applies_to });
    toast.success(res.message ?? "Codice sconto applicato.");
  };

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
  const remainingHires = Math.floor(credits / CREDITS_PER_HIRE);
  const isExhausted = !isPaid && credits < CREDITS_PER_HIRE;
  const isLow = !isPaid && !isExhausted && credits < LOW_CREDITS_THRESHOLD;
  // Progress bar fills up to a "comfortable" reference of 70 crediti (SMART pack).
  const progressRef = 70;
  const progressValue = Math.min(100, Math.round((credits / progressRef) * 100));

  if (checkoutKey) {
    const isPlan = !!PLAN_PRICES[checkoutKey];
    const discountAppliesToCheckout = !!(
      discount && (
        discount.applies_to === "all" ||
        (isPlan && discount.applies_to === "premium") ||
        (!isPlan && discount.applies_to === "credits")
      )
    );
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
            discountCode={discountAppliesToCheckout ? discount!.code : undefined}
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
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Coins className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Saldo crediti</div>
              <div className="text-3xl font-bold tabular-nums">{credits}</div>
            </div>
          </div>
          {!isPaid && (
            <div className="mt-4 space-y-2">
              <Progress value={progressValue} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Ti bastano per circa <strong className="text-foreground">{remainingHires}</strong> {remainingHires === 1 ? "conferma lavoratore" : "conferme lavoratore"}.
              </p>
            </div>
          )}
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">{CREDITS_PER_HIRE} crediti = 1 lavoratore confermato.</strong><br />
            Pubblicare annunci e contattare lavoratori è <strong className="text-foreground">gratis</strong>. Paghi solo quando trovi davvero una persona disponibile.
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

      {isExhausted && (
        <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-destructive">Crediti terminati</h3>
              <p className="text-sm mt-1 text-muted-foreground">Hai esaurito i crediti disponibili. Per continuare a confermare lavoratori, scegli un nuovo pacchetto qui sotto.</p>
            </div>
          </div>
        </div>
      )}
      {isLow && (
        <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Stai terminando i crediti</h3>
              <p className="text-sm mt-1 text-amber-800/80 dark:text-amber-200/80">Evita interruzioni durante la ricerca del personale. SMART ti dà 7 conferme a un prezzo conveniente.</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4 mb-6">
        <div className="text-sm font-medium mb-2">Hai un codice sconto?</div>
        <div className="flex gap-2">
          <Input
            placeholder="Es. PUPILLO10"
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
            disabled={!!discount}
          />
          {discount ? (
            <Button variant="outline" onClick={() => { setDiscount(null); setDiscountInput(""); }}>Rimuovi</Button>
          ) : (
            <Button onClick={applyDiscount} disabled={discountBusy}>Applica</Button>
          )}
        </div>
        {discount && (
          <div className="mt-2 text-xs space-y-0.5">
            <p className="text-emerald-700">
              Codice <strong>{discount.code}</strong> applicato:{" "}
              {discount.type === "percentage" && `sconto del ${discount.value}% sul primo pagamento`}
              {discount.type === "fixed_amount" && `sconto di €${discount.value}`}
            </p>
            <p className="text-muted-foreground">
              {discount.applies_to === "all"
                ? "Valido su pacchetti crediti e abbonamenti."
                : discount.applies_to === "premium"
                  ? "Valido solo sugli abbonamenti."
                  : "Valido solo sui pacchetti crediti."}
            </p>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pacchetti crediti</h2>
          <p className="text-sm text-muted-foreground">{CREDITS_PER_HIRE} crediti per ogni lavoratore confermato.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-10">
        {Object.entries(CREDIT_PACKS).map(([key, p]) => {
          const applies = !!(discount && (discount.applies_to === "all" || discount.applies_to === "credits"));
          let final = p.priceEur;
          if (applies && discount) {
            if (discount.type === "percentage") final = +(p.priceEur * (1 - discount.value / 100)).toFixed(2);
            else if (discount.type === "fixed_amount") final = Math.max(0, +(p.priceEur - discount.value).toFixed(2));
          }
          const isBest = p.highlight === "best";
          const pricePerHire = (p.priceEur / p.hires).toFixed(2);
          return (
            <div
              key={key}
              className={`relative rounded-2xl border p-5 flex flex-col transition-all hover:shadow-md ${
                isBest
                  ? "border-primary/60 bg-gradient-to-b from-primary/10 via-card to-card shadow-lg ring-1 ring-primary/30 md:scale-[1.02]"
                  : "bg-card"
              }`}
            >
              {isBest && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm flex items-center gap-1">
                  <Zap className="h-3 w-3" />{p.badge ?? "Più conveniente"}
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</div>
              {p.tagline && <div className="text-xs text-muted-foreground/80 mb-3">{p.tagline}</div>}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold tabular-nums">{p.credits}</span>
                <span className="text-sm text-muted-foreground">crediti</span>
              </div>
              <div className="text-xs text-muted-foreground mb-4">≈ {p.hires} lavoratori confermati</div>
              {applies && final !== p.priceEur ? (
                <div className="mb-2">
                  <div className="text-sm text-muted-foreground line-through">€{p.priceEur}</div>
                  <div className="text-3xl font-bold text-emerald-600 tabular-nums">€{final}</div>
                  <div className="text-xs text-emerald-700">Sconto {discount!.code}</div>
                </div>
              ) : (
                <div className="text-3xl font-bold mb-2 tabular-nums">€{final}</div>
              )}
              <div className="text-xs text-muted-foreground mb-4">€{pricePerHire} per conferma</div>
              <Button
                className="mt-auto"
                variant={isBest ? "default" : "outline"}
                onClick={() => setCheckoutKey(key)}
              >
                Acquista {p.label}
              </Button>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mb-3">Piani in abbonamento</h2>
      <div className="grid gap-4 md:grid-cols-2 mb-10">
        {Object.entries(PLAN_PRICES).map(([key, p]) => {
          const current = plan === p.plan;
          const applies = !!(discount && (discount.applies_to === "all" || discount.applies_to === "premium"));
          let final = p.priceEur;
          if (applies && discount) {
            if (discount.type === "percentage") final = +(p.priceEur * (1 - discount.value / 100)).toFixed(2);
            else if (discount.type === "fixed_amount") final = Math.max(0, +(p.priceEur - discount.value).toFixed(2));
          }
          return (
            <div key={key} className={`rounded-2xl border p-5 flex flex-col ${current ? "border-primary bg-primary/5" : "bg-card"}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xl font-semibold">{p.label}</div>
                {current && <span className="text-xs rounded-full bg-primary text-primary-foreground px-2 py-0.5">Attivo</span>}
              </div>
              {applies && final !== p.priceEur ? (
                <div className="mb-3">
                  <div className="text-sm text-muted-foreground line-through">€{p.priceEur}/mese</div>
                  <div className="text-3xl font-bold text-emerald-600">€{final}<span className="text-sm font-normal text-muted-foreground">/mese (primo mese)</span></div>
                </div>
              ) : (
                <div className="text-3xl font-bold mb-3">€{p.priceEur}<span className="text-sm font-normal text-muted-foreground">/mese</span></div>
              )}
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