# Contesto marketing Pupillo

## Modello commerciale (verificato in src/lib/pricing.ts e migrazione 0027)
- Lavoratori: Pupillo sempre gratuito.
- Ristoratori: pacchetto unico 29,70 € = 7 crediti per una conferma. Si paga solo alla prima conferma di un nuovo lavoratore; richiamare la stessa persona non costa nulla.
- Pupillo mette in contatto le parti: non è un'agenzia per il lavoro e non è parte del contratto.

## Pupillo Academy — fase di comunicazione approvata (23/11/2026, Federico Sica)
- Progetto separato, oggi in anteprima: due moduli in bozza (sala), quiz con soglia 8/10, scudetto Squadra di Sala e gagliardetto, attestato di riconoscimento PDF per modulo superato.
- Gratuita (scelta commerciale) e facoltativa. Oggi l'accesso è aperto: non dirla "riservata".
- L'attestato non è certificato e non è una qualifica professionale. Il quiz non abilita a nuove mansioni.
- Progressi solo nel browser: nessun risultato, conteggio, bollino, filtro o ranking nel marketplace.
- Ristoratori: solo un blocco secondario in fondo alla homepage. Niente in dashboard, ricerca o scheda candidato.
- Futuro (NON approvato): stesso account Pupillo, risultati salvati dal server, condivisione scelta dal lavoratore spenta di default e revocabile, sezione "Formazione" separata da stelle/recensioni.

### Testi approvati
- Homepage lavoratori: «Pupillo Academy · Gratuita e facoltativa» / «Impara, ripassa, mettiti alla prova.» / CTA «Scopri l’Academy gratuita».
- Fine iscrizione lavoratore: «Il tuo profilo è pronto.» + CTA «Scopri l’Academy» e «Più tardi».
- Dashboard lavoratore: scheda compatta con CTA «Scopri l’Academy».
- Ristoratori: «Un percorso gratuito sulle basi della sala.» / «Scopri i contenuti dell’Academy».

## Resoconto implementazione (23/11/2026)
- File: src/lib/academy.ts (link centralizzato e invito una tantum), src/components/academy/*, src/routes/academy.tsx (pagina informativa locale), src/routes/index.tsx, src/routes/dashboard.tsx, src/routes/onboarding.tsx (solo segnale di primo completamento, nessun cambio a salvataggio o reindirizzamenti).
- Link esterno Academy: non impostato. L'anteprima del progetto Academy ha risposto 401 a una verifica anonima; finché non c'è un indirizzo pubblico verificato, i pulsanti aprono /academy. Da completare: impostare ACADEMY_EXTERNAL_URL.
- Nessuna modifica a database, prezzi, crediti, reputazione, CV, foto o autenticazione.
