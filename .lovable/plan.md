# Sistema recensioni post-turno

## Riepilogo
Estendere il flusso recensioni esistente per supportare 5 parametri specifici (puntualità, professionalità, competenza, affidabilità, collaborazione), gating sul turno completato, effetto celebrativo lato lavoratore, badge reputazionali e badge "Già lavorato con te" nella ricerca.

## 1. Database (un'unica migrazione)

Estendere `public.reviews` con i parametri specifici e il tracking apertura lato lavoratore.

```text
ALTER TABLE reviews
  ADD punctuality          smallint CHECK (BETWEEN 1 AND 5),
  ADD professionalism      smallint CHECK (BETWEEN 1 AND 5),
  ADD competence           smallint CHECK (BETWEEN 1 AND 5),
  ADD reliability          smallint CHECK (BETWEEN 1 AND 5),
  ADD teamwork             smallint CHECK (BETWEEN 1 AND 5),
  ADD seen_by_worker_at    timestamptz;
```

- `rating` esistente viene popolato dalla media dei 5 parametri (trigger BEFORE INSERT/UPDATE).
- Unique constraint: `UNIQUE (author_id, target_id, shift_id)` → blocca doppie recensioni stesso turno.
- RLS: aggiungere policy `Worker marks own review as seen` (UPDATE solo su `seen_by_worker_at` quando `target_id = auth.uid()`).

Estendere `public.profiles` con medie per parametro (aggiornate dal trigger esistente `handle_new_review`, esteso):
```text
avg_punctuality, avg_professionalism, avg_competence,
avg_reliability, avg_teamwork  (numeric, default 0)
```

Aggiornare `handle_new_review()` per ricalcolare anche queste 5 medie del worker target.

## 2. Server functions (`src/lib/reviews.functions.ts`)

- `submitWorkerReview` (`POST`, requireSupabaseAuth, restaurant only): valida i 5 punteggi 1–5 + shift_id, verifica che lo shift sia `completed` e di proprietà del ristoratore, calcola `rating` come media, inserisce o aggiorna (gestione unique).
- `getReviewForShift` (`POST`): restituisce la recensione esistente per uno shift (sia per ristoratore — vedere stato già inviato — sia per worker — vedere dettagli).
- `markReviewSeen` (`POST`, worker only): set `seen_by_worker_at = now()` se null, e restituisce se era la prima apertura (per attivare l'effetto celebrativo solo una volta).
- `getLastReviewBetween` (`POST`): per la pagina "Cerca lavoratori", ultima recensione di `restaurant_id` su `worker_id`.

## 3. UI ristoratore

### Form recensione
Nuovo componente `ReviewWorkerDialog.tsx`:
- 5 righe StarRating (1–5), commento facoltativo
- Riepilogo live: lista parametri + media calcolata
- CTA "Invia recensione"
- Mostra "Recensione già inviata" + lettura sola se esiste

### "I miei turni" (`src/routes/ristoratore.turni.*` o equivalente)
- Per ogni turno `completed`: bottone "Recensisci" se nessuna review, badge "Recensito ★ 4.6" se inviata
- Click → apre il dialog (in lettura se già inviata)

### "Cerca lavoratori" (`src/routes/workers.tsx`)
- Server fn batch `getWorkedTogether(workerIds)` per ristoratore loggato
- Se presente: badge "Già lavorato con te", stelle complessive ultima review, snippet commento, dicitura "Ricontatto gratuito"

## 4. UI lavoratore

### Notifica
Trigger `handle_new_review` già crea notifica: aggiornare title in "Hai ricevuto una nuova valutazione" e link verso nuova route `/reviews/$id`.

### Pagina dettaglio recensione `/reviews/$id`
- Locale, ruolo, data turno, valutazione complessiva, 5 parametri con stelle, commento
- Al mount chiama `markReviewSeen`. Se era la prima apertura → trigger effetto celebrativo basato sulla media:
  - ≥4.5: confetti + glow + testo "Ottimo lavoro!…" (lib `canvas-confetti` già è leggera ~5kB; aggiungerla)
  - 4.0–4.4: animazione fade/scale leggera + testo positivo
  - 3.0–3.9: nessun effetto, testo neutro
  - <3.0: nessun effetto, testo serio/costruttivo

### Profilo lavoratore
Mostrare media complessiva, totale recensioni e medie per parametro. Calcolare badge runtime:
- "Sempre puntuale" se `avg_punctuality > 4.7`
- "Affidabile" se `avg_reliability > 4.7`
- "Top Team Player" se `avg_teamwork > 4.7`
- "Professionista verificato" se `reviews_count ≥ 10 && rating_avg > 4.5`

## 5. Test

- `src/lib/__tests__/reviews-aggregation.test.ts`: calcolo media complessiva, soglie badge, soglie effetto celebrativo
- (Opzionale) `src/lib/__tests__/celebration-tier.test.ts` per la funzione che mappa media → tier

## Note tecniche
- I parametri "futuri" (velocità, immagine, stress, …) non implementati ora; lasciato hook nei tipi per estensione.
- Nessun edit di `handle_new_review` distruttivo: si aggiungono soltanto i nuovi `UPDATE` delle medie per-parametro.
- L'effetto celebrativo si basa SOLO su `seen_by_worker_at IS NULL` al momento del fetch, così resta one-shot anche tra device diversi.
