import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { AcademyLabel, academyCardStyle } from "@/components/academy/AcademyLink";
import { ACADEMY_CERT_NOTE, ACADEMY_PREVIEW_NOTE, ACADEMY_WORKER_TEXT } from "@/components/academy/AcademyBlocks";
import { ACADEMY_ENTRY_URL, ACADEMY_EXTERNAL_URL } from "@/lib/academy";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "Pupillo Academy — Gratuita e facoltativa" },
      { name: "description", content: "Pupillo Academy: lezioni e quiz sulle basi del servizio di sala. Gratuita, facoltativa, oggi in anteprima con due moduli." },
      { property: "og:title", content: "Pupillo Academy — Impara, ripassa, mettiti alla prova" },
      { property: "og:description", content: "Lezioni e quiz sulle basi del servizio di sala. Gratuita e facoltativa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcademyPage,
});

function AcademyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <Link to="/" className="text-sm font-semibold text-accent underline underline-offset-4">← Torna a Pupillo</Link>
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-6 md:p-8" style={academyCardStyle}>
          <AcademyLabel />
          <h1 className="text-3xl font-black">Impara, ripassa, mettiti alla prova.</h1>
          <p className="text-muted-foreground">{ACADEMY_WORKER_TEXT}</p>
          <p className="text-sm font-semibold">{ACADEMY_PREVIEW_NOTE}</p>
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-bold">Cosa trovi oggi</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Due moduli in bozza sulle basi del servizio di sala, disponibili in anteprima.</li>
            <li>Lezioni da leggere e quiz: il modulo è superato con almeno 8 risposte corrette su 10.</li>
            <li>Distintivi del percorso: lo scudetto Squadra di Sala e il gagliardetto.</li>
            <li>Per ogni modulo superato, un attestato di riconoscimento in PDF da scaricare.</li>
          </ul>
          <p className="text-sm text-muted-foreground">{ACADEMY_CERT_NOTE}</p>
          <p className="text-sm text-muted-foreground">I progressi restano nel browser utilizzato e non sono collegati al profilo Pupillo. Nessun risultato dell’Academy compare sul profilo visto dai ristoratori.</p>
          <p className="text-sm text-muted-foreground">L’Academy è facoltativa: puoi ricevere proposte su Pupillo anche senza seguirla.</p>
        </section>
        {ACADEMY_EXTERNAL_URL && (
          <a href={ACADEMY_ENTRY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground">
            Vai alle lezioni<span className="sr-only"> (si apre in una nuova scheda)</span>
          </a>
        )}
      </main>
      <LegalFooter />
    </div>
  );
}
