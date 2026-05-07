import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    if (window.location.hash.includes("type=recovery")) setMode("update");
    return () => sub.subscription.unsubscribe();
  }, []);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
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
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password aggiornata!"); nav({ to: "/dashboard" }); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Link to="/" className="flex items-center gap-2 w-fit">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">P</div>
            <span className="text-xl font-semibold">Pupillo</span>
          </Link>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          {mode === "request" ? (
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