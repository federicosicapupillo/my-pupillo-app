## Obiettivo

Aggiungere un controllo globale "profilo completo" che blocchi le funzioni operative di Pupillo per lavoratori e ristoratori con profilo incompleto, senza toccare grafica, layout o flussi esistenti.

## Architettura

Tutta la logica vive in un solo modulo + un guard di route + un popup riutilizzabile. Nessuna modifica visiva alle pagine esistenti, solo intercettazione delle azioni operative.

### 1. Modulo centrale `src/lib/profile-completion.ts`

Funzione pura, una sola fonte di verità:

```ts
isProfileComplete(profile, role): boolean
getProfileCompletion(profile, role): { percent: number; missing: MissingItem[] }
getCompleteProfileRoute(role): string  // /onboarding (worker) o /onboarding ristoratore
```

Campi obbligatori per ruolo (basati su tabella `profiles` esistente):

- **Worker**: `phone_verified`, `profile_completed`, `first_name`, `last_name`, `birth_date`, `id_document_path`, `primary_role`, `avatar_url`, `tax_code`, `residence_city`
- **Restaurant**: `phone_verified`, `profile_completed`, `business_name`, `vat_number`, `vat_status='valid'`, `address`/`city`, `contact_person_first_name`, `contact_person_phone`, `venue_type`

Ogni item mancante è una label leggibile (es. "Documento d'identità mancante").

### 2. Hook + Context `src/lib/profile-gate.tsx`

- `useProfileGate()` → `{ isComplete, completion, requireComplete(action?) }`
- Provider che monta un `<Dialog>` globale "Completa il profilo per continuare" con pulsanti "Completa profilo" / "Torna alla dashboard"
- `requireComplete()` apre il popup e ritorna `false` se incompleto; altrimenti esegue l'azione

Montato in `src/routes/__root.tsx` dentro `AuthProvider`.

### 3. Route guard `src/components/RequireCompleteProfile.tsx`

Wrapper applicato nelle route operative. Se profilo incompleto: rende un placeholder minimale + apre automaticamente il popup. Se completo: rende `children`.

**Route da proteggere** (whitelist delle SBLOCCATE = onboarding, verify-phone, profile, dashboard, billing, terms, reset-password, registration-success, assistance, notifications, logout):

Worker bloccato: `/browse`, `/jobs`, `/availability`, `/messages`, `/messages/$id`, `/shifts`, `/announcements/$id` (azione candidatura), `/mappa`

Restaurant bloccato: `/ristoratore/annunci/nuovo`, `/announcements/new`, `/workers`, `/ristoratore/collaboratori`, `/ristoratore/turni/$shiftId`, `/messages`, `/messages/$id`, `/shifts`, `/announcements/$id`

Implementazione minimale: lista di pathname pattern in `__root.tsx` o in un piccolo `OperativeRouteGuard` che osserva `useLocation()` e blocca render + apre dialog.

### 4. Box dashboard `src/components/ProfileCompletionBanner.tsx`

Mostrato in cima a `/dashboard` SOLO se profilo incompleto. Riusa stile esistente di `ProfileStatusBanner` (dark + accenti, già coerente con la palette) ma con:
- Titolo "Profilo incompleto"
- Barra avanzamento (`<Progress>`) con percentuale
- Elenco dinamico dati mancanti
- Pulsanti "Completa profilo" / "Assistenza"

Inserito nella dashboard esistente sopra il contenuto, senza rimuovere `ProfileStatusBanner` (oppure sostituendolo condizionatamente).

### 5. Action gating mirato (anti-bypass)

Anche con il route guard, intercettare le azioni operative chiave per coerenza:
- `src/routes/announcements.$id.tsx` → handler "Candidati" chiama `requireComplete()` prima di insert su `applications`
- `src/routes/workers.tsx` → handler "Invia proposta" chiama `requireComplete()`
- `src/routes/announcements.new.tsx` / `ristoratore.annunci.nuovo.tsx` → submit chiama `requireComplete()`
- `src/routes/messages.$id.tsx` → invio messaggio chiama `requireComplete()`

Una sola riga per call site (`if (!requireComplete()) return;`).

### 6. Visibilità lavoratore nelle ricerche

Filtro server-side per nascondere worker incompleti da `/workers` e dalla mappa: aggiungere `.eq('profile_completed', true).eq('phone_verified', true)` nelle query esistenti (1 riga per query). Nessun cambio UI.

## Cosa NON viene toccato

- Grafica, colori, layout, testi pulsanti esistenti
- Logica di candidatura, accettazione, chat, crediti, pagamenti, routing
- RLS database (tutto applicato a livello applicativo; coerente con regole privacy già attive)
- Componenti UI esistenti tranne il banner dashboard

## File creati / modificati

**Nuovi (3):**
- `src/lib/profile-completion.ts`
- `src/lib/profile-gate.tsx`
- `src/components/ProfileCompletionBanner.tsx`
- `src/components/RequireCompleteProfile.tsx`

**Modificati (puntuali):**
- `src/routes/__root.tsx` — montare `ProfileGateProvider` + route guard
- `src/routes/dashboard.tsx` — inserire `ProfileCompletionBanner` in cima quando incompleto
- `src/routes/announcements.$id.tsx` — gating azione candidatura
- `src/routes/announcements.new.tsx` (o equivalente) — gating submit
- `src/routes/workers.tsx` — gating "Invia proposta" + filtro query
- `src/routes/messages.$id.tsx` — gating invio messaggio
- `src/routes/ristoratore.annunci.nuovo.tsx` — gating submit
- Eventuale filtro su mappa workers
