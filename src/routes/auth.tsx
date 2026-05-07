import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Accedi — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    role: s.role === "worker" || s.role === "restaurant" ? s.role : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, role: userRole, loading } = useAuth();
  const { role: roleParam } = Route.useSearch();
  const [tab, setTab] = useState<"login" | "signup">(roleParam ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"restaurant" | "worker">(roleParam ?? "restaurant");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (userRole === "admin") navigate({ to: "/admin" });
    else if (userRole === "restaurant") navigate({ to: "/dashboard" });
    else if (userRole === "worker") navigate({ to: "/jobs" });
  }, [user, userRole, loading, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { full_name: fullName, role },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Account creato! Controlla la mail per confermare."); setTab("login"); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Bentornato!");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      setBusy(false);
      toast.error("Accesso fallito. Riprova.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const handleFacebook = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      setBusy(false);
      toast.error("Login Facebook non disponibile. Configura il provider nel backend.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Link
            to="/"
            aria-label="Vai alla home page"
            className="inline-flex items-center w-fit cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onKeyDown={(e) => { if (e.key === " " || e.code === "Space") { e.preventDefault(); (e.currentTarget as HTMLAnchorElement).click(); } }}
          >
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-2 py-1 ring-1 ring-black/5">
              <img src={pupilloLogo} alt="Logo Pupillo" className="h-10 w-auto object-contain" />
            </span>
          </Link>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Benvenuto in Pupillo</h1>
          <p className="text-sm text-muted-foreground mt-1">Accedi o crea un nuovo account</p>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Registrati</TabsTrigger>
            </TabsList>
            <div className="mt-4 space-y-2">
              <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={() => handleOAuth("google")}>
                <GoogleIcon /> Continua con Google
              </Button>
              <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={() => handleOAuth("apple")}>
                <AppleIcon /> Continua con Apple
              </Button>
              <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={handleFacebook}>
                <FacebookIcon /> Continua con Facebook
              </Button>
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">oppure con email</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Attendi..." : "Accedi"}</Button>
                <Link to="/reset-password" className="block text-center text-xs text-muted-foreground hover:text-foreground">Password dimenticata?</Link>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div><Label>Nome completo</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div>
                  <Label className="mb-2 block">Sono un</Label>
                  <RadioGroup value={role} onValueChange={(v) => setRole(v as "restaurant" | "worker")} className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="restaurant" /> Ristoratore
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="worker" /> Lavoratore
                    </label>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Attendi..." : "Crea account"}</Button>
                <p className="text-xs text-muted-foreground text-center">
                  Accettando, confermi le <Link to="/terms" className="underline hover:text-foreground">condizioni d'uso e la privacy policy</Link>.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M16.37 1.43c0 1.14-.45 2.25-1.21 3.04-.84.89-2.2 1.59-3.34 1.49-.13-1.13.43-2.32 1.18-3.07.84-.85 2.27-1.5 3.37-1.46Zm3.79 16.27c-.59 1.36-.87 1.97-1.62 3.18-1.05 1.69-2.53 3.79-4.36 3.81-1.62.02-2.04-1.06-4.24-1.05-2.2.01-2.66 1.07-4.29 1.06-1.83-.02-3.23-1.92-4.28-3.61C-1.03 16.4-1.34 11-.04 8.04c.92-2.1 2.38-3.43 3.95-3.43 1.6 0 2.6 1.06 4.24 1.06 1.6 0 2.42-1.06 4.27-1.06 1.4 0 2.89.76 3.95 2.07-3.47 1.9-2.91 6.86 1.79 8.02Z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z"/>
    </svg>
  );
}