# Pupillo — Visual Audit Export Guide

Questa guida spiega come usare il nuovo `/claude-visual-audit` e come completare gli screenshot delle route protette.

## Cosa è già stato generato automaticamente

Screenshot reali della build in `public/audit-screenshots/`, generati con Playwright a due viewport:

- **Mobile**: 412 × 900 (2x DPR)
- **Desktop**: 1280 × 1600 (2x DPR)

File presenti (mobile + desktop per ognuno):

| # | File base | Route | Note |
|---|-----------|-------|------|
| 01 | 01-home | / | Homepage pubblica |
| 02 | 02-come-funziona | /come-funziona | Landing "Come funziona" |
| 03 | 03-auth-login | /auth | Login / registrazione |
| 04 | 04-reset-password | /reset-password | Recupero password |
| 05 | 05-terms | /terms | Termini di servizio |
| 06 | 06-registration-success | /registration-success | Conferma registrazione |
| 07 | 07-forbidden | /forbidden | Accesso negato |
| 08 | 08-account-error | /account-error | Errore account |
| 09 | 09-dashboard-redirect | /dashboard | Redirect a login (protetta) |
| 10 | 10-profile-redirect | /profile | Redirect a login (protetta) |
| 11 | 11-availability-redirect | /availability | Redirect a login (protetta) |
| 12 | 12-jobs-redirect | /jobs | Redirect a login (protetta) |
| 13 | 13-shifts-redirect | /shifts | Redirect a login (protetta) |
| 14 | 14-messages-redirect | /messages | Redirect a login (protetta) |
| 15 | 15-notifications-redirect | /notifications | Redirect a login (protetta) |
| 16 | 16-announcements-redirect | /announcements | Redirect a login (protetta) |
| 17 | 17-browse-redirect | /browse | Redirect a login (protetta) |
| 18 | 18-mappa-redirect | /mappa | Redirect a login (protetta) |
| 19 | 19-workers-redirect | /workers | Redirect a login (protetta) |
| 20 | 20-billing-redirect | /billing | Redirect a login (protetta) |
| 21 | 21-onboarding-redirect | /onboarding | Redirect a login (protetta) |

## Perché alcune schermate mostrano il login

Le route protette (`/dashboard`, `/profile`, `/availability`, `/jobs`, `/shifts`,
`/messages`, `/notifications`, `/announcements`, `/browse`, `/mappa`, `/workers`,
`/billing`, `/onboarding`, ecc.) richiedono una sessione autenticata. In fase di
cattura automatica non era disponibile una sessione, quindi lo screenshot mostra
correttamente il gate di autenticazione. Sostituiscili con screenshot reali
seguendo la procedura sotto.

## Come catturare manualmente gli screenshot autenticati

### Come lavoratore

1. Apri l'app in Chrome/Edge.
2. Login come lavoratore (es. Marco Rossi).
3. Apri DevTools → toggle device toolbar (Cmd+Shift+M).
4. Imposta viewport **412 × 900** per mobile, **1280 × 1600** per desktop.
5. Per ognuna di queste route fai screenshot full-page (Cmd+Shift+P → "Capture full size screenshot"):
   - `/dashboard`
   - `/profile`
   - `/availability`
   - `/jobs` (+ dettaglio offerta)
   - `/shifts` (turni confermati / completati / annullati)
   - `/messages` (+ dettaglio chat `/messages/:id`)
   - `/notifications`
   - `/onboarding`
   - `/reviews/:id` (recensione da lasciare)
6. Salva ogni file in `public/audit-screenshots/` con il nome che compare in tabella,
   suffisso `-mobile.png` o `-desktop.png`, sovrascrivendo il redirect.

### Come ristoratore

1. Logout e login come ristoratore (es. Osteria Milano Centro).
2. Ripeti la stessa procedura viewport per:
   - `/dashboard` (versione ristoratore)
   - `/announcements` e `/announcements/new`
   - `/announcements/:id` (dettaglio annuncio + candidature)
   - `/mappa`
   - `/workers` e `/workers/:id`
   - `/ristoratore/annunci/nuovo`
   - `/ristoratore/collaboratori`
   - `/ristoratore/recensioni`
   - `/ristoratore/turni/:shiftId`
   - `/billing`
   - `/messages`
3. Salva nella stessa cartella.

## Come esportare la pagina in PDF

1. Apri `https://<tuo-dominio>/claude-visual-audit`.
2. Aspetta il caricamento di tutti gli screenshot (scroll fino in fondo).
3. Cmd/Ctrl + P → **Salva come PDF**.
4. Attiva **Grafica di sfondo**, formato **A4**, margini **default**.
5. Salva come `Pupillo-Visual-Audit.pdf`.

## Cosa caricare su Claude

- `Pupillo-Visual-Audit.pdf` (l'export della pagina).
- `PUPILLO_VISUAL_AUDIT_EXPORT_GUIDE.md` (questo file).
- Opzionale: `PUPILLO_CLAUDE_AUDIT_PACK.md` per il contesto funzionale.

## Schermate prioritarie per l'audit

Ordina Claude a concentrarsi in particolare su:

1. **Homepage** (`/`) — value proposition, gerarchia CTA, fiducia.
2. **Login/Registrazione** (`/auth`) — contrasto, form, error state.
3. **Dashboard lavoratore** (`/dashboard`) — cosa vede al primo login.
4. **Ricerca offerte** (`/jobs`, `/browse`) — card, filtri, mobile UX.
5. **Chat** (`/messages`, `/messages/:id`) — leggibilità e contrasto.
6. **Dashboard ristoratore** — priorità operative, CTA principali.
7. **Pubblicazione annuncio** (`/announcements/new`) — friction del form.
8. **Ricerca lavoratori** (`/workers`) — card sanitizzata, privacy.
9. **Mappa** (`/mappa`) — leggibilità pin, controlli.
10. **Onboarding** (`/onboarding`) — chiarezza dei primi passi.

## Regenerare gli screenshot automatici

Lo script è in `/tmp/browser/audit/shots.py` (temporaneo). Per rieseguirlo su una
nuova build, ricreane una copia con lo stesso contenuto e lancia:

```bash
python3 /tmp/browser/audit/shots.py
```

Assicurati che il dev server giri su `http://localhost:8080`.
