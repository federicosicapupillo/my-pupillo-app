# Pupillo Academy — parere lato marketplace (solo brainstorming, nessuna modifica)

## Fatti verificati in questo turno
- Nessuna cartella `.workspace/skills`, `.agents/skills`, `.claude/skills` né skill attive del workspace. `docs/MARKETING_CONTEXT.md` non esiste (in `docs/` ci sono solo documenti tecnici). Nessun documento in Files `marketing/`.
- Unica guida di comunicazione letta: la skill di sistema "marketing-memory" (regole su dove salvare i documenti di marketing). Non contiene contenuti di copy: non la applico al testo. Nessuna persona contattata.
- Nel codice del marketplace oggi non compare la parola "Academy": nessun collegamento esiste.
- `src/lib/pricing.ts`: pacchetto unico "1 lavoratore confermato a 29,70 €" e testo "Paghi una sola volta per lavoratore: poi puoi richiamare la stessa persona in modo illimitato, senza costi aggiuntivi."
- Regola di progetto registrata (migrazione 0027): i 7 crediti si scalano solo alla prima conferma della coppia ristorante–lavoratore; i richiami successivi hanno costo zero. Il modello "nuovo contatto pagato una volta, stesso lavoratore senza nuovo costo" è confermato. Non va cambiato.
- Memoria di progetto: Pupillo solo mette in contatto, non è agenzia; nessuna promessa di gratuità a tempo (vale per i ristoratori, non contraddice un'Academy sempre gratuita).

## A) Cosa confermo e cosa cambio
Confermo: niente Academy dentro l'iscrizione; visibilità dopo; tono "facoltativa/consigliata"; pubblicazione solo per scelta del lavoratore.
Cambio, accogliendo le critiche:
- Tolgo "fatti notare": oggi non c'è nessuna visibilità collegata.
- Tolgo "2 corsi su 5" e il bollino accanto alle stelle: i progressi restano nel browser e non sono collegati a una persona.
- Tolgo il filtro "ha completato l'Academy".
- "Completa" va bene dentro l'Academy; nel marketplace evito solo frasi che la legano al ricevere lavoro.
- "Gratuita per chi è iscritto": oggi l'accesso è libero. Uso "gratuita" senza condizione, oppure "gratuita per i lavoratori Pupillo" (vero, perché anche loro accedono gratis), senza dire che serve l'iscrizione.

## B) Dove metterla
Oggi (solo descrizione + link esterno):
1. Dashboard lavoratore: un riquadro viola, il punto principale, chiudibile.
2. Homepage, sezione lavoratori: una riga sotto i vantaggi, non nella parte alta.
3. Fine iscrizione lavoratore: messaggio dopo "Profilo completato", con "Più tardi" in evidenza e "Scopri" secondario.
4. Profilo lavoratore: niente per ora.
5. Lato ristoratori: niente per ora (non c'è nulla da mostrare).
Futuro (solo dopo il collegamento degli account):
- Profilo: sezione "Formazione Pupillo Academy" con interruttore "Mostra ai ristoratori", spento all'inizio.
- Scheda lavoratore: sezione separata "Formazione", lontana da stelle e recensioni, con dicitura "Non è una qualifica ufficiale".
- Homepage ristoratori: frase sulla formazione pubblicata dal lavoratore.
- Filtro: da valutare più avanti, e solo se non penalizza gli esperti.

## C) Testi per oggi
Lavoratori (dashboard/homepage):
"Pupillo Academy è gratuita e facoltativa. Lezioni brevi e quiz sul lavoro di sala, da fare quando vuoi. Per ogni modulo superato puoi scaricare un attestato di riconoscimento. Non è richiesta per ricevere proposte su Pupillo."
Nota piccola: "L'attestato non è una qualifica ufficiale né una certificazione."
Fine iscrizione: "Profilo completato. Se ti va, dai un'occhiata alla Pupillo Academy: è gratuita e non serve per trovare turni."
Ristoratori: per ora nessun testo. In futuro: "Alcuni lavoratori scelgono di mostrare la formazione fatta con la Pupillo Academy. È un'informazione in più, non sostituisce esperienza e recensioni."
Pulsanti: "Scopri l'Academy" (apre il sito Academy in una nuova scheda) e "Più tardi".

## D) Tre rischi e come evitarli
1. Sembra obbligatoria → frase esplicita "non è richiesta per ricevere proposte", pulsante "Più tardi" in evidenza, niente nell'iscrizione.
2. Si promette più del vero (visibilità, mansioni nuove, valore dell'attestato) → nessun "fatti notare" e nessun "diventi cameriere"; "più mansioni" detto come "conosci anche altri ruoli"; nota "non è una qualifica".
3. Confusione con reputazione e prezzo → mai accanto alle stelle o al Reputation Score; nessun legame col pacchetto da 29,70 €; Academy sempre "gratuita" senza date.

## E) Skill
Vedi fatti: nessuna skill di marketing o comunicazione nel progetto. Ho applicato solo le regole di progetto già salvate (ruolo di Pupillo, lancio a pagamento, pacchetto unico, viola nei punti chiave).

## F) Modello prezzo
Confermato sia nei testi (pricing.ts) sia nella regola dei crediti: si paga solo al primo contatto confermato, il richiamo dello stesso lavoratore è gratuito. MARKETING_CONTEXT.md non esiste, quindi non può confermarlo.

## Se approvato in futuro (non ora)
Riquadro dashboard + riga homepage + messaggio di fine iscrizione con link esterno; nessuna modifica a database, prezzi o schede ristoratore.
