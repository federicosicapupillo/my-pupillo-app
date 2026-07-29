/**
 * Configurazione centralizzata della comunicazione promozionale
 * "Lancio Pupillo a Bologna".
 *
 * Qui vivono testo, data di scadenza e regole di visibilità: nessun altro file
 * deve duplicare queste informazioni. Non ha alcun impatto sulla logica di
 * crediti, pacchetti, annunci, candidature o conferma dei lavoratori.
 */
export const BOLOGNA_LAUNCH_CAMPAIGN = {
  /** Titolo del banner */
  title: "Pupillo arriva a Bologna! 🎉",
  /** Corpo del messaggio */
  body:
    "In occasione del lancio, la piattaforma rimane gratuita fino al 31 dicembre 2026. Puoi pubblicare annunci, ricevere candidature e trovare il personale di cui hai bisogno senza costi.",
  /** Etichetta breve evidenziata (gratuità + scadenza) */
  highlight: "Gratis fino al 31 dicembre 2026",
  /** Città del lancio */
  city: "Bologna",
  /**
   * Istante in cui la comunicazione smette di essere mostrata:
   * 1° gennaio 2027 (ora locale italiana, UTC+1).
   */
  hideFrom: new Date("2027-01-01T00:00:00+01:00"),
  /** Ruoli che possono vedere la comunicazione */
  visibleForRoles: ["restaurant"] as const,
} as const;

/** True se la campagna è ancora attiva alla data indicata (default: adesso). */
export function isBolognaLaunchActive(now: Date = new Date()): boolean {
  return now.getTime() < BOLOGNA_LAUNCH_CAMPAIGN.hideFrom.getTime();
}

/** True se il banner va mostrato per il ruolo indicato e nella data indicata. */
export function shouldShowBolognaLaunch(
  role: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!role) return false;
  if (!(BOLOGNA_LAUNCH_CAMPAIGN.visibleForRoles as readonly string[]).includes(role)) return false;
  return isBolognaLaunchActive(now);
}
