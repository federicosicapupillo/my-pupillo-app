import { supabase } from "@/integrations/supabase/client";

/**
 * Origine autorevole di una candidatura. Il valore NON e' scrivibile dal
 * client sulla tabella `applications`: viene imposto dal database
 * (trigger `applications_set_origin`) e puo' essere dichiarato solo dalle
 * RPC sicure di questo modulo.
 */
export type ApplicationOrigin =
  | "worker_application"
  | "restaurant_invitation"
  | "restaurant_direct_request"
  | "system_created";

export class ActiveApplicationExistsError extends Error {
  constructor() {
    super("Esiste gia' una richiesta attiva per questo lavoratore.");
    this.name = "ActiveApplicationExistsError";
  }
}

/**
 * Crea (o riattiva) la richiesta del ristoratore verso un lavoratore.
 * Registra l'origine reale, cosi' il database NON genera al ristoratore la
 * notifica "Nuova candidatura ricevuta" per un'azione iniziata da lui stesso.
 */
export async function restaurantContactWorker(params: {
  announcementId: string;
  workerId: string;
  origin?: Extract<ApplicationOrigin, "restaurant_invitation" | "restaurant_direct_request">;
}): Promise<string> {
  const { announcementId, workerId, origin = "restaurant_invitation" } = params;
  const { data, error } = await (supabase as any).rpc("restaurant_contact_worker", {
    _announcement_id: announcementId,
    _worker_id: workerId,
    _origin: origin,
  });
  if (error) {
    if ((error.message ?? "").includes("ACTIVE_APPLICATION_EXISTS")) {
      throw new ActiveApplicationExistsError();
    }
    throw error;
  }
  if (!data) throw new Error("Impossibile creare la richiesta.");
  return String(data);
}
