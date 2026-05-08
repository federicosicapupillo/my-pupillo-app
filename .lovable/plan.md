## Piano: Sistema Referral + Codici Sconto

Funzionalità grande e trasversale (DB, frontend ristoratore/lavoratore, checkout, admin). La divido in 4 fasi con migrazioni separate.

### Fase 1 — Database

**Migrazione 1: Referral**
- `profiles`: aggiungere `referral_code` (text unique), `referred_by_user_id` (uuid), `referral_credits_earned` (int default 0)
- Trigger su INSERT profiles → genera codice tipo `PUPILLO-XXXXXX` (6 char random)
- Backfill codici per utenti esistenti
- Nuova tabella `referral_invites` (id, referrer_user_id, referred_user_id, referral_code, status enum [pending/registered/verified/completed/rejected], credits_awarded bool, credits_amount int, created_at, completed_at)
- RLS: utente vede i propri inviti
- Funzione `award_referral_credits(_referred_user_id)` SECURITY DEFINER:
  - controlla referred_by_user_id sul profilo
  - controlla profile_completed && phone_verified
  - controlla che non esista già una riga `completed` per quel referred
  - chiama `grant_credits(referrer, 5, 'referral', ...)`
  - aggiorna `referral_invites` → completed
- Trigger su `profiles` AFTER UPDATE: quando `phone_verified` o `profile_completed` passa a true e `referred_by_user_id` non null → chiama `award_referral_credits`

**Migrazione 2: Codici sconto**
- Tabella `discount_codes` (code unique citext o lower-saved, description, discount_type enum [percentage/fixed_amount/free_credits], discount_value numeric, max_uses int, used_count int default 0, valid_from, valid_until, is_active bool, applies_to enum [credits/premium/all])
- Tabella `discount_redemptions` (discount_code_id, user_id, order_id text, used_at, discount_amount numeric)
- RLS: lettura codici a tutti gli autenticati (necessario per validare); scrittura solo admin; redemptions visibili al proprietario, insert da service_role
- Funzione `validate_discount_code(_code, _applies_to)` STABLE → restituisce JSON { valid, type, value, message }
- Seed dei 3 codici demo: PUPILLO10, START20, CREDITI5

### Fase 2 — Frontend Referral

- Componente `ReferralCard.tsx` riusabile con: codice, link (`${origin}/auth?role=...&ref=CODE`), copia codice, copia link, condividi WhatsApp, statistiche (invitati, registrati, in attesa, crediti)
- Inserito in: `/dashboard` (sia ristoratore che lavoratore), `/profile`
- Hook `useReferralStats()` che legge da `referral_invites`
- In `/auth` (signup): leggere `?ref=` da URL, mostrare badge "Codice referral applicato: XXX", al submit salvare in `profiles.referred_by_user_id` (lookup tramite `referral_code`)
- Validazione anti-abuso lato client: non può essere il proprio codice (ma controllo finale lato DB tramite trigger)

### Fase 3 — Codice sconto in checkout

- File `src/routes/billing.tsx` (e/o `StripeEmbeddedCheckout`): aggiungere input "Codice sconto" + bottone "Applica"
- Server function `validateDiscountCode` (`src/lib/discounts.functions.ts`) → chiama RPC `validate_discount_code`
- Mostrare riepilogo sconto + totale aggiornato
- Per Stripe: passare `discount` o creare coupon dinamico — semplificazione: per ora applichiamo lo sconto come `coupon` Stripe via API (creo coupon one-shot in `createCheckoutSession` se viene passato `discountCode`). Per `free_credits` invece: bypass Stripe, chiamare direttamente `grant_credits` se max_uses ok.
- Aggiornare `createCheckoutSession` per accettare opzionale `discountCode`
- Insert in `discount_redemptions` dopo conferma pagamento (nel webhook `/api/public/payments/webhook.ts`) + increment `used_count`

### Fase 4 — Admin

- In `/admin` aggiungere tab "Referral e Sconti"
- Tabella inviti: join referrer/referred profiles
- CRUD codici sconto (form crea/modifica, toggle is_active)
- RLS già limita ad admin via `has_role`

### Note tecniche
- I controlli anti-abuso (no auto-referral, codice unico per utente, no doppio accredito) sono nei trigger DB, non solo client.
- `referral_code` univoco, formato `PUPILLO-` + 6 char alfanumerici uppercase.
- Codici sconto case-insensitive: salvare upper, query upper.

### Limitazioni / cose da chiarire
- Per i codici `free_credits` durante l'acquisto crediti: aggiungo i crediti gratis al pacchetto invece di scontare il prezzo.
- Per ora i refresh dei crediti referral avvengono via trigger su `profiles` (quando `phone_verified` diventa true E `profile_completed` true). Non includo email confirmation.

Procedo con questo piano?