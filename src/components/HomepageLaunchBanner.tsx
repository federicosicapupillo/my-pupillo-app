import { MapPin, Gift, Rocket } from "lucide-react";

/**
 * Banner informativo in homepage per la fase di lancio di Pupillo.
 *
 * Comunica in modo chiaro ed evidente:
 * - Disponibilità territoriale: solo Bologna e provincia.
 * - Gratuità del servizio fino al 31 dicembre 2026.
 *
 * Posizionato sotto la Hero principale e prima della sezione "Come funziona".
 * Design moderno, pulito e coerente con il resto della piattaforma.
 */
export function HomepageLaunchBanner() {
  return (
    <section className="relative z-10 -mt-2 px-4 pb-8 pt-2 sm:-mt-4 sm:pb-10 sm:pt-4 md:-mt-6 md:pb-12 md:pt-6">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-primary/25 bg-card/70 backdrop-blur-sm shadow-lg">
          {/* Striscia luminosa in alto */}
          <div
            aria-hidden
            className="h-1 w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--neon-lime), var(--neon-cyan), var(--neon-magenta), var(--neon-violet))",
            }}
          />

          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 md:p-8">
            {/* Blocco sinistro: disponibilità */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-extrabold leading-tight text-foreground sm:text-xl">
                  Pupillo è già attivo a Bologna
                  <Rocket className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Trova lavoratori o nuovi turni in tutta la{" "}
                  <span className="font-semibold text-foreground">
                    Città metropolitana di Bologna
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Blocco destro: gratuità — più in evidenza */}
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Al momento
                </div>
                <div className="text-base font-extrabold text-primary sm:text-lg">
                  Gratuito fino al 31/12/2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
