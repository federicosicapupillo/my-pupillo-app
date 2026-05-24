## Obiettivo

Sostituire i toast generici con una validazione che porta l'utente al primo campo mancante, lo evidenzia con bordo rosso, mostra un messaggio sotto, e pulisce errore appena compilato. Funzionante su mobile, tema chiaro/scuro, riutilizzabile.

## Approccio

Creare un'utility riutilizzabile + applicarla ai due form più critici dove oggi compaiono errori generici:

1. **`src/lib/form-field-validation.ts`** — nuova utility:
   - `registerField(name, ref)` per registrare i ref dei campi (input/section)
   - `focusFirstMissing(errors, refs)` — scroll smooth + focus al primo campo con errore, con `block: "center"`
   - Hook `useFieldErrors()` che restituisce `{ errors, setErrors, clearError, fieldProps(name) }` dove `fieldProps` ritorna `{ ref, "aria-invalid", className }` da spreddare sui campi.
   - Helper `FieldError({ name })` che renderizza `<p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle/> {message}</p>`.
   - Classe errore: `"border-destructive focus-visible:ring-destructive/40"` (già nel token system).

2. **`src/routes/onboarding.tsx`** (worker + restaurant):
   - Sostituire la sequenza di `toast.error(...)` nella `saveProfile` con `setErrors({...})` + `focusFirstMissing`.
   - Aggiungere `ref` ai campi chiave (telefono, partita IVA, nome locale, indirizzo, città, CAP, referente, data nascita, documenti, foto profilo, mansioni, zone).
   - Mostrare `<FieldError name="..."/>` sotto ogni campo.
   - Mantenere tutti i testi esistenti dei toast come messaggi di errore inline + tenere un toast riassuntivo breve ("Completa i campi evidenziati").
   - Pulizia automatica: handler `onChange` esistenti chiamano `clearError(name)`.

3. **`src/routes/profile.tsx`** — stesso pattern dove esistono salvataggi con campi obbligatori.

4. **Gating operativo (candidature / pubblicazione annunci / proposte)**:
   - In `src/routes/announcements.$id.tsx` (candidatura worker), `src/routes/ristoratore.annunci.nuovo.tsx` (pubblica annuncio), `src/routes/workers.tsx` (invia proposta): prima dell'azione, controllare `profile.profile_completed`. Se false, mostrare toast "Completa il profilo per continuare" + `navigate({ to: "/onboarding" })`. L'onboarding al mount legge un eventuale `?focus=<fieldName>` (o semplicemente esegue la validazione iniziale silenziosa) e fa scroll al primo campo mancante.

5. **Accessibilità sezioni libere**: il `PhoneVerificationGate` e `RequireAuth` non vengono toccati; `/onboarding`, `/profile`, `/terms`, ecc. restano accessibili come ora.

## Dettagli tecnici

**Utility file:**
```ts
// src/lib/form-field-validation.ts
export function useFieldErrors<T extends string>() {
  const refs = useRef<Record<string, HTMLElement|null>>({});
  const [errors, setErrors] = useState<Partial<Record<T,string>>>({});
  const register = (name:T) => (el:HTMLElement|null) => { refs.current[name]=el; };
  const clearError = (name:T) => setErrors(e => { const n={...e}; delete n[name]; return n; });
  const focusFirst = (order:T[]) => {
    for (const k of order) if (errors[k]) {
      const el = refs.current[k];
      el?.scrollIntoView({ behavior:"smooth", block:"center" });
      requestAnimationFrame(()=> (el as HTMLInputElement|null)?.focus?.());
      return;
    }
  };
  return { errors, setErrors, clearError, register, focusFirst };
}

export const errorFieldClass = "border-destructive focus-visible:ring-destructive/40 aria-[invalid=true]:border-destructive";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
    <AlertCircle className="h-3.5 w-3.5"/>{message}
  </p>;
}
```

**Integrazione `onboarding.tsx`:**
sostituire blocco `if (...) { toast.error(...); return; }` con costruzione `const errs: Record<string,string> = {}; if(!field) errs.field="Campo obbligatorio"; ... if (Object.keys(errs).length) { setErrors(errs); focusFirst(ORDER); toast.error("Completa i campi evidenziati"); return; }`.

Su ogni `<Input>` o componente: `ref={register("fieldName")} aria-invalid={!!errors.fieldName} className={cn(base, errors.fieldName && errorFieldClass)} onChange={e => { setField(...); clearError("fieldName"); }}`.
Sotto: `<FieldError message={errors.fieldName}/>`.

## Scope file

- create: `src/lib/form-field-validation.tsx`
- edit: `src/routes/onboarding.tsx` (entrambi i flussi worker/restaurant)
- edit: `src/routes/profile.tsx` (se ha validazioni di salvataggio)
- edit: `src/routes/announcements.$id.tsx` — gate candidatura worker
- edit: `src/routes/ristoratore.annunci.nuovo.tsx` — gate pubblicazione + sostituire validazione interna con stesso pattern
- edit: `src/routes/workers.tsx` — gate "Invia proposta"

## Fuori scope (non tocco)

- logica candidatura/accettazione/chat/crediti/pagamenti/routing/permessi
- testi UI esistenti (oltre ai messaggi errore inline)
- layout generale