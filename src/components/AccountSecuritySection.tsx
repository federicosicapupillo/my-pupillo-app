import { useState } from "react";
import { KeyRound, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { canManagePasswordServerSide, PASSWORD_MANAGEMENT_ERROR_MESSAGE } from "@/lib/password-guard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthMethods } from "@/hooks/use-auth-methods";
import {
  IDENTITIES_LOAD_ERROR,
  mapPasswordError,
  providerLabel,
  PASSWORD_SET_METADATA_KEY,
  getAuthMethods,
  securityUiFor,
} from "@/lib/auth-methods";
import { PASSWORD_RULES, validatePasswordPair } from "@/lib/password-validation";

const VALIDATION_MESSAGES: Record<string, string> = {
  "min-length": "La password deve contenere almeno 8 caratteri.",
  "has-letter": "La password deve contenere almeno una lettera.",
  "has-digit": "La password deve contenere almeno un numero.",
  mismatch: "Le password non coincidono.",
};

function PasswordInput({
  id, label, value, onChange, autoComplete, disabled,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; autoComplete: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Nascondi password" : "Mostra password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Sezione "Sicurezza" del profilo. Mostra i metodi di accesso realmente
 * collegati e, in base a quelli, il cambio password oppure la prima
 * impostazione della password (account solo social).
 */
export function AccountSecuritySection({
  email,
  profile,
}: {
  email: string | null;
  profile?: { signup_method?: unknown } | null;
}) {
  const { methods, signupMethod, loading, error, refresh } = useAuthMethods(profile);
  const [currentPwd, setCurrentPwd] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [nonce, setNonce] = useState("");
  const [needsNonce, setNeedsNonce] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrentPwd(""); setPwd(""); setPwdConfirm(""); setNonce(""); setNeedsNonce(false);
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Sicurezza</h2>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />Caricamento dei metodi di accesso…
        </p>
      </div>
    );
  }

  if (error || !methods) {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Sicurezza</h2>
        <p className="mt-3 text-sm text-destructive">{IDENTITIES_LOAD_ERROR}</p>
        <Button variant="outline" className="mt-3" onClick={() => void refresh()}>Riprova</Button>
      </div>
    );
  }

  const { hasPasswordLogin, socialProviders } = methods;
  const ui = securityUiFor(methods, signupMethod ?? undefined);

  // Account creato tramite social login: nessuna gestione password in Pupillo.
  if (ui.mode === "social-only") {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{ui.heading}</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {ui.providerLines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        {ui.socialNotice && <p className="mt-2 text-sm text-muted-foreground">{ui.socialNotice}</p>}
      </div>
    );
  }

  /** Guardia centralizzata: solo gli account nati con email gestiscono password. */
  const assertGuard = async (): Promise<boolean> => {
    if (await canManagePasswordServerSide()) return true;
    toast.error(PASSWORD_MANAGEMENT_ERROR_MESSAGE);
    await refresh();
    return false;
  };

  /** Ricontrolla le identità prima di scrivere: la UI non è una difesa. */
  const assertMode = async (expectPassword: boolean): Promise<boolean> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      toast.error("La sessione è scaduta. Accedi di nuovo e riprova.");
      return false;
    }
    const res = await supabase.auth.getUserIdentities();
    const identities = res.error
      ? ((userData.user.identities ?? null) as { provider?: string | null }[] | null)
      : res.data.identities;
    const fresh = getAuthMethods(identities, userData.user.user_metadata as Record<string, unknown>);
    if (fresh.hasPasswordLogin !== expectPassword) {
      await refresh();
      toast.error("I metodi di accesso del tuo account sono cambiati. La pagina è stata aggiornata.");
      return false;
    }
    return true;
  };

  const validate = (): boolean => {
    const v = validatePasswordPair(pwd, pwdConfirm);
    if (!v.ok) {
      toast.error(VALIDATION_MESSAGES[v.error ?? "mismatch"] ?? "Password non valida.");
      return false;
    }
    return true;
  };

  const submitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!currentPwd) { toast.error("Inserisci la password attuale."); return; }
    if (!validate()) return;
    if (pwd === currentPwd) { toast.error("La nuova password deve essere diversa da quella attuale."); return; }
    if (!email) { toast.error("La sessione è scaduta. Accedi di nuovo e riprova."); return; }
    setBusy(true);
    if (!(await assertGuard())) { setBusy(false); return; }
    if (!(await assertMode(true))) { setBusy(false); return; }
    // Riautenticazione: verifichiamo la password attuale prima del cambio.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
    if (signInError) { setBusy(false); toast.error("La password attuale non è corretta."); return; }
    const { error: updErr } = await supabase.auth.updateUser({
      password: pwd,
      ...(nonce ? { nonce } : {}),
    });
    setBusy(false);
    if (updErr) {
      const msg = mapPasswordError(updErr);
      if (msg.startsWith("Per motivi di sicurezza")) {
        await supabase.auth.reauthenticate();
        setNeedsNonce(true);
      }
      toast.error(msg);
      return;
    }
    reset();
    await refresh();
    toast.success("Password aggiornata correttamente.");
  };

  const submitSetFirst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!validate()) return;
    setBusy(true);
    if (!(await assertGuard())) { setBusy(false); return; }
    if (!(await assertMode(false))) { setBusy(false); return; }
    const { error: updErr } = await supabase.auth.updateUser({
      password: pwd,
      data: { [PASSWORD_SET_METADATA_KEY]: true },
      ...(nonce ? { nonce } : {}),
    });
    if (updErr) {
      setBusy(false);
      const msg = mapPasswordError(updErr);
      if (msg.startsWith("Per motivi di sicurezza")) {
        await supabase.auth.reauthenticate();
        setNeedsNonce(true);
      }
      toast.error(msg);
      return;
    }
    reset();
    await refresh();
    setBusy(false);
    toast.success("Password impostata. Ora puoi accedere anche tramite email e password.");
  };

  return (
    <div className="mt-6 rounded-2xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{ui.heading}</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {ui.providerLines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        {ui.socialNotice && <p className="mt-2 text-sm text-muted-foreground">{ui.socialNotice}</p>}
      </div>

      {hasPasswordLogin ? (
        <form onSubmit={submitChange} className="space-y-3">
          <h3 className="font-medium flex items-center gap-2"><KeyRound className="h-4 w-4" />{ui.actionLabel}</h3>
          <PasswordInput id="current-pwd" label="Password attuale *" value={currentPwd} onChange={setCurrentPwd} autoComplete="current-password" disabled={busy} />
          <PasswordInput id="new-pwd" label="Nuova password *" value={pwd} onChange={setPwd} autoComplete="new-password" disabled={busy} />
          <PasswordInput id="confirm-pwd" label="Conferma nuova password *" value={pwdConfirm} onChange={setPwdConfirm} autoComplete="new-password" disabled={busy} />
          <PasswordHints pwd={pwd} confirm={pwdConfirm} />
          {needsNonce && (
            <div>
              <Label htmlFor="pwd-nonce">Codice di verifica ricevuto via email *</Label>
              <Input id="pwd-nonce" className="mt-1" value={nonce} onChange={(e) => setNonce(e.target.value)} disabled={busy} />
            </div>
          )}
          <Button type="submit" disabled={busy || !currentPwd || !pwd || !pwdConfirm}>
            {busy ? "Aggiornamento…" : "Aggiorna password"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitSetFirst} className="space-y-3">
          <h3 className="font-medium flex items-center gap-2"><KeyRound className="h-4 w-4" />{ui.actionLabel}</h3>
          <p className="text-sm text-muted-foreground">
            Impostando una password potrai accedere a Pupillo anche con la tua email.
            Il tuo accesso con {socialProviders.map(providerLabel).join(" e ") || "il provider collegato"} resta attivo.
          </p>
          <PasswordInput id="set-pwd" label="Nuova password *" value={pwd} onChange={setPwd} autoComplete="new-password" disabled={busy} />
          <PasswordInput id="set-pwd-confirm" label="Conferma nuova password *" value={pwdConfirm} onChange={setPwdConfirm} autoComplete="new-password" disabled={busy} />
          <PasswordHints pwd={pwd} confirm={pwdConfirm} />
          {needsNonce && (
            <div>
              <Label htmlFor="set-pwd-nonce">Codice di verifica ricevuto via email *</Label>
              <Input id="set-pwd-nonce" className="mt-1" value={nonce} onChange={(e) => setNonce(e.target.value)} disabled={busy} />
            </div>
          )}
          <Button type="submit" disabled={busy || !pwd || !pwdConfirm}>
            {busy ? "Salvataggio…" : "Imposta password"}
          </Button>
        </form>
      )}
    </div>
  );
}

function PasswordHints({ pwd, confirm }: { pwd: string; confirm: string }) {
  return (
    <div className="text-xs text-muted-foreground">
      <ul className="space-y-0.5">
        {PASSWORD_RULES.map((r) => (
          <li key={r.id} className={pwd && r.test(pwd) ? "text-foreground" : undefined}>
            {pwd && r.test(pwd) ? "✓" : "•"} {r.label}
          </li>
        ))}
      </ul>
      {confirm && pwd !== confirm && (
        <p className="mt-1 text-destructive">Le password non coincidono.</p>
      )}
    </div>
  );
}
