import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getOriginalSignupMethod, providerLabel } from "@/lib/auth-methods";
import { canManagePassword, fetchMySignupMethod, PASSWORD_MANAGEMENT_ERROR_MESSAGE } from "@/lib/password-guard";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reimposta password — Pupillo" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  // Account nato da social login: nessuna gestione password dentro Pupillo.
  const [socialProvider, setSocialProvider] = useState<string | null>(null);
  const socialLabel = socialProvider === "oauth" ? "il tuo provider social" : providerLabel(socialProvider ?? "");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    if (window.location.hash.includes("type=recovery")) setMode("update");
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data?.user) return;
      // Fonte canonica: il database. Fallback sulle identità solo se assente.
      const dbMethod = await fetchMySignupMethod();
      const method = dbMethod ?? getOriginalSignupMethod({
        app_metadata: (data.user.app_metadata ?? {}) as Record<string, unknown>,
        identities: (data.user.identities ?? null) as { provider?: string | null }[] | null,
      });
      if (!active) return;
      if (!canManagePassword(method)) setSocialProvider(method);
    })();
    return () => { active = false; };
  }, []);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (socialProvider) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Email inviata. Controlla la tua casella.");
  };

  const updatePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (socialProvider) return;
    setBusy(true);
    // Ricontrollo server-side prima di scrivere: la UI non è una difesa.
    if (!canManagePassword(await fetchMySignupMethod())) {
      setBusy(false);
      setSocialProvider("google");
      toast.error(PASSWORD_MANAGEMENT_ERROR_MESSAGE);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password aggiornata!"); nav({ to: "/dashboard" }); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 w-fit">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">P</div>
            <span className="text-xl font-semibold">Pupillo</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          {socialProvider ? (
            <>
              <h1 className="text-2xl font-semibold">Accesso tramite {socialLabel}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Il tuo account Pupillo è stato creato con {socialLabel}:
                non esiste una password gestita da Pupillo e non è possibile impostarla o reimpostarla.
                Continua ad accedere con lo stesso provider.
              </p>
              <Link to="/dashboard" className="mt-6 block text-center text-sm text-primary underline">Vai alla dashboard</Link>
            </>
          ) : mode === "request" ? (
            <>
              <h1 className="text-2xl font-semibold">Reimposta password</h1>
              <p className="text-sm text-muted-foreground mt-1">Ti invieremo un link via email per scegliere una nuova password.</p>
              <form onSubmit={requestReset} className="space-y-4 mt-6">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Invio..." : "Invia link di reset"}</Button>
                <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:text-foreground">← Torna al login</Link>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">Nuova password</h1>
              <p className="text-sm text-muted-foreground mt-1">Imposta la tua nuova password.</p>
              <form onSubmit={updatePwd} className="space-y-4 mt-6">
                <div><Label>Nuova password</Label><Input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Aggiorno..." : "Aggiorna password"}</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}