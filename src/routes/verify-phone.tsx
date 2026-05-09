import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/PhoneInput";
import { DEFAULT_PHONE_PREFIX, isValidPhone, splitPhone } from "@/lib/phone-prefixes";
import { startPhoneVerification, verifyPhoneOtp, resendPhoneOtp } from "@/lib/phone-verification.functions";
import { toast } from "sonner";

const TEST_OTP_ENABLED = import.meta.env.VITE_ENABLE_TEST_OTP === "true" && import.meta.env.PROD !== true;

export const Route = createFileRoute("/verify-phone")({
  head: () => ({ meta: [{ title: "Conferma numero WhatsApp — Pupillo" }] }),
  component: VerifyPhonePage,
});

function VerifyPhonePage() {
  const { user, profile, role, loading, refresh } = useAuth();
  const nav = useNavigate();
  const start = useServerFn(startPhoneVerification);
  const verify = useServerFn(verifyPhoneOtp);
  const resend = useServerFn(resendPhoneOtp);

  const [phase, setPhase] = useState<"phone" | "code" | "success">("phone");
  const [code, setCode] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_PREFIX);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedOut, setLockedOut] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [redirectIn, setRedirectIn] = useState(5);
  const [successDest, setSuccessDest] = useState<"/onboarding" | "/dashboard" | "/admin">("/onboarding");

  const homeHref = (() => {
    if (!user) return "/";
    if (role === "admin") return "/admin";
    return "/dashboard";
  })();

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    // Wait until profile is loaded before deciding access.
    if (!profile) return;
    // Hard guard: this page is reserved to users who have just signed up
    // and still have phone_verified === false. Anyone else (already
    // verified, or somehow with phone_verified !== false) is redirected
    // to their normal destination.
    if (profile.phone_verified !== false) {
      if (profile?.profile_completed) {
        nav({ to: "/dashboard" });
      } else {
        nav({ to: "/onboarding" });
      }
      return;
    }
    if (profile?.phone_full) {
      const sp = splitPhone(profile.phone_full);
      setPhoneCode(sp.code);
      setPhoneNumber(sp.number);
      if (profile.whatsapp_confirmation_status === "sent" || profile.whatsapp_confirmation_status === "pending") {
        setPhase("code");
      }
    }
  }, [user, profile, loading, nav]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (phase !== "success") return;
    if (redirectIn <= 0) {
      nav({ to: successDest as any });
      return;
    }
    const t = setTimeout(() => setRedirectIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, redirectIn, successDest, nav]);

  const phoneFull = `${phoneCode}${phoneNumber}`;

  const handleSendCode = async () => {
    if (!isValidPhone(phoneCode, phoneNumber)) {
      toast.error("Numero non valido. Controlla prefisso e cifre.");
      return;
    }
    setBusy(true);
    try {
      const res = await start({ data: { phoneCountryCode: phoneCode, phoneNumber, sendSummary: !profile?.email_summary_sent_at } });
      if (!res.ok) {
        toast.error(res.error ?? "Invio fallito.");
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
        return;
      }
      setPhase("code");
      setCooldown(30);
      if (res.simulated) {
        toast.success("Messaggio WhatsApp simulato correttamente.");
      } else {
        toast.success("Codice inviato via WhatsApp.");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Inserisci un codice di 6 cifre.");
      return;
    }
    if (lockedOut) return;
    setBusy(true);
    try {
      const res = await verify({ data: { code } });
      if (!res.ok) {
        const msg = res.error ?? "Codice non valido.";
        if (res.maxedOut) {
          setLockedOut(true);
          setAttemptsLeft(0);
          setVerifyError(
            "Hai superato il numero massimo di tentativi. Richiedi un nuovo codice o cambia numero per continuare.",
          );
          toast.error("Troppi tentativi errati. Richiedi un nuovo codice.");
        } else if (res.expired) {
          setVerifyError(null);
          toast.error(msg);
          setPhase("phone");
        } else {
          if (typeof res.attemptsLeft === "number") setAttemptsLeft(res.attemptsLeft);
          setVerifyError(
            typeof res.attemptsLeft === "number"
              ? `${msg} Tentativi rimasti: ${res.attemptsLeft}.`
              : msg,
          );
          toast.error(msg);
        }
        return;
      }
      setVerifyError(null);
      setAttemptsLeft(null);
      setLockedOut(false);
      toast.success("Codice verificato correttamente.");
      await refresh();
      const dest = role === "admin"
        ? "/admin"
        : profile?.profile_completed
          ? "/dashboard"
          : "/onboarding";
      setSuccessDest(dest as any);
      setRedirectIn(5);
      setPhase("success");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setBusy(true);
    try {
      const res = await resend({ data: undefined as any });
      if (!res.ok) {
        toast.error(res.error ?? "Reinvio fallito.");
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
        return;
      }
      setCooldown(30);
      // New code issued → reset attempts/lock state for the new OTP row.
      setLockedOut(false);
      setAttemptsLeft(null);
      setVerifyError(null);
      setCode("");
      toast.success(res.simulated ? "Messaggio WhatsApp simulato correttamente." : "Codice reinviato.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Conferma il tuo numero</h1>
        {TEST_OTP_ENABLED && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-start gap-3 rounded-xl border border-[oklch(0.92_0.18_115)]/40 bg-[oklch(0.92_0.18_115)]/10 px-3 py-2.5 text-xs"
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-md bg-[oklch(0.92_0.18_115)] px-1.5 text-[10px] font-bold uppercase tracking-wide text-black"
            >
              Test
            </span>
            <span className="text-foreground">
              Modalità OTP di test attiva — usa il codice{" "}
              <strong className="font-mono text-sm tracking-widest">123456</strong>{" "}
              per completare la verifica senza WhatsApp.
            </span>
          </div>
        )}
        {phase === "success" ? (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-lg font-bold"
              >
                ✓
              </span>
              <div className="text-sm">
                <p className="font-medium text-foreground">Numero verificato</p>
                <p className="text-muted-foreground">
                  <strong>{phoneFull || profile?.phone_full}</strong> è ora associato al tuo account.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Prossimo passo</p>
              <p className="text-muted-foreground mt-1">
                {successDest === "/onboarding"
                  ? "Completa il profilo per iniziare a usare Pupillo."
                  : successDest === "/admin"
                    ? "Vai alla console di amministrazione."
                    : "Torna alla tua dashboard."}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <Button className="w-full" onClick={() => nav({ to: successDest as any })}>
                Continua ora
              </Button>
              <p
                role="status"
                aria-live="polite"
                className="text-center text-xs text-muted-foreground"
              >
                Reindirizzamento automatico tra {redirectIn}s…
              </p>
            </div>
          </>
        ) : phase === "phone" ? (
          <>
            <p className="text-sm text-muted-foreground mt-2">
              Inserisci il numero su cui vuoi ricevere il codice di conferma via WhatsApp.
            </p>
            <div className="mt-4 space-y-3">
              <Label>Numero WhatsApp</Label>
              <PhoneInput
                code={phoneCode}
                number={phoneNumber}
                onCodeChange={setPhoneCode}
                onNumberChange={setPhoneNumber}
                required
              />
              <Button className="w-full" onClick={handleSendCode} disabled={busy || cooldown > 0}>
                {busy ? "Invio…" : cooldown > 0 ? `Riprova tra ${cooldown}s` : "Invia codice via WhatsApp"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-2">
              Ti abbiamo inviato un codice via WhatsApp al numero <strong>{phoneFull || profile?.phone_full}</strong>.
            </p>
            <div className="mt-4 space-y-3">
              <Label>Inserisci codice a 6 cifre</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (verifyError && !lockedOut) setVerifyError(null);
                }}
                disabled={lockedOut}
                placeholder="000000"
                className={`text-center text-2xl tracking-[0.5em] ${lockedOut ? "opacity-60" : ""} ${verifyError ? "border-destructive focus-visible:ring-destructive/50" : ""}`}
                aria-invalid={!!verifyError}
              />
              {verifyError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className={`rounded-md border px-3 py-2 text-xs ${
                    lockedOut
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-destructive/30 bg-destructive/5 text-destructive"
                  }`}
                >
                  {verifyError}
                </p>
              )}
              <Button className="w-full" onClick={handleVerify} disabled={busy || code.length !== 6 || lockedOut}>
                {busy ? "Verifica…" : lockedOut ? "Bloccato — richiedi un nuovo codice" : "Conferma codice"}
              </Button>
              <div className="pt-1 space-y-2 text-xs">
                <p
                  className="text-center text-muted-foreground"
                  aria-live="polite"
                  role="status"
                >
                  {cooldown > 0
                    ? `Potrai richiedere un nuovo codice tra ${cooldown}s`
                    : "Non hai ricevuto il codice? Puoi richiederlo di nuovo."}
                </p>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy || cooldown > 0}
                    className="font-medium text-foreground hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {cooldown > 0 ? `Reinvia codice (${cooldown}s)` : "Reinvia codice"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhase("phone"); setCode(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cambia numero
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <Link to={homeHref as any} className="underline hover:text-foreground">
            ← Torna al menu principale
          </Link>
          {!user && (
            <Link to="/auth" className="hover:text-foreground">Torna al login</Link>
          )}
        </div>
      </div>
    </div>
  );
}