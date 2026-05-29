import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { DELETED_ACCOUNT_MESSAGE, routeForRole, useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { lovable } from "@/integrations/lovable";
import pupilloLogo from "@/assets/pupillo-logo.png";
import { isPasswordStrongEnough, doPasswordsMatch, PASSWORD_RULES } from "@/lib/password-validation";
import { Check, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Accedi — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    role: s.role === "worker" || s.role === "restaurant" ? s.role : undefined,
    ref: typeof s.ref === "string" ? s.ref : undefined,
    deleted: s.deleted === "1" ? "1" : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, role: userRole, profile, roleDebug, loading, extrasLoaded, refresh } = useAuth();
  const { role: roleParam, ref: refParam, deleted: deletedParam } = Route.useSearch();
  const [tab, setTab] = useState<"login" | "signup">(roleParam ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [role, setRole] = useState<"restaurant" | "worker">(roleParam ?? "restaurant");
  const [repAge, setRepAge] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const justSignedUpRef = useRef(false);
  const ageOptions = Array.from({ length: 82 }, (_, i) => 18 + i);
  const restaurantAgeOk = role !== "restaurant" || (repAge !== "" && Number(repAge) >= 18 && Number(repAge) <= 99);
  const passwordStrongEnough = isPasswordStrongEnough(password);
  const passwordsMatch = doPasswordsMatch(password, confirmPassword);
  const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$/;
  const firstNameTrim = firstName.trim();
  const lastNameTrim = lastName.trim();
  const firstNameOk = firstNameTrim.length >= 2 && NAME_REGEX.test(firstNameTrim);
  const lastNameOk = lastNameTrim.length >= 2 && NAME_REGEX.test(lastNameTrim);
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrim = email.trim();
  const confirmEmailTrim = confirmEmail.trim();
  const emailValid = EMAIL_REGEX.test(emailTrim);
  const emailsMatch = emailTrim.toLowerCase() === confirmEmailTrim.toLowerCase() && emailTrim.length > 0;

  useEffect(() => {
    const storedMessage = typeof window !== "undefined" ? sessionStorage.getItem("pupillo-auth-message") : null;
    if (storedMessage) sessionStorage.removeItem("pupillo-auth-message");
    if (deletedParam === "1" || storedMessage === DELETED_ACCOUNT_MESSAGE) {
      toast.error(DELETED_ACCOUNT_MESSAGE);
    }
  }, [deletedParam]);

  useEffect(() => {
    if (loading || !user) return;
    // Wait until role+profile have actually finished loading from the DB
    // before deciding anything. Otherwise role is momentarily null right
    // after login and we wrongly show "Ruolo account non configurato".
    if (!extrasLoaded) return;
    // If the user just submitted the signup form, skip auto-redirects
    // here — handleSignup will navigate to the OTP page itself.
    if (justSignedUpRef.current) return;
    if (profile?.is_deleted || profile?.deleted_at) return;
    const finalRole = userRole ?? roleDebug?.final_role ?? null;
    const finalRoute = routeForRole(finalRole);
    const redirectDebug = {
      user_id: user.id,
      email: user.email,
      has_profile: !!profile,
      profile_primary_role: (profile as { primary_role?: string | null } | null)?.primary_role ?? null,
      profile_role: roleDebug?.profile_role ?? (profile as { primary_role?: string | null } | null)?.primary_role ?? null,
      user_role: roleDebug?.user_role ?? null,
      metadata_role: roleDebug?.metadata_role ?? ((user.user_metadata?.role as string | null | undefined) ?? null),
      profile_error: roleDebug?.profile_error ?? null,
      user_roles_error: roleDebug?.user_roles_error ?? null,
      rpc_error: roleDebug?.rpc_error ?? null,
      profile_completed: profile?.profile_completed ?? null,
      phone_verified: profile?.phone_verified ?? null,
      role: userRole,
      final_role: finalRole,
      final_route: finalRoute,
      is_admin: finalRole === "admin",
    };
    console.info("[PUPILLO_ROLE_RESTORE_DEBUG] auth redirect decision", redirectDebug);
    console.info("[PUPILLO_ROLE_FINAL_DEBUG] redirect decision", redirectDebug);
    // Admins bypass phone verification, onboarding and profile completion.
    if (finalRole === "admin") {
      navigate({ to: "/admin" });
      return;
    }
    // If phone not yet verified, send to OTP page — UNLESS the user
    // explicitly came back from the OTP page via the "Torna alla
    // registrazione" link (URL carries ?role=...). In that case, let
    // them edit their account here.
    if (profile && profile.phone_verified === false && !roleParam) {
      navigate({ to: "/verify-phone" });
      return;
    }
    // Profile incomplete → onboarding (one onboarding route covers both roles)
    if (profile && profile.profile_completed === false) {
      navigate({ to: "/onboarding" });
      return;
    }
    if (finalRole === "restaurant") navigate({ to: "/dashboard" });
    else if (finalRole === "worker") navigate({ to: "/jobs" });
    else if (finalRole === null) {
      // Authenticated but no role row in user_roles. Send the user to a
      // dedicated page with logout / retry / contact-support actions
      // instead of leaving them stuck on the login screen.
      console.warn("[PUPILLO_ROLE_RESTORE_DEBUG] missing role for authenticated user", redirectDebug);
      console.warn("[PUPILLO_ROLE_FINAL_DEBUG] redirecting to account-error", redirectDebug);
      navigate({ to: "/account-error" });
    }
  }, [user, userRole, roleDebug, profile, loading, extrasLoaded, navigate, roleParam]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstNameTrim) {
      toast.error("Inserisci il tuo nome");
      return;
    }
    if (firstNameTrim.length < 2 || !NAME_REGEX.test(firstNameTrim)) {
      toast.error("Il nome deve contenere almeno 2 caratteri");
      return;
    }
    if (!lastNameTrim) {
      toast.error("Inserisci il tuo cognome");
      return;
    }
    if (lastNameTrim.length < 2 || !NAME_REGEX.test(lastNameTrim)) {
      toast.error("Il cognome deve contenere almeno 2 caratteri");
      return;
    }
    if (!emailTrim) {
      toast.error("Inserisci la tua email");
      return;
    }
    if (!emailValid) {
      toast.error("Inserisci un indirizzo email valido");
      return;
    }
    if (!confirmEmailTrim) {
      toast.error("Conferma la tua email");
      return;
    }
    if (!emailsMatch) {
      toast.error("Le email non coincidono");
      return;
    }
    if (role === "restaurant") {
      const age = Number(repAge);
      if (!repAge || isNaN(age) || age < 18 || age > 99) {
        toast.error("Seleziona l'età del referente. Devi avere almeno 18 anni per creare un account ristoratore.");
        return;
      }
    }
    if (!passwordStrongEnough) {
      toast.error("La password deve contenere almeno 8 caratteri, una lettera e un numero.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Le password non coincidono.");
      return;
    }
    const fullName = `${firstNameTrim} ${lastNameTrim}`;
    setBusy(true);
    justSignedUpRef.current = true;
    const { error } = await supabase.auth.signUp({
      email: emailTrim,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/registration-success",
        data: {
          full_name: fullName,
          first_name: firstNameTrim,
          last_name: lastNameTrim,
          role,
          representative_age: role === "restaurant" ? Number(repAge) : null,
        },
      },
    });
    if (error) {
      setBusy(false);
      justSignedUpRef.current = false;
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
        toast.error("Questa email è già registrata. Accedi oppure usa un'altra email.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    // Auto-confirm is enabled, so we can sign in immediately
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: emailTrim, password });
    if (signInErr) {
      setBusy(false);
      justSignedUpRef.current = false;
      toast.success("Account creato! Accedi per continuare.");
      setTab("login");
      return;
    }
    // Phone verification is now handled later, inside the onboarding flow.
    // Just persist the name fields on the profile so onboarding starts pre-filled.
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error("Sessione non disponibile dopo la registrazione.");
      await supabase
        .from("profiles")
        .update({
          first_name: firstNameTrim,
          last_name: lastNameTrim,
          full_name: fullName,
        })
        .eq("id", currentUser.id);
      console.info("[PUPILLO_PHONE_ONBOARDING_DEBUG] signup ok, no phone collected", {
        email: emailTrim,
        role,
      });
    } catch (err) {
      console.error("post-signup profile update failed", err);
    }
    await refresh();
    // Register referral if a code was passed via ?ref=
    if (refParam) {
      try {
        const { data: uid } = await supabase.auth.getUser();
        if (uid.user?.id) {
          await supabase.rpc("register_referral", { _new_user: uid.user.id, _code: refParam });
        }
      } catch (err) {
        console.error("register_referral failed", err);
      }
    }
    setBusy(false);
    toast.success("Account creato. Completa il profilo per continuare.");
    navigate({ to: "/onboarding", replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Inserisci la tua email.");
      return;
    }
    if (!password) {
      toast.error("Inserisci la password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("banned") || msg.includes("disabled") || msg.includes("deleted")) {
        toast.error(DELETED_ACCOUNT_MESSAGE);
      } else if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        toast.error("Email o password non corretti.");
      } else if (msg.includes("not found") || msg.includes("user not")) {
        toast.error("Account non trovato.");
      } else if (msg.includes("email not confirmed")) {
        toast.error("Email non confermata. Controlla la tua casella di posta.");
      } else {
        toast.error("Errore durante l'accesso. Riprova.");
      }
      return;
    }
    toast.dismiss();
    // Redirect handled by useEffect once profile/role are loaded.
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
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-2">
          <Link
            to="/"
            aria-label="Vai alla home page"
            className="inline-flex items-center w-fit cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onKeyDown={(e) => {
              if (e.key === " " || e.code === "Space") {
                e.preventDefault();
                (e.currentTarget as HTMLAnchorElement).click();
              }
            }}
          >
            <img src={pupilloLogo} alt="Logo Pupillo" className="h-10 w-auto object-contain md:h-12" />
          </Link>
          <ThemeToggle />
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
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={busy}
                onClick={() => handleOAuth("google")}
              >
                <GoogleIcon /> Continua con Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={busy}
                onClick={() => handleOAuth("apple")}
              >
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
                <div>
                  <Label>Email</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Attendi..." : "Accedi"}
                </Button>
                <Link
                  to="/reset-password"
                  className="block text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Password dimenticata?
                </Link>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                    {firstName.length > 0 && !firstNameOk && (
                      <p className="text-xs text-destructive mt-1">
                        Il nome deve contenere almeno 2 caratteri
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Cognome</Label>
                    <Input
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                    {lastName.length > 0 && !lastNameOk && (
                      <p className="text-xs text-destructive mt-1">
                        Il cognome deve contenere almeno 2 caratteri
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {email.length > 0 && !emailValid && (
                    <p className="text-xs text-destructive mt-1">Inserisci un indirizzo email valido</p>
                  )}
                </div>
                <div>
                  <Label>Conferma email</Label>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                  />
                  {confirmEmail.length > 0 && !emailsMatch && (
                    <p className="text-xs text-destructive mt-1">Le email non coincidono</p>
                  )}
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Inserisci password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li
                          key={rule.id}
                          className={`flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-muted-foreground"}`}
                        >
                          {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <Label>Conferma password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Conferma password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive mt-1">Le password non coincidono.</p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Sono un</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(v) => setRole(v as "restaurant" | "worker")}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="restaurant" /> Ristoratore
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="worker" /> Lavoratore
                    </label>
                  </RadioGroup>
                </div>
                {role === "restaurant" && (
                  <div>
                    <Label>Età del referente</Label>
                    <select
                      required
                      value={repAge}
                      onChange={(e) => setRepAge(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-white/10 bg-white/[0.04] text-foreground px-3 py-2 text-sm ring-offset-background hover:border-white/20 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <option value="">Seleziona…</option>
                      {ageOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Devi avere almeno 18 anni per creare un account ristoratore.
                    </p>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    busy ||
                    !firstNameOk ||
                    !lastNameOk ||
                    !emailValid ||
                    !emailsMatch ||
                    !restaurantAgeOk ||
                    !passwordStrongEnough ||
                    !passwordsMatch
                  }
                >
                  {busy ? "Attendi..." : "Crea profilo"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Accettando, confermi le{" "}
                  <Link to="/terms" className="underline hover:text-foreground">
                    condizioni d'uso e la privacy policy
                  </Link>
                  .
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
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M16.37 1.43c0 1.14-.45 2.25-1.21 3.04-.84.89-2.2 1.59-3.34 1.49-.13-1.13.43-2.32 1.18-3.07.84-.85 2.27-1.5 3.37-1.46Zm3.79 16.27c-.59 1.36-.87 1.97-1.62 3.18-1.05 1.69-2.53 3.79-4.36 3.81-1.62.02-2.04-1.06-4.24-1.05-2.2.01-2.66 1.07-4.29 1.06-1.83-.02-3.23-1.92-4.28-3.61C-1.03 16.4-1.34 11-.04 8.04c.92-2.1 2.38-3.43 3.95-3.43 1.6 0 2.6 1.06 4.24 1.06 1.6 0 2.42-1.06 4.27-1.06 1.4 0 2.89.76 3.95 2.07-3.47 1.9-2.91 6.86 1.79 8.02Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z"
      />
    </svg>
  );
}
