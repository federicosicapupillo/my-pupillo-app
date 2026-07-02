# Pupillo — Visual Audit Export Guide

Questa guida accompagna la pagina `/claude-visual-audit` e lo script `scripts/generate-audit-screenshots.py`.

## Problema corretto

Gli screenshot precedenti mostravano la maschera “Accesso riservato — Pupillo è attualmente in fase di test privato” oppure redirect al login. La pagina audit ora non mostra più screenshot mascherati: gli screenshot invalidi vengono rimossi e quelli protetti sono marcati come “da generare con credenziali audit”.

Il private beta gate dell'app reale non è stato rimosso. Il bypass vale solo per la route documentale `/claude-visual-audit`; lo script locale imposta una sessione temporanea nel browser di audit per catturare screenshot.

## Variabili richieste per generare schermate protette

Imposta queste variabili prima di lanciare lo script:

```bash
export AUDIT_PRIVATE_ACCESS_PASSWORD="password-test-private-beta"
export AUDIT_WORKER_EMAIL="worker-audit@example.com"
export AUDIT_WORKER_PASSWORD="password-lavoratore"
export AUDIT_RESTAURANT_EMAIL="restaurant-audit@example.com"
export AUDIT_RESTAURANT_PASSWORD="password-ristoratore"
```

Se mancano le credenziali lavoratore o ristoratore, lo script genera solo le schermate pubbliche e salta le schermate autenticate per evitare screenshot non validi.

## Come rigenerare gli screenshot

1. Assicurati che l'app sia disponibile su `http://localhost:8080`.
2. Imposta le variabili sopra.
3. Esegui:

```bash
python3 scripts/generate-audit-screenshots.py
```

Gli output vengono salvati in `public/audit-screenshots/`. Lo script cancella prima gli screenshot vecchi, così la pagina audit non mostra più immagini con gate privato o login redirect.

## Screenshot generati automaticamente in questa versione

Questi screenshot pubblici sono generabili senza sessione utente:

| File | Route | Stato |
|---|---|---|
| `01-home-desktop.png` | `/` | homepage desktop |
| `02-home-mobile.png` | `/` | homepage mobile |
| `03-come-funziona-desktop.png` | `/come-funziona` | pagina informativa desktop |
| `04-come-funziona-mobile.png` | `/come-funziona` | pagina informativa mobile |
| `05-login-desktop.png` | `/auth` | login desktop |
| `06-login-mobile.png` | `/auth` | login mobile |
| `07-register-worker-mobile.png` | `/auth?role=worker` | registrazione lavoratore |
| `08-register-restaurant-mobile.png` | `/auth?role=restaurant` | registrazione ristoratore |
| `09-reset-password-mobile.png` | `/reset-password` | recupero password |
| `10-login-error-mobile.png` | `/auth` | errore login |
| `11-register-error-mobile.png` | `/auth?role=worker` | errore registrazione/form non valido |
| `68-error-state-mobile.png` | `/account-error` | stato errore account |

## Screenshot da generare con login lavoratore

- Dashboard lavoratore: `12-worker-dashboard-mobile.png`
- Profilo lavoratore: `13-worker-profile-mobile.png`
- Modifica profilo lavoratore: `14-worker-profile-edit-desktop.png`
- Disponibilità: `15-worker-availability-mobile.png`
- Ricerca offerte / Jobs: `16-worker-jobs-mobile.png`
- Dettaglio offerta: `17-worker-job-detail-mobile.png` *(richiede dati/offerta reale)*
- Candidatura inviata: `18-worker-application-sent-mobile.png` *(richiede interazione manuale)*
- Offerte ricevute/accettate/rifiutate: `19`, `20`, `21`
- Turni confermati/completati/annullati: `22`, `23`, `24`
- Recensioni e recensione da lasciare: `25`, `26`
- Messaggi/chat: `27-worker-messages-mobile.png`
- Notifiche: `28-worker-notifications-mobile.png`
- Impostazioni/cambio password: `29`, `30`
- Onboarding/help/supporto: `31`, `32`
- Empty/data/loading states collegati: `65`, `66`, `67`, `70`, `71`

## Screenshot da generare con login ristoratore

- Dashboard ristoratore: `33-restaurant-dashboard-desktop.png`
- Profilo locale e modifica profilo: `34`, `35`
- Pubblicazione annuncio: `36-restaurant-announcement-new-mobile.png`
- Elenco/dettaglio annuncio: `37`, `38`
- Candidature ricevute/dettaglio candidatura: `39`, `40`
- Ricerca lavoratori/dettaglio lavoratore: `41`, `42`
- Invito diretto/proposta tariffa: `43`, `44` *(interazioni manuali)*
- Turni confermati/completati/annullati: `45`, `46`, `47`
- Crediti/pagamenti: `48-restaurant-billing-mobile.png`
- Recensioni: `49-restaurant-reviews-mobile.png`
- Messaggi/chat/notifiche: `50`, `51`
- Impostazioni/onboarding/help: `52`, `53`, `54`
- Privacy bloccata/sbloccata: `63`, `64`

## Screenshot non generati automaticamente e motivo

Alcuni screenshot richiedono dati dinamici o un'azione specifica:

- `/announcements/:id`, `/workers_/:id`, `/reviews/:id`: serve un ID reale presente nel database dell'utente audit.
- Popup conferma/annullamento turno, candidatura inviata, offerta ricevuta, recensione: serve aprire il dialog dal flusso reale.
- Stato privacy sbloccata: serve un match/turno confermato tra lavoratore e ristoratore.
- Stati “nessuna candidatura/nessun turno/nessuna notifica”: dipendono dal contenuto effettivo degli account audit.

## Login manuale se necessario

Se lo script non riesce a generare una schermata:

1. Apri l'app nel browser.
2. Supera il private beta gate con la password di test.
3. Accedi con l'account lavoratore o ristoratore audit.
4. Vai alla route indicata nella pagina `/claude-visual-audit`.
5. Imposta viewport **412×900** per mobile oppure **1280×1800** per desktop.
6. Cattura lo screenshot e salvalo in `public/audit-screenshots/` con il nome file indicato nel blocco audit.
7. Ricarica `/claude-visual-audit` e verifica che l'immagine sia leggibile.

## Controllo qualità

Prima di esportare, verifica che nessuno screenshot destinato a route protette mostri:

- “Accesso riservato”;
- “Pupillo è attualmente in fase di test privato”;
- login al posto della schermata autenticata;
- pagina vuota;
- “Caricamento…” permanente;
- “sessione non disponibile”.

Se compare uno di questi stati, elimina lo screenshot e rigeneralo con credenziali corrette.

## Esportare `/claude-visual-audit` in PDF

1. Apri `/claude-visual-audit`.
2. Scorri la pagina per caricare tutte le immagini.
3. Cmd/Ctrl + P → **Salva come PDF**.
4. Attiva **Grafica di sfondo**.
5. Formato consigliato: A4, margini default.
6. Salva come `Pupillo-Visual-Audit.pdf`.

## Cosa caricare su Claude

- `Pupillo-Visual-Audit.pdf` esportato da `/claude-visual-audit`.
- La cartella `public/audit-screenshots/` se Claude accetta file multipli.
- `PUPILLO_VISUAL_AUDIT_EXPORT_GUIDE.md`.
- Opzionale: `PUPILLO_CLAUDE_AUDIT_PACK.md` per contesto funzionale.