// Regole pure: quali notifiche diventano email e con quale tasto.
export type EmailCategory = "messages" | "applications" | "shifts" | "reviews";

export type NotificationEmailPlan = {
  category: EmailCategory;
  cta: string;
  /** Mostra le 5 stelle cliccabili (apre Pupillo col voto precompilato). */
  stars: boolean;
};

const starts = (t: string, list: string[]) => list.some((p) => t.startsWith(p));

export function planNotificationEmail(title: string, link: string | null): NotificationEmailPlan | null {
  const t = (title ?? "").trim();
  if (!t) return null;

  if (t.startsWith("Nuovo messaggio")) return { category: "messages", cta: "Leggi il messaggio", stars: false };

  if (starts(t, ["Lascia una recensione", "Turno concluso: lascia", "Promemoria recensione"]) ||
      (t.startsWith("Turno completato") && (link ?? "").includes("review"))) {
    return { category: "reviews", cta: "Lascia la recensione", stars: true };
  }
  if (starts(t, ["Hai ricevuto una recensione", "La recensione è ora disponibile"])) {
    return { category: "reviews", cta: "Leggi la recensione", stars: false };
  }

  if (starts(t, ["Nuova candidatura", "Nuova proposta di lavoro", "Lavoratore interessato", "Candidato interessato"])) {
    return { category: "applications", cta: "Vedi e rispondi", stars: false };
  }
  if (starts(t, ["Candidatura accettata", "Candidatura confermata", "Proposta accettata"])) {
    return { category: "applications", cta: "Apri e conferma", stars: false };
  }

  if (starts(t, ["Turno confermato", "Istruzioni confermate", "Promemoria: domani hai un turno"])) {
    return { category: "shifts", cta: "Vedi il turno", stars: false };
  }
  if (starts(t, ["Turno annullato", "Il lavoratore ha annullato", "Annuncio annullato", "Segnalato no-show", "Ritardo segnalato", "Dettagli turno aggiornati"])) {
    return { category: "shifts", cta: "Vedi i dettagli", stars: false };
  }
  return null;
}

/** Link sicuro: solo percorsi interni. */
export function absoluteLink(base: string, link: string | null): string {
  const path = link && link.startsWith("/") && !link.startsWith("//") ? link : "/notifications";
  return base.replace(/\/$/, "") + path;
}

export function starLink(url: string, rating: number): string {
  return url + (url.includes("?") ? "&" : "?") + "rating=" + rating;
}

/** Voto arrivato dalle stelle dell'email (?rating=1..5), altrimenti null. */
export function readEmailRating(search: string): number | null {
  const v = Number(new URLSearchParams(search).get("rating"));
  return Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;
}
