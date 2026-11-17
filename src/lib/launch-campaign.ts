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
  title: "Pupillo arriva a Torino! 🎉",
  /** Corpo del messaggio */
  body:
    "Pupillo parte a pagamento per i ristoratori. Pubblica annunci, ricevi candidature e trova il personale di cui hai bisogno.",
  /** Etichetta breve evidenziata */
  highlight: "A pagamento dal lancio",
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
