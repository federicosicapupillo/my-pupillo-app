import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/cookie")({
  head: () => legalHead("/cookie", "Cookie policy — Pupillo", "Cookie e tecnologie simili utilizzati da Pupillo."),
  component: CookiePolicy,
});

function CookiePolicy() {
  return (
    <LegalPage title="Cookie policy">
      <section>
        <h2>1. In sintesi</h2>
        <p>Pupillo, gestita da {COMPANY.name}, usa solo strumenti tecnici necessari al funzionamento del servizio. Non usiamo cookie di profilazione, pubblicità o statistica di terze parti; per questo non viene mostrato un banner di consenso.</p>
      </section>
      <section>
        <h2>2. Strumenti tecnici utilizzati</h2>
        <ul>
          <li><strong>Sessione di accesso</strong> (archiviazione locale del browser): mantiene l'utente collegato al proprio account fino all'uscita.</li>
          <li><strong>Codice invito</strong> (archiviazione locale): conserva temporaneamente il codice di «Presenta un amico» fino al completamento della registrazione.</li>
          <li><strong>Preferenze di interfaccia</strong> (archiviazione locale): ricordano, ad esempio, avvisi già chiusi o annunci già visti.</li>
        </ul>
        <p>Questi dati restano nel browser e possono essere cancellati dalle impostazioni del browser; in tal caso potrebbe essere necessario accedere di nuovo.</p>
      </section>
      <section>
        <h2>3. Contenuti di terze parti</h2>
        <p>Le mappe caricano immagini da OpenStreetMap e CARTO; per mostrarle, questi servizi ricevono l'indirizzo IP del dispositivo, come avviene per qualsiasi risorsa web. Pupillo non vi installa cookie propri.</p>
      </section>
      <section>
        <h2>4. Modifiche e contatti</h2>
        <p>Se in futuro introdurremo strumenti non necessari, chiederemo prima il consenso. Per domande: PEC {COMPANY.pec}. Vedi anche l'<Link to="/privacy">Informativa privacy</Link>.</p>
      </section>
    </LegalPage>
  );
}
