import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Condizioni d'uso e Privacy — Pupillo" },
    { name: "description", content: "Condizioni d'uso e informativa privacy della piattaforma Pupillo." },
  ]}),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">P</div>
            <span className="text-xl font-semibold">Pupillo</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 prose prose-sm dark:prose-invert">
        <h1 className="text-3xl font-semibold tracking-tight">Condizioni d'uso e Privacy</h1>
        <p className="text-muted-foreground mt-2">Ultimo aggiornamento: maggio 2026</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">1. Oggetto del servizio</h2>
          <p className="text-sm text-muted-foreground">Pupillo è un marketplace che mette in contatto ristoratori e lavoratori extra. Pupillo non è datore di lavoro né intermediario contrattuale.</p>
        </section>
        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">2. Account</h2>
          <p className="text-sm text-muted-foreground">Per usare il servizio è necessario registrarsi indicando il proprio ruolo (ristoratore o lavoratore). I dati devono essere veritieri e aggiornati.</p>
        </section>
        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">3. Annunci e candidature</h2>
          <p className="text-sm text-muted-foreground">I ristoratori pubblicano annunci con luogo, data, tariffa e profilo richiesto. I lavoratori possono manifestare interesse, accettare o proporre una controfferta entro i tempi previsti.</p>
        </section>
        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">4. Privacy e trattamento dei dati</h2>
          <p className="text-sm text-muted-foreground">I dati personali sono trattati esclusivamente per erogare il servizio: profilo, contatti, geolocalizzazione approssimata dell'indirizzo del servizio, messaggi tra le parti. Non cediamo i dati a terzi a fini commerciali.</p>
        </section>
        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">5. Diritti dell'utente</h2>
          <p className="text-sm text-muted-foreground">Puoi accedere, rettificare o cancellare i tuoi dati in qualsiasi momento dalla pagina Profilo, oppure contattando il supporto.</p>
        </section>
        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">6. Limitazioni</h2>
          <p className="text-sm text-muted-foreground">Pupillo non è responsabile per i rapporti contrattuali o economici stipulati direttamente tra ristoratori e lavoratori.</p>
        </section>

        <div className="mt-10">
          <Link to="/" className="text-sm text-primary underline">← Torna alla home</Link>
        </div>
      </main>
    </div>
  );
}