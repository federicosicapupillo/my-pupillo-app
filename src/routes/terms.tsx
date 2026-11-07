import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => legalHead("/terms", "Condizioni generali d'uso — Pupillo", "Condizioni generali d'uso della piattaforma Pupillo, gestita da AD MAIORA S.R.L."),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Condizioni generali d'uso">
      <section>
        <h2>1. Gestore, natura e finalità della piattaforma</h2>
        <p>Pupillo (pupillo.life) è gestita da {COMPANY.name}, P.IVA e C.F. {COMPANY.vat}, sede legale {COMPANY.address}, REA {COMPANY.rea}, {COMPANY.register}, PEC {COMPANY.pec} («Pupillo» o «Gestore»).</p>
        <p>Pupillo è una piattaforma digitale che consente a ristoranti, bar e altri locali del settore Ho.Re.Ca. («Ristoratori») di pubblicare annunci per turni e collaborazioni e a persone interessate («Lavoratori») di candidarsi. Pupillo non è parte dei rapporti tra Ristoratori e Lavoratori, non è datore di lavoro e non agisce come agenzia per il lavoro o somministratore. La scelta di collaborare, la forma contrattuale e i relativi adempimenti restano a carico delle parti.</p>
      </section>
      <section>
        <h2>2. Registrazione e requisiti</h2>
        <p>L'uso della piattaforma richiede la registrazione con dati veritieri, completi e aggiornati. Possono registrarsi solo persone maggiorenni. Chi registra un locale dichiara di avere titolo per agire per conto dell'attività. Le credenziali sono personali e vanno custodite con cura; l'utente risponde dell'uso del proprio account e segnala tempestivamente accessi non autorizzati.</p>
      </section>
      <section>
        <h2>3. Obblighi dei Ristoratori</h2>
        <ul>
          <li>Pubblicare annunci chiari e veritieri su mansione, luogo, data, orari e compenso, indicando in modo comprensibile se l'importo è lordo o netto.</li>
          <li>Instaurare e gestire i rapporti di lavoro o collaborazione nel rispetto della normativa vigente, inclusi contratti, comunicazioni obbligatorie, adempimenti contributivi, fiscali e assicurativi.</li>
          <li>Garantire condizioni di salute e sicurezza nel luogo di lavoro e trattare i Lavoratori con correttezza e senza discriminazioni.</li>
        </ul>
        <p>La conferma di una candidatura su Pupillo non sostituisce in alcun modo la stipula del contratto né gli adempimenti richiesti dalla legge.</p>
      </section>
      <section>
        <h2>4. Obblighi dei Lavoratori</h2>
        <p>I Lavoratori forniscono informazioni veritiere su identità, esperienze, competenze, disponibilità e documenti; non caricano curriculum o documenti altrui o alterati; si presentano ai turni confermati con puntualità o avvisano tempestivamente in caso di impedimento.</p>
      </section>
      <section>
        <h2>5. Candidature, controfferte e conferme</h2>
        <p>Il Lavoratore può candidarsi a un annuncio e, quando la funzione è disponibile, proporre una controfferta. Il Ristoratore può accettare o rifiutare. Un turno risulta confermato in piattaforma solo quando entrambe le parti l'hanno accettato secondo le schermate dedicate. Annunci e offerte possono scadere automaticamente al termine indicato.</p>
      </section>
      <section>
        <h2>6. Cancellazioni, mancate presentazioni, contestazioni e forza maggiore</h2>
        <p>Le parti possono annullare un turno con le modalità e nei tempi indicati in piattaforma. Le mancate presentazioni e le cancellazioni tardive possono essere registrate e incidere sulla reputazione e, nei casi ripetuti, comportare limitazioni dell'account ai sensi dell'art. 11. L'interessato può contestare la registrazione fornendo le proprie ragioni; le situazioni di forza maggiore o impedimento documentato sono valutate caso per caso.</p>
      </section>
      <section>
        <h2>7. Compensi e prezzi del servizio</h2>
        <p>Il compenso per il lavoro è concordato e corrisposto direttamente tra Ristoratore e Lavoratore; Pupillo non incassa né gestisce tali somme. Per i Lavoratori Pupillo è gratuito. Per i Ristoratori, durante la fase di lancio, l'uso della piattaforma è gratuito fino al 31 dicembre 2026. Eventuali servizi a pagamento futuri saranno comunicati in anticipo con prezzi e condizioni, e non saranno addebitati senza accettazione espressa.</p>
      </section>
      <section>
        <h2>8. Recensioni e reputazione</h2>
        <p>Dopo un turno le parti possono lasciarsi recensioni, che devono riguardare l'esperienza effettiva ed essere rispettose. Il punteggio di reputazione è calcolato in modo automatico su turni completati, valutazioni ricevute, affidabilità e completezza del profilo, come spiegato nella piattaforma. Chi ritiene una recensione falsa, offensiva o scorretta può segnalarla e chiederne la revisione; Pupillo può nasconderla se viola queste Condizioni o il <Link to="/regolamento">Regolamento della community</Link>.</p>
      </section>
      <section>
        <h2>9. Curriculum e valutazioni con intelligenza artificiale</h2>
        <p>Il Lavoratore può caricare facoltativamente un curriculum e, con il proprio consenso, chiederne la valutazione automatica tramite un sistema di intelligenza artificiale secondo criteri pubblicati (esperienza, competenze, responsabilità, formazione, completezza). La valutazione è indicativa: riguarda solo quanto dichiarato nel documento, non verifica le esperienze e non è una recensione di prestazioni lavorative. Non sono considerati età, genere, origine, foto o altri dati estranei alle competenze. Le valutazioni pari ad almeno 4 stelle su 5 sono mostrate ai Ristoratori solo se il Lavoratore vi ha acconsentito; il Lavoratore può caricare un nuovo curriculum per ottenere una nuova valutazione e può chiedere chiarimenti o una revisione da parte di una persona scrivendo alla PEC indicata.</p>
      </section>
      <section>
        <h2>10. Condotte vietate</h2>
        <ul>
          <li>Fornire dati falsi, creare account multipli o impersonare altri.</li>
          <li>Pubblicare annunci ingannevoli, illeciti o discriminatori, o proporre lavoro irregolare.</li>
          <li>Molestie, offese, minacce o contenuti illeciti nei messaggi, nelle recensioni o nei profili.</li>
          <li>Usare i dati di altri utenti per finalità estranee alla piattaforma, raccoglierli in modo automatizzato o aggirare le misure di sicurezza.</li>
        </ul>
      </section>
      <section>
        <h2>11. Moderazione, sospensione e ricorsi</h2>
        <p>Pupillo può nascondere contenuti, limitare funzioni o sospendere account in caso di violazioni, segnalazioni fondate o rischi per altri utenti, in modo proporzionato e motivando la decisione. L'utente può presentare reclamo o chiedere il riesame scrivendo alla PEC {COMPANY.pec}. L'utente può cancellare il proprio account in qualsiasi momento dalla pagina Profilo.</p>
      </section>
      <section>
        <h2>12. Responsabilità</h2>
        <p>Pupillo si impegna a mantenere la piattaforma funzionante e sicura, ma non garantisce l'assenza di interruzioni o errori. Pupillo non risponde di accordi, prestazioni, pagamenti o condotte intercorsi tra Ristoratori e Lavoratori, né della veridicità delle informazioni inserite dagli utenti, salvo i casi di dolo o colpa grave e comunque nei limiti consentiti dalla legge. Restano salvi i diritti inderogabili riconosciuti ai consumatori.</p>
      </section>
      <section>
        <h2>13. Modifiche, contatti, legge applicabile e foro</h2>
        <p>Le presenti Condizioni possono essere aggiornate; le modifiche sostanziali saranno comunicate in piattaforma e, ove necessario, sarà richiesta una nuova accettazione. Per comunicazioni: PEC {COMPANY.pec}. Le Condizioni sono regolate dalla legge italiana. Per le controversie con consumatori è competente il foro del luogo di residenza o domicilio del consumatore; negli altri casi, il foro di Torino, salvo diversa norma inderogabile.</p>
        <p>Il trattamento dei dati personali è descritto nell'<Link to="/privacy">Informativa privacy</Link> e nella <Link to="/cookie">Cookie policy</Link>.</p>
      </section>
    </LegalPage>
  );
}
