import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => legalHead("/privacy", "Informativa privacy — Pupillo", "Informativa sul trattamento dei dati personali degli utenti Pupillo ai sensi del GDPR."),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Informativa privacy">
      <p>Informativa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 («GDPR») per gli utenti della piattaforma Pupillo.</p>
      <section>
        <h2>1. Titolare del trattamento</h2>
        <p>{COMPANY.name}, con sede in {COMPANY.address}, P.IVA/C.F. {COMPANY.vat}, REA {COMPANY.rea}, PEC {COMPANY.pec}. Non è stato designato un responsabile della protezione dei dati (DPO).</p>
      </section>
      <section>
        <h2>2. Dati trattati</h2>
        <ul>
          <li>Dati anagrafici e di account: nome, cognome, email, ruolo, password (conservata in forma cifrata); per i Lavoratori data e luogo di nascita, nazionalità e residenza richiesti nel profilo; per i Ristoratori l'età dichiarata del referente.</li>
          <li>Contatti: numero di telefono e relativo codice di verifica.</li>
          <li>Dati del locale: ragione sociale, partita IVA, indirizzo, referente.</li>
          <li>Dati professionali: mansioni, esperienze, lingue, disponibilità, curriculum facoltativo e relativa valutazione.</li>
          <li>Foto profilo.</li>
          <li>Annunci, candidature, controfferte, turni, presenze, ritardi e mancate presentazioni.</li>
          <li>Messaggi scambiati in piattaforma, recensioni, punteggi di reputazione e segnalazioni.</li>
          <li>Dati di posizione: indirizzo del locale e zona di lavoro; la posizione attuale del dispositivo solo se l'utente usa la funzione «usa la mia posizione». Agli altri utenti le posizioni sono mostrate in forma approssimata.</li>
          <li>Dati tecnici: indirizzo IP, dati del browser e registri di sicurezza e accesso.</li>
        </ul>
        <p><strong>Documenti d'identità.</strong> Pupillo non richiede né raccoglie più documenti d'identità: il caricamento è stato disattivato. Per un numero limitato di profili di Lavoratori registrati in precedenza restano conservati, in archivio privato non visibile agli altri utenti, i dati e le immagini del documento caricati a suo tempo. Questi dati non vengono usati per nuove finalità; per i profili storici la loro presenza è uno degli elementi di completezza del profilo considerati nel punteggio di reputazione (§4). Sono cancellati con la cancellazione dell'account e l'interessato può chiederne la cancellazione anticipata scrivendo alla PEC.</p>
      </section>
      <section>
        <h2>3. Finalità e basi giuridiche</h2>
        <ul>
          <li>Registrazione, gestione dell'account e funzioni della piattaforma (annunci, candidature, messaggi, turni, recensioni, punteggio di reputazione): esecuzione del contratto (art. 6, par. 1, lett. b), GDPR).</li>
          <li>Verifica del telefono, sicurezza, prevenzione di abusi e frodi, moderazione: legittimo interesse (art. 6, par. 1, lett. f), GDPR) e, ove applicabile, esecuzione del contratto (art. 6, par. 1, lett. b), GDPR).</li>
          <li>Valutazione automatica del curriculum: consenso dell'interessato (art. 6, par. 1, lett. a), GDPR), prestato con una casella dedicata a ogni caricamento. Pubblicazione sul profilo del risultato in stelle (non del curriculum): consenso dell'interessato (art. 6, par. 1, lett. a), GDPR), prestato nella stessa occasione e revocabile separatamente nascondendo la valutazione. I dettagli sono al §5.</li>
          <li>Adempimento di obblighi di legge: art. 6, par. 1, lett. c), GDPR; accertamento, esercizio o difesa di diritti in giudizio: art. 6, par. 1, lett. f), GDPR.</li>
        </ul>
        <p>Non utilizziamo i dati per finalità di marketing né li vendiamo a terzi.</p>
      </section>
      <section>
        <h2>4. Visibilità dei profili e punteggio di reputazione</h2>
        <p>I Ristoratori registrati possono vedere dei Lavoratori: nome, foto, mansioni, esperienze, lingue, disponibilità, zona approssimata, recensioni, punteggio di reputazione e la valutazione del curriculum solo se pubblicabile e con consenso. I Lavoratori vedono dei Ristoratori i dati del locale e degli annunci. Documenti d'identità, curriculum originale e posizione precisa non sono mostrati agli altri utenti; i recapiti diretti possono essere resi disponibili tra le parti solo nell'ambito di un turno, ove previsto dalle funzioni della piattaforma.</p>
        <p>Il punteggio di reputazione è il risultato di un trattamento di profilazione (art. 4, par. 4, GDPR), calcolato automaticamente su una scala 0-100 a partire da: turni completati, mancate presentazioni e cancellazioni; recensioni ricevute (valutazioni su puntualità, professionalità, competenza, comunicazione, lavoro di squadra e disponibilità a collaborare di nuovo); segnalazioni verificate; numero di locali con cui si è lavorato; completezza del profilo (profilo completato, telefono verificato, foto e, per i profili storici, documento caricato). Recensioni e segnalazioni provengono dai locali con i quali l'utente ha interagito. Dal punteggio e dal numero di turni deriva il livello mostrato nel profilo. La valutazione del curriculum non entra nel punteggio di reputazione. Il punteggio supporta la scelta dei Ristoratori ma non decide da solo l'assegnazione di un turno; mancate presentazioni ripetute possono comportare le limitazioni previste dalle <Link to="/terms">Condizioni d'uso</Link>.</p>
        <p>L'interessato può contestare recensioni, segnalazioni e mancate presentazioni, esprimere la propria opinione e chiedere una verifica da parte di una persona, dalla piattaforma o scrivendo alla PEC {COMPANY.pec}.</p>
      </section>
      <section>
        <h2>5. Valutazione automatica del curriculum</h2>
        <p>Se l'utente acconsente, il curriculum in PDF viene inviato, tramite il gateway AI di Lovable, a un modello di intelligenza artificiale che attribuisce punteggi secondo criteri predefiniti, riferiti alla mansione indicata: esperienza pertinente (fino a 30), competenze specifiche (fino a 30), responsabilità svolte (fino a 20), formazione pertinente (fino a 10), informazioni sufficienti (fino a 10). Al modello è chiesto di non considerare nome, foto, età, genere, origine, nazionalità, salute, residenza, periodi senza lavoro e qualità grafica o linguistica, e di non inventare competenze; le esperienze dichiarate non vengono verificate.</p>
        <p>Il risultato è un punteggio indicativo da 0 a 100. Le stelle sono calcolate dal software: 5 stelle da 85 punti, 4 stelle da 70 a 84, purché il curriculum sia valutabile, senza dubbi rilevanti e con informazioni sufficienti; sotto queste condizioni non sono assegnate stelle e il punteggio resta visibile solo all'interessato. Solo le stelle (4 o 5) sono mostrate ai Ristoratori, e solo con il consenso alla pubblicazione; il curriculum originale non è mai mostrato ai Ristoratori. La valutazione del curriculum è separata dalle recensioni e dal punteggio di reputazione.</p>
        <p>La valutazione non produce effetti giuridici e non determina da solo l'accesso alla piattaforma o a un lavoro. L'interessato può esprimere la propria opinione, contestare il risultato e chiedere una revisione da parte di una persona scrivendo alla PEC. Può revocare il consenso in ogni momento: disattivando la visibilità della valutazione la pubblicazione cessa; rimuovendo il curriculum dal profilo cessano anche la valutazione e la pubblicazione; caricando un nuovo curriculum la valutazione precedente è sostituita. La revoca non pregiudica la liceità del trattamento precedente. Non disponiamo di un'attestazione contrattuale specifica sull'esclusione dell'uso dei dati per l'addestramento dei modelli da parte dei fornitori; per informazioni scrivi alla PEC.</p>
      </section>
      <section>
        <h2>6. Destinatari e responsabili</h2>
        <p>I dati sono trattati da personale autorizzato e da fornitori che agiscono come responsabili del trattamento, tra cui: Lovable (hosting dell'applicazione, database, autenticazione, invio email e gateway AI, tramite il quale il curriculum è elaborato dal modello di intelligenza artificiale), Twilio (invio SMS di verifica), OpenStreetMap/Nominatim e CARTO (ricerca indirizzi e mappe). I dati possono essere comunicati ad autorità quando richiesto dalla legge.</p>
      </section>
      <section>
        <h2>7. Trasferimenti fuori dallo SEE</h2>
        <p>Alcuni fornitori, o i loro sub-fornitori, possono trattare dati al di fuori dello Spazio Economico Europeo. In tal caso il trasferimento avviene sulla base di una decisione di adeguatezza (art. 45 GDPR) o di garanzie adeguate quali le clausole contrattuali standard (art. 46 GDPR). Su richiesta alla PEC è possibile ottenere informazioni sui trasferimenti e sulle garanzie adottate.</p>
      </section>
      <section>
        <h2>8. Conservazione</h2>
        <p>I dati dell'account sono conservati finché l'account è attivo. Alla cancellazione dell'account i dati sono cancellati o resi anonimi, salvo quelli da conservare per obblighi di legge, sicurezza o difesa in giudizio, per il tempo strettamente necessario.</p>
        <p>Il file del curriculum è eliminato dopo l'analisi: quando la valutazione automatica si conclude e il risultato è salvato, il PDF viene cancellato dall'archivio (in caso di errore temporaneo la cancellazione è ritentata automaticamente). Restano il nome del file, il punteggio, le brevi motivazioni per criterio e lo stato di pubblicazione, finché l'interessato non rimuove il curriculum, ne carica uno nuovo o cancella l'account. Se l'analisi non va a buon fine, il file resta in archivio privato per consentire un nuovo tentativo, fino a rimozione o sostituzione. I curriculum analizzati prima del 10 novembre 2026 restano conservati in archivio privato fino a rimozione, sostituzione o cancellazione dell'account.</p>
      </section>
      <section>
        <h2>9. Età minima</h2>
        <p>Il servizio è riservato a persone maggiorenni (18 anni compiuti). In registrazione l'utente dichiara di avere almeno 18 anni; per i Lavoratori la data di nascita indicata nel profilo è verificata dal sistema e i Ristoratori indicano l'età del referente. Non raccogliamo consapevolmente dati di minorenni: se veniamo a sapere che un account appartiene a un minore, lo sospendiamo e ne cancelliamo i dati, salvo quelli da conservare per obblighi di legge.</p>
      </section>
      <section>
        <h2>10. Natura del conferimento</h2>
        <p>I dati richiesti per registrazione e profilo sono necessari per usare la piattaforma; senza di essi non è possibile fornire il servizio. Curriculum e posizione del dispositivo sono facoltativi.</p>
      </section>
      <section>
        <h2>11. Diritti dell'interessato</h2>
        <p>Ai sensi degli artt. 15-22 GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti ai trattamenti basati su legittimo interesse (art. 21 GDPR); hai diritto di ottenere l'intervento umano, esprimere la tua opinione e contestare le valutazioni automatiche (art. 22 GDPR); puoi revocare il consenso in ogni momento senza pregiudicare la liceità del trattamento precedente (art. 7, par. 3, GDPR). Scrivi alla PEC {COMPANY.pec}. Puoi proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it) ai sensi dell'art. 77 GDPR.</p>
      </section>
      <section>
        <h2>12. Sicurezza</h2>
        <p>Adottiamo misure tecniche e organizzative ragionevoli ai sensi dell'art. 32 GDPR, tra cui accessi controllati per utente, archiviazione privata di curriculum e documenti storici, connessioni cifrate. Nessun sistema è esente da rischi.</p>
      </section>
      <section>
        <h2>13. Cookie e modifiche</h2>
        <p>Sull'uso di cookie e tecnologie simili vedi la <Link to="/cookie">Cookie policy</Link>. Questa informativa può essere aggiornata; la versione vigente è sempre pubblicata in questa pagina.</p>
      </section>
    </LegalPage>
  );
}
