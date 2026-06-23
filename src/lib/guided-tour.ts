/**
 * Guided Onboarding Tour
 *
 * Lightweight client-side tour engine. Steps target stable
 * `data-tour="<key>"` attributes placed on UI elements. Completion is
 * persisted per-user in localStorage so the tour does not re-appear on
 * subsequent logins (same device). Different tour versions can be
 * triggered in the future by bumping the tour key.
 */

export type TourStep = {
  /** Unique step id, used for keys / debugging */
  id: string;
  /** Optional CSS selector to highlight. If omitted → centered modal step. */
  target?: string;
  /** Title shown in the popover */
  title: string;
  /** Body text shown in the popover */
  body: string;
  /** Preferred placement when there is room */
  placement?: "top" | "bottom" | "left" | "right" | "center";
};

export type TourDefinition = {
  /** Stable key used for persistence (bump suffix to re-run) */
  key: string;
  steps: TourStep[];
};

/** Custom event dispatched to manually (re)start a tour */
export const TOUR_START_EVENT = "pupillo:start-tour";

export type TourStartDetail = {
  /** Force-start even if already completed */
  force?: boolean;
  /** Role override; defaults to current auth role */
  role?: "worker" | "restaurant" | null;
};

export function dispatchStartTour(detail: TourStartDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail }));
}

/* ---------------- persistence ---------------- */

function storageKey(userId: string, tourKey: string) {
  return `pupillo:tour:${userId}:${tourKey}`;
}

export function isTourCompleted(userId: string | null | undefined, tourKey: string): boolean {
  if (!userId || typeof window === "undefined") return true;
  try {
    return !!window.localStorage.getItem(storageKey(userId, tourKey));
  } catch {
    return false;
  }
}

export function markTourCompleted(userId: string | null | undefined, tourKey: string) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId, tourKey), new Date().toISOString());
  } catch {
    /* ignore quota errors */
  }
}

/* ---------------- step definitions ---------------- */

export const WORKER_TOUR: TourDefinition = {
  key: "worker_dashboard_tour_v1",
  steps: [
    {
      id: "welcome",
      title: "Benvenuto su Pupillo",
      body: "Ti mostriamo velocemente dove trovare le funzioni principali per gestire turni, messaggi e disponibilità.",
      placement: "center",
    },
    {
      id: "messages",
      target: '[data-tour="messages"]',
      title: "I tuoi messaggi",
      body: "Chatta con i ristoratori, ricevi proposte e gestisci tutto da qui.",
      placement: "bottom",
    },
    {
      id: "shifts",
      target: '[data-tour="worker-shifts"]',
      title: "Trova turni",
      body: "Cerca i turni disponibili vicino a te e candidati in un tap.",
      placement: "bottom",
    },
    {
      id: "availability",
      target: '[data-tour="worker-availability"]',
      title: "Le tue candidature",
      body: "Tieni traccia di tutte le candidature inviate e dei turni confermati.",
      placement: "bottom",
    },
    {
      id: "profile",
      target: '[data-tour="profile"]',
      title: "Il tuo profilo",
      body: "Completa il profilo per aumentare le tue possibilità di essere scelto.",
      placement: "bottom",
    },
    {
      id: "help",
      target: '[data-tour="help-button"]',
      title: "Hai bisogno di aiuto?",
      body: "Trova risposte, contatta il supporto o rivedi questa guida quando vuoi.",
      placement: "left",
    },
    {
      id: "done",
      title: "Perfetto, sei pronto!",
      body: "Ora puoi iniziare a usare Pupillo. Puoi sempre rivedere la guida dalla sezione Aiuto.",
      placement: "center",
    },
  ],
};

export const RESTAURANT_TOUR: TourDefinition = {
  key: "restaurant_dashboard_tour_v1",
  steps: [
    {
      id: "welcome",
      title: "Benvenuto su Pupillo",
      body: "Ti mostriamo velocemente come creare annunci, gestire candidature e comunicare con i lavoratori.",
      placement: "center",
    },
    {
      id: "messages",
      target: '[data-tour="messages"]',
      title: "I tuoi messaggi",
      body: "Parla con i lavoratori, invia proposte e gestisci le conversazioni.",
      placement: "bottom",
    },
    {
      id: "announcements",
      target: '[data-tour="restaurant-announcements"]',
      title: "I tuoi annunci",
      body: "Crea e gestisci gli annunci per trovare il personale che ti serve.",
      placement: "bottom",
    },
    {
      id: "shifts",
      title: "I tuoi turni",
      body: "Visualizza e gestisci tutti i turni confermati e in programma.",
      placement: "center",
    },
    {
      id: "candidates",
      target: '[data-tour="restaurant-candidates"]',
      title: "I candidati",
      body: "Valuta i profili, accetta candidature e proponi turni direttamente.",
      placement: "bottom",
    },
    {
      id: "profile",
      target: '[data-tour="profile"]',
      title: "Il tuo account",
      body: "Gestisci il profilo del locale, i pagamenti e le impostazioni.",
      placement: "bottom",
    },
    {
      id: "help",
      target: '[data-tour="help-button"]',
      title: "Hai bisogno di aiuto?",
      body: "Supporto, FAQ e guida sempre a portata di mano.",
      placement: "left",
    },
    {
      id: "done",
      title: "Tutto pronto",
      body: "Ora puoi iniziare a creare annunci e trovare lavoratori disponibili.",
      placement: "center",
    },
  ],
};

export function getTourForRole(role: "worker" | "restaurant" | null | undefined): TourDefinition | null {
  if (role === "worker") return WORKER_TOUR;
  if (role === "restaurant") return RESTAURANT_TOUR;
  return null;
}

/**
 * Find the first visible DOM element matching the selector. Returns null
 * if not found OR if the element is hidden (e.g. desktop link on mobile,
 * or mobile link while menu is closed). This lets the tour gracefully
 * skip targets that are not currently in the layout.
 */
export function findVisibleTarget(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const el of els) {
    if (el.offsetParent === null && el.getClientRects().length === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    return el;
  }
  return null;
}