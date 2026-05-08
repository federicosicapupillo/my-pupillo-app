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

  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_PREFIX);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);

  const homeHref = (() => {
    if (!user) return "/";
    if (role === "admin") return "/admin";
    return "/dashboard";
  })();

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (profile?.phone_verified) {
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
      setCooldown(60);
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
    setBusy(true);
    try {
      const res = await verify({ data: { code } });
      if (!res.ok) {
        toast.error(res.error ?? "Codice non valido.");
        if (res.expired || res.maxedOut) setPhase("phone");
        return;
      }
      toast.success("Codice verificato correttamente.");
      await refresh();
      nav({ to: profile?.profile_completed ? "/dashboard" : "/onboarding" });
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
      setCooldown(60);
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
        {phase === "phone" ? (
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
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em]"
              />
              <Button className="w-full" onClick={handleVerify} disabled={busy || code.length !== 6}>
                {busy ? "Verifica…" : "Conferma codice"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy || cooldown > 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
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
          </>
        )}
        <p className="mt-6 text-xs text-muted-foreground text-center">
          <Link to="/auth" className="underline hover:text-foreground">Torna al login</Link>
        </p>
      </div>
    </div>
  );
}