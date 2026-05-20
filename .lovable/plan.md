## Chat di assistenza IA in Pupillo

Aggiungo un assistente in-app accessibile da un pulsante flottante "Serve aiuto?" in basso a destra su tutte le pagine autenticate. Prima versione: assistente guidato con FAQ + risposte AI dinamiche tramite Lovable AI Gateway (google/gemini-2.5-flash) e segnalazione problemi salvata in DB.

### 1. Database (1 migrazione)

Nuova tabella `support_tickets`:
- `id`, `user_id`, `user_role`, `category` (text), `message` (text), `page_url` (text), `status` (`aperto`|`in_lavorazione`|`risolto`|`chiuso`, default `aperto`), `created_at`, `updated_at`
- RLS: utenti creano e leggono i propri ticket; admin (via `has_role`) leggono/modificano tutti.

### 2. Base conoscenza (file statico)

`src/lib/assistant-kb.ts` — esporta:
- `WORKER_FAQS` e `RESTAURANT_FAQS`: array `{ id, question, answer, cta?: { label, to } }` con tutte le domande elencate nel brief.
- `ERROR_FAQS` comuni a entrambi i ruoli.
- `KB_SYSTEM_PROMPT`: contesto sintetico per l'IA (cosa fa Pupillo, rotte principali, regole privacy: niente nome locale/cognome/telefono/indirizzo prima di assegnazione, mai inventare dati).
- `getContextualFaqs(pathname, role)`: ordina le FAQ pertinenti per prime in base alla rotta corrente (`/availability`, `/messages`, `/announcements/new`, ecc.).

### 3. Server function IA

`src/lib/assistant.functions.ts`:
- `askAssistant({ message, history, role, pathname })` con `requireSupabaseAuth`.
- Chiama Lovable AI Gateway (`google/gemini-2.5-flash`, endpoint `https://ai.gateway.lovable.dev/v1/chat/completions`, `LOVABLE_API_KEY`) con system prompt + KB.
- Risponde `{ reply: string, cta?: { label, to } }`. Se non sa: messaggio fisso "Non riesco a verificarlo automaticamente…".
- `createSupportTicket({ category, message, pageUrl })` → insert su `support_tickets`.

### 4. UI componenti

- `src/components/assistant/AssistantFab.tsx` — pulsante flottante fixed bottom-right (z-index alto, nascosto se non autenticato, offset su mobile per non coprire bottom nav).
- `src/components/assistant/AssistantPanel.tsx` — `Sheet` lateral su desktop, bottom sheet (`Drawer`) su mobile. Contiene:
  - Header con titolo + chiudi.
  - Messaggio di benvenuto per ruolo.
  - Chip con domande rapide contestuali (max 6 visibili, "mostra altre").
  - Lista messaggi (utente + assistente) con CTA inline (`<Link>` alle rotte esistenti).
  - Input + invio (usa `askAssistant`).
  - Bottone "Segnala un problema" → apre `ReportProblemDialog`.
- `src/components/assistant/ReportProblemDialog.tsx` — form con categoria (select), descrizione (textarea), `page_url` auto-prefilled, submit → `createSupportTicket`.

Montaggio: in `AppShell.tsx` (già presente come shell autenticata) aggiungo `<AssistantFab />` + `<AssistantPanel />` controllati da stato locale.

### 5. Admin

Nuova sezione `src/components/AdminSupportTicketsSection.tsx` montata in `src/routes/admin.tsx`:
- Lista ticket con filtri stato.
- Per riga: utente, ruolo, categoria, messaggio (troncato + expand), pagina, stato, data.
- Select per cambiare stato (aggiorna riga + `updated_at`).

### 6. Cose che NON cambio

Rotte esistenti, logica chat/offerte/mappa/privacy/crediti, tabelle esistenti, `client.ts`, `types.ts`. Aggiungo solo nuovi file + 1 migrazione + 1 punto di mount in `AppShell.tsx` + 1 sezione in `admin.tsx`.

### Note tecniche

- IA chiamata server-side via `createServerFn` (mai esporre `LOVABLE_API_KEY` al client). Se il modello non è raggiungibile, fallback alle FAQ statiche (mostro messaggio "modalità guidata").
- Privacy: il prompt di sistema istruisce esplicitamente l'IA a non inventare dati personali e a indirizzare alla segnalazione quando non sa.
- Mobile: FAB `bottom-20 right-4` per non coprire la barra di navigazione, panel come `Drawer` di vaul (già in shadcn).
- A11y: `aria-label` sul FAB, focus trap dal componente shadcn, Esc per chiudere.

Approvi questo piano? Se sì procedo con migrazione + codice.