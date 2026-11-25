import { useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Pause, Play, Star, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

const restaurantFaces = Object.values(import.meta.glob<string>("@/assets/reviews/r*.jpg", { eager: true, import: "default" }));
const workerFaces = Object.values(import.meta.glob<string>("@/assets/reviews/w*.jpg", { eager: true, import: "default" }));

type Review = { author: string; stars: number; text: string; photo?: string };

const workerReviews: Review[] = [
  { author: "Marco R.", stars: 5, text: "Finalmente un'app pensata per chi lavora nella ristorazione! Posso cercare turni extra senza dover mandare curriculum a decine di locali. Semplice e intuitiva." },
  { author: "Giulia B.", stars: 5, text: "L'idea è davvero comoda. Vedo le opportunità disponibili e posso candidarmi direttamente dal telefono. Per chi cerca qualche turno in più è un bel vantaggio." },
  { author: "Alessandro C.", stars: 5, text: "Lavoro già in un ristorante, ma nei giorni liberi mi piace fare qualche extra. Pupillo mi permette di organizzarmi meglio e cercare opportunità quando sono disponibile." },
  { author: "Sara M.", stars: 4, text: "App molto facile da utilizzare, anche per chi non è particolarmente tecnologico. Mi piacerebbe avere ancora più locali disponibili nella mia zona." },
  { author: "Luca F.", stars: 5, text: "Mi piace soprattutto poter indicare quanto voglio guadagnare all'ora e scegliere le opportunità più adatte alle mie esigenze." },
  { author: "Elena P.", stars: 5, text: "Un sistema molto più pratico rispetto ai soliti gruppi Facebook dove devi continuamente controllare gli annunci. Qui è tutto organizzato per il lavoro nella ristorazione." },
  { author: "Davide G.", stars: 4, text: "La registrazione è abbastanza veloce e il funzionamento si capisce subito. Sarebbe utile trovare ancora più offerte per chi lavora in cucina." },
  { author: "Chiara S.", stars: 5, text: "Per chi studia e vuole lavorare qualche sera o nel weekend è un'ottima idea. Puoi cercare turni compatibili con i tuoi impegni senza cercare un lavoro fisso." },
  { author: "Matteo D.", stars: 5, text: "Quello che apprezzo di Pupillo è la possibilità di farmi conoscere da nuovi ristoranti. Un turno extra può diventare anche l'inizio di una collaborazione continuativa." },
  { author: "Francesca L.", stars: 5, text: "Era ora che qualcuno pensasse anche a noi lavoratori extra! Un'unica piattaforma per trovare locali che cercano personale, senza mille telefonate e messaggi." },
].map((review, index) => ({ ...review, photo: workerFaces[index] }));

const restaurantReviews: Review[] = [
  { author: "Trattoria del Girasole", stars: 5, text: "Chi gestisce un ristorante sa quanto sia difficile trovare personale all'ultimo momento. Pupillo è una soluzione interessante perché permette di cercare collaboratori in modo semplice e veloce." },
  { author: "Osteria Due Mestoli", stars: 5, text: "La cosa che mi piace di più è che pago per acquisire un nuovo contatto e, se mi trovo bene, posso richiamare lo stesso collaboratore senza dover pagare nuovamente. Un bel vantaggio." },
  { author: "Bistrot della Lanterna", stars: 5, text: "Finalmente una piattaforma pensata per le esigenze reali della ristorazione. Poter cercare personale per un singolo servizio è esattamente quello di cui abbiamo bisogno." },
  { author: "Ristorante Il Melograno", stars: 4, text: "Interfaccia intuitiva e sistema di ricerca pratico. Sarebbe ancora più utile con un numero maggiore di collaboratori disponibili nelle zone meno centrali." },
  { author: "Terrazza delle Vele", stars: 5, text: "Per chi gestisce un locale stagionale, trovare personale per i momenti di maggiore lavoro è sempre complicato. Pupillo offre un modo più organizzato per affrontare il problema." },
  { author: "Osteria del Cortile", stars: 5, text: "Molto interessante la possibilità di creare una propria rete di collaboratori. Una volta trovato qualcuno di affidabile, poterlo ricontattare gratuitamente fa davvero la differenza." },
  { author: "Trattoria Tre Forchette", stars: 5, text: "Prima di conoscere Pupillo, per cercare un extra bisognava telefonare a conoscenti e colleghi o pubblicare annunci. Avere uno strumento dedicato rende tutto molto più pratico." },
  { author: "Ristorante La Spiga Allegra", stars: 4, text: "Bella piattaforma, soprattutto per chi ha esigenze di personale che cambiano continuamente. Mi piacerebbe vedere più profili con esperienza specifica in cucina." },
  { author: "Bistrot Sette Tavoli", stars: 5, text: "La gestione del personale extra è una delle cose più stressanti del nostro lavoro. Un servizio come Pupillo può far risparmiare parecchio tempo nella ricerca." },
  { author: "Osteria del Basilico", stars: 5, text: "Mi piace il fatto di poter individuare collaboratori in base alle competenze e all'esperienza. Non è la solita piattaforma generica per cercare dipendenti." },
  { author: "Ristorante Le Due Olivaie", stars: 5, text: "Per il nostro tipo di attività è molto più utile trovare persone disponibili per singoli turni piuttosto che pubblicare continuamente annunci di lavoro. Ottima idea." },
  { author: "Trattoria della Piazzetta", stars: 4, text: "Servizio interessante e abbastanza immediato da utilizzare. Sarebbe utile avere sempre più collaboratori disponibili anche nei weekend e nei periodi festivi." },
  { author: "Osteria Il Grappolo Dorato", stars: 5, text: "Il vero punto di forza è poter costruire nel tempo una lista di persone da richiamare. Per un ristoratore questa possibilità ha un valore enorme." },
  { author: "Bistrot del Portico", stars: 5, text: "Gestisco un locale con picchi di lavoro nel fine settimana. Pupillo è proprio il tipo di strumento che cercavo per organizzare meglio le esigenze di personale extra." },
  { author: "Ristorante La Tavola Fiorita", stars: 5, text: "Mi convince soprattutto il modello di pagamento: non devo acquistare continuamente lo stesso contatto. Se un collaboratore lavora bene, posso continuare a coinvolgerlo nei servizi successivi senza ulteriori costi di sblocco." },
].map((review, index) => ({ ...review, photo: restaurantFaces[index] }));

function ReviewRow({ reviews, role }: { reviews: Review[]; role: "worker" | "restaurant" }) {
  const worker = role === "worker";
  const autoScroll = useMemo(() => AutoScroll({
    speed: 0.45,
    direction: worker ? "forward" : "backward",
    startDelay: 0,
    playOnInit: false,
    stopOnInteraction: true,
  }), [worker]);
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true, align: "start" }, [autoScroll]);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const label = worker ? "Lavoratori" : "Ristoratori";
  const Icon = worker ? BriefcaseBusiness : UtensilsCrossed;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!carousel) return;
    const update = () => {
      if (paused || interacting || reducedMotion || document.hidden) autoScroll.stop();
      else autoScroll.play();
    };
    update();
    carousel.on("pointerUp", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      autoScroll.stop();
      carousel.off("pointerUp", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [carousel, autoScroll, paused, interacting, reducedMotion]);

  return (
    <div
      role="region"
      aria-roledescription="carosello"
      aria-label={`Recensioni ${label.toLowerCase()}`}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}
      className="min-w-0"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`flex min-w-0 items-center gap-2 text-lg font-bold ${worker ? "text-primary" : "text-accent"}`}>
          <Icon className="size-5 shrink-0" aria-hidden="true" />{label}
        </h3>
        <div className="flex shrink-0 gap-1">
          {!reducedMotion && <Button variant="ghost" size="icon" aria-label={`${paused ? "Riprendi" : "Ferma"} scorrimento ${label.toLowerCase()}`} title={paused ? "Riprendi scorrimento" : "Ferma scorrimento"} onClick={() => setPaused(!paused)}>{paused ? <Play /> : <Pause />}</Button>}
          <Button variant="ghost" size="icon" aria-label={`Recensione precedente ${label.toLowerCase()}`} title="Recensione precedente" onClick={() => carousel?.scrollPrev()}><ArrowLeft /></Button>
          <Button variant="ghost" size="icon" aria-label={`Recensione successiva ${label.toLowerCase()}`} title="Recensione successiva" onClick={() => carousel?.scrollNext()}><ArrowRight /></Button>
        </div>
      </div>
      <div ref={viewportRef} className="overflow-hidden">
        <div className="-ml-3 flex touch-pan-y">
          {reviews.map((review, index) => (
            <div key={review.text} role="group" aria-roledescription="diapositiva" aria-label={`${index + 1} di ${reviews.length}`} className="flex min-w-0 flex-[0_0_260px] pl-3 sm:flex-[0_0_280px]">
              <figure className={`flex w-full flex-col rounded-lg border bg-card p-4 ${worker ? "border-primary/25" : "border-accent/30"}`}>
                <div aria-label={`${review.stars} stelle su 5`} className="mb-3 flex gap-1">
                  {Array.from({ length: 5 }, (_, star) => <Star key={star} aria-hidden="true" strokeWidth={1.25} className={`size-4 ${star < review.stars ? "fill-rating-gold text-rating-gold-edge" : "text-muted-foreground/40"}`} />)}
                </div>
                <blockquote className="grow text-xs leading-5 text-card-foreground">{review.text}</blockquote>
                <figcaption className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">{review.photo && <img src={review.photo} alt="" width={32} height={32} loading="lazy" className="size-8 shrink-0 rounded-full object-cover" />}<span className="min-w-0">{review.author}</span></figcaption>
              </figure>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeReviews() {
  return (
    <section aria-labelledby="home-reviews-title" className="border-t border-border pb-16 pt-12 md:pb-20 md:pt-16">
      <div className="mb-6">
        <h2 id="home-reviews-title" className="text-3xl font-black md:text-4xl">Le vostre recensioni.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Recensioni di esempio con nomi di fantasia.</p>
      </div>
      <div className="space-y-6">
        <ReviewRow reviews={workerReviews} role="worker" />
        <ReviewRow reviews={restaurantReviews} role="restaurant" />
      </div>
    </section>
  );
}