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
- Link Academy: https://accademy.pupillo.life/ (confermato dal titolare in navigazione anonima), definito solo in src/lib/academy.ts. Tutti i pulsanti aprono il sito in una nuova scheda (noopener noreferrer, avviso per lettori di schermo). /academy resta pagina informativa con «Vai alle lezioni».
- Dashboard lavoratore: un solo blocco (AcademyWorkerSlot) sotto disponibilità, che mostra l'invito una tantum oppure la scheda compatta, mai entrambi. Solo per lavoratori con profilo completato.
- Invito: segnale salvato nel browser per singolo utente (chiave con userId), impostato solo dopo il salvataggio riuscito del primo completamento; i rami di errore escono prima. «Scopri» e «Più tardi» chiudono subito l'invito e non ricompare. Il vecchio segnale globale non viene letto.
- File: src/lib/academy.ts, src/components/academy/*, src/routes/academy.tsx, index.tsx, dashboard.tsx, onboarding.tsx (una riga). Nessuna modifica a database, prezzi, crediti, reputazione, CV, foto o autenticazione.
- Verifiche e limiti: vedi resoconto nel messaggio di consegna; la parte con accesso è verificata con test automatici sulla logica, non con un account reale.
