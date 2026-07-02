# Pupillo — Visual Audit Index

Indice del pacchetto visivo generato per l'analisi UX/UI con Claude.

---

## Come usare questo pacchetto

1. Apri nell'app la pagina **`/claude-visual-audit`** (nessun login richiesto per la visualizzazione).
2. Da browser: **Cmd/Ctrl + P → Salva come PDF** (formato A4, margini "Predefiniti", grafica di sfondo **ATTIVA**).
3. Carica su Claude i file:
   - il PDF esportato (screenshot ordinati di tutte le schermate);
   - `PUPILLO_VISUAL_AUDIT_INDEX.md` (questo file);
   - `PUPILLO_CLAUDE_AUDIT_PACK.md` (documento testuale di riferimento).
4. Chiedi a Claude un'analisi UX/UI, grafica, navigabilità, mobile experience, conversione e fiducia percepita.

---

## Schermate incluse

### Pubbliche
- Homepage · Come funziona · Login · Registrazione · Recupero password · Errore login · Accesso negato

### Lavoratore
- Dashboard (con dati / vuota)
- Profilo · Modifica profilo
- Disponibilità settimanale · Disponibilità speciali
- Ricerca offerte · Dettaglio offerta · Candidatura inviata
- Offerte ricevute · Accettate · Rifiutate
- Turni confermati · Completati · Annullati
- Recensioni ricevute · Recensione da lasciare
- Chat · Notifiche
- Impostazioni account · Cambio password
- Onboarding · Help/Supporto

### Ristoratore
- Dashboard · Profilo locale · Modifica profilo
- Pubblicazione annuncio (wizard) · Elenco annunci
- Candidature ricevute · Dettaglio candidatura
- Ricerca lavoratori · Dettaglio lavoratore · Invito con tariffa
- Turni confermati · Completati · Annullati
- Crediti e piani
- Recensioni · Chat · Notifiche
- Impostazioni · Onboarding · Help

### Desktop (versioni chiave)
- Homepage · Dashboard lavoratore · Dashboard ristoratore
- Ricerca offerte · Ricerca lavoratori · Chat
- Profilo lavoratore · Profilo locale · Dettaglio turno

---

## Popup, modali e componenti inclusi

- Popup guida iniziale (`GuidedTour`)
- Popup conferma turno
- Popup annullamento turno
- Popup candidatura inviata
- Popup offerta ricevuta
- Popup errore
- Popup successo
- Popup recensione (blind reciprocal)
- Popup crediti insufficienti
- Toast di notifica
- Alert / banner persistenti (rosso, ambra, blu)
- Badge, label, bottoni (primario / secondario / distruttivo)
- Card turno · lavoratore · ristorante · recensione · disponibilità
- Menu mobile a scomparsa
- Sidebar desktop

---

## Stati critici inclusi

- Empty state dashboard
- Dashboard con dati
- Empty state candidature
- Empty state disponibilità
- Loading (skeleton)
- Errore
- Successo
- Privacy bloccata
- Privacy sbloccata
- Turno confermato / completato / annullato
- Recensione da lasciare / lasciata
- Con notifiche / senza notifiche

---

## Note per Federico

- Le schermate contengono **dati fittizi realistici** (Marco Rossi, Osteria Milano Centro, turno 24/12/2026 19:00–23:00, tariffa 12 €/ora, totale 48 €). Nessun dato reale è stato utilizzato.
- La pagina è pensata per una lettura ordinata top-down: introduzione → flussi → schermate pubbliche → lavoratore → ristoratore → stati → popup → desktop.
- Ogni schermata è accompagnata da una scheda con: nome, ruolo, route, obiettivo, azioni principali, stato rappresentato, criticità visive e domande per Claude.
- CSS print-friendly già configurato: sfondo bianco, page-break tra sezioni, card non tagliate a metà.
- Nessuna logica dell'app è stata modificata: `/claude-visual-audit` è solo documentazione visiva.

---

## Cosa chiedere a Claude

Suggerimento di prompt:

> Analizza il PDF allegato del Visual Audit Pack di Pupillo (app marketplace Ho.Re.Ca. per lavoratori e ristoratori). Valuta professionalità grafica, coerenza visiva, gerarchia CTA, chiarezza dei flussi, mobile experience, empty states, popup, stati privacy e conversione. Segnala schermate da rifare prima del lancio, quelle già accettabili e le priorità di intervento.
