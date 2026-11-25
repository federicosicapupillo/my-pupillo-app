import { useEffect, useState } from "react";
import { CalendarDays, GraduationCap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AcademyLink, academyButtonClass, academyCardStyle } from "./AcademyLink";
import { dismissAcademyInvite, isAcademyInvitePending } from "@/lib/academy";

export const ACADEMY_WORKER_TEXT =
  "Un percorso sulle basi del servizio di sala, per chi comincia e per chi vuole ripassare. Segui le lezioni e affronta i quiz. Per ogni modulo superato puoi ottenere il relativo distintivo e scaricare un attestato di riconoscimento in PDF.";
export const ACADEMY_CERT_NOTE = "L’attestato è un riconoscimento formativo non certificato e non è una qualifica professionale.";
export const ACADEMY_PREVIEW_NOTE = "Oggi sono disponibili due moduli in anteprima. L’Academy è facoltativa: non è un requisito per usare Pupillo.";

/** Homepage, solo area lavoratori. */
export function AcademyHomeWorker() {
  return (
    <section aria-label="Pupillo Academy" className="pupillo-highlight mt-2 flex min-w-0 items-center gap-3 rounded-lg border p-5">
      <GraduationCap className="size-8 shrink-0 text-pack-highlight" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-lg font-bold">Registrati su Pupillo e potrai partecipare alla Pupillo Academy</p>
        <p className="mt-1 text-sm opacity-90">Completando i corsi ottieni un riconoscimento Pupillo: se scegli di mostrarlo, comparirà sul tuo profilo e sarà visibile ai ristoratori.</p>
      </div>
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

/** Scheda compatta della dashboard lavoratore. */
function AcademyDashboardCard() {
  return (
    <section aria-label="Pupillo Academy" className="pupillo-highlight flex min-w-0 flex-col gap-4 rounded-lg border p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 gap-3">
        <GraduationCap className="mt-0.5 size-9 shrink-0 text-pack-highlight" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-2xl font-black">Pupillo Academy</h2>
          <p className="font-bold text-pack-highlight">La tua formazione, gratuita e facoltativa</p>
          <p className="text-sm text-muted-foreground">Ripassa le basi della sala con lezioni e quiz. Due moduli disponibili in anteprima, da seguire al tuo ritmo.</p>
        </div>
      </div>
      <AcademyLink className={`${academyButtonClass} shrink-0 self-start bg-pack-highlight text-pack-highlight-foreground hover:bg-pack-highlight/90 lg:self-center`}>Inizia Pupillo Academy</AcademyLink>
    </section>
  );
}

function AcademyCompletionInvite({ onClose }: { onClose: () => void }) {
  return (
    <section aria-labelledby="academy-invite-title" className="pupillo-highlight min-w-0 rounded-lg border p-5">
      <h2 id="academy-invite-title" className="text-2xl font-black">Profilo salvato! I tuoi prossimi passi</h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <GraduationCap className="size-8 text-pack-highlight" aria-hidden="true" />
          <h3 className="text-xl font-bold">Inizia Pupillo Academy</h3>
          <p className="text-sm text-muted-foreground">Segui le lezioni e mettiti alla prova con i quiz sulle basi della sala. È gratuita e facoltativa: puoi usare Pupillo anche senza seguirla.</p>
          <AcademyLink className={`${academyButtonClass} bg-pack-highlight text-pack-highlight-foreground hover:bg-pack-highlight/90`} onClick={onClose}>Inizia l’Academy gratuita</AcademyLink>
        </div>
        <div className="min-w-0 space-y-3">
          <CalendarDays className="size-8 text-pack-highlight" aria-hidden="true" />
          <h3 className="text-xl font-bold">Imposta le tue disponibilità</h3>
          <p className="text-sm text-muted-foreground">Scegli i giorni e gli orari in cui puoi lavorare, così i locali sanno quando sei disponibile.</p>
          <Button asChild className="h-auto whitespace-normal bg-pack-highlight text-pack-highlight-foreground hover:bg-pack-highlight/90"><Link to="/availability">Imposta giorni e orari</Link></Button>
        </div>
      </div>
      <Button type="button" variant="ghost" onClick={onClose} className="mt-4 text-pack-foreground hover:bg-pack-foreground/10 hover:text-pack-foreground">Più tardi</Button>
    </section>
  );
}

/**
 * Unico blocco Academy della dashboard lavoratore: invito una tantum dopo il
 * completamento reale del profilo, altrimenti la scheda compatta.
 */
export function AcademyWorkerSlot({ userId, profileCompleted }: { userId: string; profileCompleted: boolean }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setPending(profileCompleted && isAcademyInvitePending(userId));
  }, [userId, profileCompleted]);
  if (!profileCompleted) return null;
  if (pending) {
    return <AcademyCompletionInvite onClose={() => { dismissAcademyInvite(userId); setPending(false); }} />;
  }
  return <AcademyDashboardCard />;
}
