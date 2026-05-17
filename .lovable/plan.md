## Obiettivo
Bloccare il ristoratore dal contattare nuovi lavoratori finché tutti i turni terminati con lavoratore confermato non sono stati chiusi e recensiti. Estendere la logica esistente di `required_reviews` (oggi blocca solo su recensioni "overdue") in modo che blocchi **immediatamente** appena un turno è terminato.

## Modifiche

### 1. Logica di blocco condivisa — `src/lib/required-reviews.ts`
- Estendere `useRequiredReviews()` con `actionShifts`: turni del ristoratore dove `(status='scheduled' AND end_datetime < now)` (= "Da chiudere") oppure `(status='completed' AND nessuna recensione del ristoratore)` (= "Recensione da inviare").
- Calcolare `end_datetime` da `shifts.shift_date` + `announcement.end_time` (fuso Europa/Roma).
- Esporre arricchito con: nome lavoratore, ruolo, data, orario, nome locale, stato (`to_close` | `review_pending`).
- Nuovo flag `isBlocked = actionShifts.length > 0` (sostituisce la logica basata solo su `overdue`).

### 2. Nuovo componente `src/components/BlockedContactDialog.tsx`
- Modal riusabile con titolo "Completa i turni precedenti" e il testo richiesto.
- Mostra il count ("Hai X turni da chiudere…") e la lista dei turni bloccanti con: nome lavoratore, ruolo, data, orario, locale, badge stato.
- CTA primario "Chiudi turno e lascia recensione" → naviga a `/shifts?tab=to-review&shift=<id>` (apre direttamente il form recensione del primo turno).
- CTA secondario "Vai ai miei turni" → `/shifts`.

### 3. Enforcement nei punti di contatto
Wrappare ogni azione di "contatto nuovo lavoratore" con un guard che apre il dialog invece di procedere:
- `src/routes/workers.tsx` — `invite()` (sostituisce il toast attuale con il dialog).
- `src/routes/announcements.tsx` — `handleSend()` della `ProposalConfirmDialog` (Invia proposta dai candidati) e tutti i punti che aprono `setProposalTarget`.
- `src/routes/ristoratore.collaboratori.tsx` — bottone "Ricontatta".
- Disabilitare i bottoni "Invia proposta"/"Ricontatta"/"Messaggia" con tooltip esplicativo quando bloccato.

### 4. Pagina `src/routes/shifts.tsx` — sezione "Azioni richieste"
- In cima alla pagina (solo per role=restaurant), mostrare card "Azioni richieste" con la lista di `actionShifts`. Sostituisce il banner attuale quando ci sono azioni.
- Ogni card: nome lavoratore, ruolo, data, orario, badge ("Da chiudere" o "Recensione da inviare"), pulsante "Chiudi e recensisci" che apre il form inline esistente (e auto-completa lo status se ancora `scheduled`).
- Supportare query param `?shift=<id>` per scrollare e aprire automaticamente il form.

### 5. Form recensione multi-criteri (`shifts.tsx`)
La tabella `reviews` ha già le colonne `punctuality`, `professionalism`, `competence`, `reliability`, `teamwork`. Estendere il form attuale (oggi: un solo rating) con 5 righe di stelle 1-5 per ciascun criterio + commento opzionale. Salvare i 5 valori e impostare `rating` = media arrotondata per retro-compatibilità.

### 6. Stati e badge
Etichette UI usate (mappate sulle colonne esistenti, nessuna nuova colonna):
- `scheduled` + `end_datetime` futuro → "Programmato"
- `scheduled` + `end_datetime` passato → "Da chiudere"
- `completed` + no review → "Recensione da inviare"
- `completed` + review presente → "Chiuso · Recensione inviata"

## Dettagli tecnici
- Nessuna migrazione DB necessaria: tutto il modello dati esiste già (`shifts`, `reviews` con le 5 colonne, `required_reviews` resta valido per email/cron ma non è più la fonte di verità del blocco).
- Il filtro "fuso orario" usa gli helper esistenti `getShiftEndDate` in `src/lib/announcement-time.ts`.
- Il refresh dopo invio recensione richiama `refresh()` dell'hook per aggiornare il dialog e sbloccare in tempo reale.

## File modificati
- `src/lib/required-reviews.ts`
- `src/components/BlockedContactDialog.tsx` (nuovo)
- `src/routes/workers.tsx`
- `src/routes/announcements.tsx`
- `src/routes/ristoratore.collaboratori.tsx`
- `src/routes/shifts.tsx`
