import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { AcademyLabel, AcademyLink, academyButtonClass, academyCardStyle } from "./AcademyLink";
import { dismissAcademyInvite, isAcademyInvitePending } from "@/lib/academy";

export const ACADEMY_WORKER_TEXT =
  "Un percorso sulle basi del servizio di sala, per chi comincia e per chi vuole ripassare. Segui le lezioni e affronta i quiz. Per ogni modulo superato puoi ottenere il relativo distintivo e scaricare un attestato di riconoscimento in PDF.";
export const ACADEMY_CERT_NOTE = "L’attestato è un riconoscimento formativo non certificato e non è una qualifica professionale.";
export const ACADEMY_PREVIEW_NOTE = "Oggi sono disponibili due moduli in anteprima. L’Academy è facoltativa: non è un requisito per usare Pupillo.";

/** Homepage, solo area lavoratori. */
export function AcademyHomeWorker() {
  return (
    <section aria-labelledby="academy-worker-title" className="mt-2 flex flex-col gap-3 rounded-2xl border bg-card p-5" style={academyCardStyle}>
      <AcademyLabel />
      <h3 id="academy-worker-title" className="text-xl font-black">Impara, ripassa, mettiti alla prova.</h3>
      <p className="text-muted-foreground">{ACADEMY_WORKER_TEXT}</p>
      <p className="text-sm text-muted-foreground">{ACADEMY_CERT_NOTE}</p>
      <div><AcademyLink className={academyButtonClass}>Scopri l’Academy gratuita</AcademyLink></div>
      <p className="text-sm font-semibold text-foreground/80">{ACADEMY_PREVIEW_NOTE}</p>
    </section>
  );
}

/** Homepage, parte bassa visibile solo con «Cerco personale». */
export function AcademyRestaurantNote({ mobileHidden }: { mobileHidden: boolean }) {
  return (
    <section aria-labelledby="academy-restaurant-title" className={`mx-auto mb-12 max-w-3xl rounded-2xl border bg-card p-5 md:block ${mobileHidden ? "hidden" : "block"}`} style={academyCardStyle}>
      <p className="text-xs font-extrabold uppercase tracking-wider text-accent">Per ristoranti, bar e locali</p>
      <h2 id="academy-restaurant-title" className="mt-1 text-lg font-bold">Un percorso gratuito sulle basi della sala.</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pupillo Academy è in anteprima: lezioni e quiz sulle basi del servizio di sala, a disposizione dei lavoratori. Puoi esplorare i contenuti disponibili.</p>
      <AcademyLink className="mt-2 inline-block text-sm font-semibold text-accent underline underline-offset-4">Scopri i contenuti dell’Academy</AcademyLink>
    </section>
  );
}

/** Dashboard lavoratore: scheda compatta sotto le azioni principali. */
export function AcademyDashboardCard() {
  return (
    <section aria-label="Pupillo Academy" className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" style={academyCardStyle}>
      <div className="flex min-w-0 gap-3">
        <GraduationCap className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <AcademyLabel />
          <p className="text-sm text-foreground">Ripassa le basi della sala con lezioni e quiz. Due moduli disponibili in anteprima, da seguire al tuo ritmo.</p>
        </div>
      </div>
      <AcademyLink className={`${academyButtonClass} shrink-0 self-start sm:self-center`}>Scopri l’Academy</AcademyLink>
    </section>
  );
}

/** Invito inline mostrato una sola volta dopo il completamento reale del profilo. */
export function AcademyCompletionInvite() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(isAcademyInvitePending()); }, []);
  if (!show) return null;
  const close = () => { dismissAcademyInvite(); setShow(false); };
  return (
    <section aria-labelledby="academy-invite-title" className="rounded-2xl border bg-card p-5" style={academyCardStyle}>
      <h2 id="academy-invite-title" className="text-lg font-bold">Il tuo profilo è pronto.</h2>
      <p className="mt-1 text-sm text-foreground">Vuoi dedicare un momento alla tua formazione? Scopri Pupillo Academy: è gratuita e facoltativa.</p>
      <p className="mt-1 text-sm text-muted-foreground">Puoi ricevere proposte su Pupillo anche senza seguirla.</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <AcademyLink className={academyButtonClass} onClick={dismissAcademyInvite}>Scopri l’Academy</AcademyLink>
        <button type="button" onClick={close} className="text-sm font-semibold text-foreground underline underline-offset-4">Più tardi</button>
      </div>
    </section>
  );
}
