import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/PhoneInput";
import { DEFAULT_PHONE_PREFIX, isValidPhone, splitPhone } from "@/lib/phone-prefixes";
import { startPhoneVerification, verifyPhoneOtp, resendPhoneOtp } from "@/lib/phone-verification.functions";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Mail } from "lucide-react";
import { clearPendingRegistrationOtpState, readPendingRegistrationOtpState, savePendingRegistrationOtpState } from "@/lib/registration-otp-state";

const TEST_OTP_ENABLED = import.meta.env.VITE_ENABLE_TEST_OTP === "true" && import.meta.env.PROD !== true;

export const Route = createFileRoute("/verify-phone")({
  head: () => ({ meta: [{ title: "Conferma numero WhatsApp — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ phase: s.phase === "code" ? "code" as const : undefined }),
  component: VerifyPhonePage,
});

function VerifyPhonePage() {
  const { user, profile, role, loading, extrasLoaded, refresh } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const start = useServerFn(startPhoneVerification);
  const verify = useServerFn(verifyPhoneOtp);
  const resend = useServerFn(resendPhoneOtp);

  // Default to "code" phase: il numero è stato già inserito in registrazione.
  // Mostriamo la schermata di inserimento numero solo se l'utente clicca
  // esplicitamente su "Cambia numero" oppure se sul profilo non esiste
  // proprio nessun numero (caso limite).
  const [phase, setPhase] = useState<"phone" | "code">("code");
  const [code, setCode] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_PREFIX);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const userChangedPhoneRef = useRef(false);
  const autoSendTriedRef = useRef(false);
  const [pendingRegistrationOtp, setPendingRegistrationOtp] = useState(() => readPendingRegistrationOtpState());
  // Popup di conferma email mostrato DOPO la verifica WhatsApp OTP.
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  // Destinazione post-popup, calcolata al momento della verifica OTP.
  const pendingNavRef = useRef<string | null>(null);


  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    const pendingPhone = pendingRegistrationOtp?.phoneFull ?? "";
    if ((!extrasLoaded || !profile) && search.phase === "code" && pendingRegistrationOtp) {
      setPhoneCode(pendingRegistrationOtp.phoneCountryCode);
      setPhoneNumber(pendingRegistrationOtp.phoneNumber);
      setPhase("code");
      return;
    }
    // Aspetta che il profilo sia effettivamente caricato dal DB prima di
    // decidere quale schermata mostrare, ma non perdere lo stato OTP appena
    // creato in registrazione: il profilo in auth-context può essere ancora
    // quello letto prima dell'update del telefono.
    if (!extrasLoaded || !profile) return;
    if (profile?.phone_verified) {
      clearPendingRegistrationOtpState();
      if (profile?.profile_completed) {
        nav({ to: "/dashboard" });
      } else {
        nav({ to: "/onboarding" });
      }
      return;
    }
    const phoneForOtp = profile?.phone_full || pendingPhone;
    if (phoneForOtp && !userChangedPhoneRef.current) {
      const sp = pendingRegistrationOtp && phoneForOtp === pendingRegistrationOtp.phoneFull
        ? { code: pendingRegistrationOtp.phoneCountryCode, number: pendingRegistrationOtp.phoneNumber }
        : splitPhone(phoneForOtp);
      setPhoneCode(sp.code);
      setPhoneNumber(sp.number);
      // Numero già presente sul profilo → la schermata resta in "code".
      setPhase("code");
      // Se l'OTP non è ancora stato inviato (status null/altro), avviamo
      // automaticamente l'invio una sola volta. Evita che l'utente debba
      // re-inserire il numero solo per ricevere il codice.
      const status = profile.whatsapp_confirmation_status;
      const alreadySent = status === "sent" || status === "pending" || Boolean(pendingRegistrationOtp);
      if (!alreadySent && !autoSendTriedRef.current && cooldown === 0) {
        autoSendTriedRef.current = true;
        void (async () => {
          try {
            const res = await start({
              data: {
                phoneCountryCode: sp.code,
                phoneNumber: sp.number,
                sendSummary: !profile?.email_summary_sent_at,
              },
            });
            if (res.ok) {
              setCooldown(60);
              toast.success(res.simulated ? "Messaggio WhatsApp simulato correttamente." : "Codice inviato via WhatsApp.");
              await refresh();
            } else if (res.cooldownSeconds) {
              setCooldown(res.cooldownSeconds);
            }
          } catch {
            /* silenzioso: l'utente può usare "Reinvia codice" */
          }
        })();
      }
    } else if (profile && !profile.phone_full && !pendingPhone) {
      // Caso limite: nessun numero salvato sul profilo. Lasciamo che
      // l'utente lo inserisca.
      setPhase("phone");
    }
  }, [user, profile, loading, extrasLoaded, nav, start, refresh, cooldown, pendingRegistrationOtp, search.phase]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const phoneFull = `${phoneCode}${phoneNumber}`;
  const maskedPhone = (() => {
    const src = (phoneFull && phoneNumber ? phoneFull : profile?.phone_full) || "";
    if (!src) return "";
    const sp = splitPhone(src);
    const digits = sp.number.replace(/\D/g, "");
    if (digits.length <= 4) return `${sp.code} ${digits}`;
    const last = digits.slice(-4);
    const masked = "•".repeat(Math.max(3, digits.length - 4));
    return `${sp.code} ${masked} ${last}`;
  })();

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
      userChangedPhoneRef.current = false;
      savePendingRegistrationOtpState({ phoneCountryCode: phoneCode, phoneNumber, phoneFull });
      setPendingRegistrationOtp({ phoneCountryCode: phoneCode, phoneNumber, phoneFull, createdAt: Date.now() });
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
      console.info("[PUPILLO_PHONE_VERIFY_DEBUG] client verify result", {
        user_id: user?.id ?? null,
        email: user?.email ?? null,
        otp_inserted: code,
        result: res,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Codice non valido.");
        if ((res.expired || res.maxedOut) && !profile?.phone_full && !pendingRegistrationOtp?.phoneFull) setPhase("phone");
        return;
      }
      toast.success("Codice verificato correttamente.");
      clearPendingRegistrationOtpState();
      setPendingRegistrationOtp(null);
      await refresh();
      // Destinazione dopo la verifica: admin → /admin, worker → /jobs,
      // restaurant → /dashboard. Se l'onboarding non è ancora stato
      // completato (e non si tratta di admin) andiamo prima a /onboarding.
      let dest: string;
      if (role === "admin") {
        dest = "/admin";
      } else if (!profile?.profile_completed) {
        dest = "/onboarding";
      } else if (role === "worker") {
        dest = "/jobs";
      } else if (role === "restaurant") {
        dest = "/dashboard";
      } else {
        dest = "/dashboard";
      }
      console.info("[PUPILLO_PHONE_VERIFY_DEBUG] client redirect", {
        user_id: user?.id ?? null,
        role,
        profile_completed: profile?.profile_completed ?? null,
        phone_verified: profile?.phone_verified ?? null,
        dest,
      });
      pendingNavRef.current = dest;
      // Invio reale della mail di conferma SUBITO dopo la verifica WhatsApp.
      // Solo in caso di invio riuscito mostriamo il popup informativo.
      const email = user?.email ?? null;
      if (!email) {
        // Senza email non possiamo confermare nulla: vai direttamente alla
        // destinazione e non mostrare il popup.
        nav({ to: dest as any });
        return;
      }
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/registration-success" },
      });
      if (resendErr) {
        toast.error("Non siamo riusciti a inviare la mail di conferma. Riprova tra qualche secondo.");
        // L'utente può comunque proseguire: la verifica WhatsApp è andata
        // a buon fine. Le funzioni operative restano gated da profile_completed.
        nav({ to: dest as any });
        return;
      }
      setEmailDialogOpen(true);
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

  // Reinvia la mail di conferma dal popup. Anti-doppio-click via stato locale.
  const handleResendEmail = async () => {
    if (resendingEmail) return;
    const email = user?.email;
    if (!email) {
      toast.error("Email non disponibile. Effettua di nuovo l'accesso.");
      return;
    }
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/registration-success" },
      });
      if (error) {
        toast.error("Non siamo riusciti a inviare la mail di conferma. Riprova tra qualche secondo.");
        return;
      }
      toast.success("Mail di conferma reinviata.");
    } finally {
      setResendingEmail(false);
    }
  };

  // Chiude il popup e prosegue verso la destinazione calcolata in OTP success.
  const handleAcknowledgeEmail = () => {
    setEmailDialogOpen(false);
    const dest = pendingNavRef.current;
    pendingNavRef.current = null;
    if (dest) nav({ to: dest as any });
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
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
              Abbiamo inviato un codice di verifica al numero WhatsApp{" "}
              <strong>{maskedPhone || profile?.phone_full}</strong>.
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
                {busy ? "Verifica in corso…" : "Verifica codice"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy || cooldown > 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {busy ? "Invio codice…" : cooldown > 0 ? `Reinvia codice (${cooldown}s)` : "Reinvia codice"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    userChangedPhoneRef.current = true;
                    setPhase("phone");
                    setCode("");
                    setCooldown(0);
                    setPhoneNumber("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cambia numero
                </button>
              </div>
              {TEST_OTP_ENABLED && (
                <p className="text-[11px] text-muted-foreground/80 text-center pt-1">
                  Modalità test attiva: usa il codice <strong>123456</strong> per completare la verifica.
                </p>
              )}
            </div>
          </>
        )}
        <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          {role === "restaurant" ? (
            <Link to="/auth" search={{ role: "restaurant" } as never} className="underline hover:text-foreground">
              ← Torna alla registrazione ristoratore
            </Link>
          ) : role === "worker" ? (
            <Link to="/auth" search={{ role: "worker" } as never} className="underline hover:text-foreground">
              ← Torna alla registrazione lavoratore
            </Link>
          ) : (
            <Link to="/auth" className="underline hover:text-foreground">
              ← Torna alla registrazione
            </Link>
          )}
          {!user && (
            <Link to="/auth" className="hover:text-foreground">Torna al login</Link>
          )}
        </div>
      </div>
      <Dialog
        open={emailDialogOpen}
        onOpenChange={(v) => {
          // Evita la chiusura accidentale senza azione esplicita
          if (!v && !resendingEmail) handleAcknowledgeEmail();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Conferma la tua email
            </DialogTitle>
            <DialogDescription>
              Ti abbiamo inviato una mail di conferma. Apri la tua casella email e clicca sul link ricevuto per completare la registrazione.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Se non trovi la mail, controlla anche nella cartella spam o posta indesiderata.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleResendEmail}
              disabled={resendingEmail}
            >
              {resendingEmail ? "Invio…" : "Reinvia email"}
            </Button>
            <Button onClick={handleAcknowledgeEmail} disabled={resendingEmail}>
              Ho capito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}