import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/regolamento")({
  head: () => legalHead("/regolamento", "Regolamento della community — Pupillo", "Regole di comportamento per ristoratori e lavoratori su Pupillo: annunci, turni, messaggi e recensioni."),
  component: Regolamento,
});

function Regolamento() {
  return (
    <LegalPage title="Regolamento della community">
      <section>
        <h2>Rispetto reciproco</h2>
        <p>Comunicazioni cortesi e professionali. Non sono tollerati insulti, molestie, minacce o discriminazioni per genere, origine, religione, disabilità, orientamento o età.</p>
      </section>
      <section>
        <h2>Annunci e candidature onesti</h2>
        <ul>
          <li>Annunci con mansione, orari e compenso reali, indicando se lordo o netto.</li>
          <li>Profili e curriculum veritieri, senza esperienze inventate.</li>
          <li>Nessuna proposta di lavoro irregolare.</li>
        </ul>
      </section>
      <section>
        <h2>Puntualità e impegni</h2>
        <p>Un turno confermato è un impegno: presentati in orario o avvisa il prima possibile. Mancate presentazioni e cancellazioni tardive vengono registrate e incidono sulla reputazione; puoi contestarle spiegando le tue ragioni.</p>
      </section>
      <section>
        <h2>Recensioni corrette</h2>
        <p>Recensisci solo turni svolti, in modo sincero e senza offese o dati personali. Non sono ammesse recensioni in cambio di favori o per ritorsione. Puoi segnalare una recensione scorretta e chiederne la revisione.</p>
      </section>
      <section>
        <h2>Dati degli altri</h2>
        <p>Usa i contatti ottenuti su Pupillo solo per organizzare il lavoro. Non condividerli né usarli per altri scopi.</p>
      </section>
      <section>
        <h2>Violazioni</h2>
        <p>Le violazioni possono portare a contenuti nascosti, limitazioni o sospensione dell'account, come previsto dalle <Link to="/terms">Condizioni d'uso</Link>. Per segnalazioni o ricorsi: PEC {COMPANY.pec}.</p>
      </section>
    </LegalPage>
  );
}
