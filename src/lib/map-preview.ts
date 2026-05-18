/**
 * Logica condivisa per la preview della mappa.
 *
 * Garantisce che sia aperta UNA sola preview alla volta gestendo:
 * - hover desktop (open-delay + close-delay con possibilità di "rientrare")
 * - tap su touch (toggle pulito sullo stesso marker, chiusura del precedente)
 * - cambio della lista dei punti (filtri/categoria/lista laterale)
 *
 * Estratta da MapViewInner per essere testabile in unità senza dipendere
 * da react-leaflet, jsdom o timer reali.
 */

export interface PreviewMarker {
  openPopup: () => void;
  closePopup: () => void;
  getPopup?: () => { isOpen?: () => boolean } | null | undefined;
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface SinglePreviewControllerOptions {
  openDelay?: number;
  closeDelay?: number;
  setTimeout?: (cb: () => void, ms: number) => TimerHandle;
  clearTimeout?: (h: TimerHandle) => void;
}

/**
 * Controlla quale marker ha la preview aperta. Tutte le operazioni che
 * aprono una preview chiudono prima la precedente, in modo che l'invariante
 * "una sola preview aperta" sia preservata in ogni transizione.
 */
export class SinglePreviewController {
  private readonly openDelay: number;
  private readonly closeDelay: number;
  private readonly setTimeoutFn: (cb: () => void, ms: number) => TimerHandle;
  private readonly clearTimeoutFn: (h: TimerHandle) => void;

  private openTimer: TimerHandle | null = null;
  private closeTimer: TimerHandle | null = null;
  private active: PreviewMarker | null = null;

  constructor(opts: SinglePreviewControllerOptions = {}) {
    this.openDelay = opts.openDelay ?? 60;
    this.closeDelay = opts.closeDelay ?? 220;
    this.setTimeoutFn = opts.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimeoutFn = opts.clearTimeout ?? ((h) => clearTimeout(h));
  }

  /** Marker attualmente con preview aperta (o `null`). */
  getActive(): PreviewMarker | null {
    return this.active;
  }

  private cancelOpen() {
    if (this.openTimer != null) {
      this.clearTimeoutFn(this.openTimer);
      this.openTimer = null;
    }
  }

  private cancelClose() {
    if (this.closeTimer != null) {
      this.clearTimeoutFn(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private closePrevious(except: PreviewMarker | null) {
    const prev = this.active;
    if (prev && prev !== except) {
      try { prev.closePopup(); } catch { /* noop */ }
    }
  }

  /** Imposta `marker` come attivo, chiudendo l'eventuale precedente. */
  private activate(marker: PreviewMarker) {
    this.closePrevious(marker);
    this.active = marker;
    marker.openPopup();
  }

  /** Hover su un marker (desktop). Annulla chiusure pendenti e apre con delay. */
  hoverEnter(marker: PreviewMarker) {
    this.cancelClose();
    if (this.active === marker) {
      this.cancelOpen();
      return;
    }
    this.cancelOpen();
    this.openTimer = this.setTimeoutFn(() => {
      this.openTimer = null;
      this.activate(marker);
    }, this.openDelay);
  }

  /** Mouseout dal marker: annulla open in attesa, pianifica la chiusura. */
  hoverLeave(marker: PreviewMarker) {
    this.cancelOpen();
    this.scheduleClose(marker);
  }

  /** Click "pinna" la preview: annulla tutti i timer, apre immediatamente. */
  pin(marker: PreviewMarker) {
    this.cancelOpen();
    this.cancelClose();
    this.activate(marker);
  }

  /**
   * Tap su touch: toggle sullo stesso marker, altrimenti chiude il
   * precedente e apre quello toccato.
   */
  tap(marker: PreviewMarker) {
    const popup = marker.getPopup?.();
    const isOpen = !!popup?.isOpen?.();
    if (isOpen) {
      try { marker.closePopup(); } catch { /* noop */ }
      if (this.active === marker) this.active = null;
      return;
    }
    this.cancelOpen();
    this.cancelClose();
    this.activate(marker);
  }

  /** Hover dentro al popup: tieni viva la preview. */
  popupEnter() {
    this.cancelClose();
  }

  /** Hover fuori dal popup: pianifica la chiusura del marker attivo. */
  popupLeave() {
    if (this.active) this.scheduleClose(this.active);
  }

  private scheduleClose(marker: PreviewMarker) {
    this.cancelClose();
    this.closeTimer = this.setTimeoutFn(() => {
      this.closeTimer = null;
      try { marker.closePopup(); } catch { /* noop */ }
      if (this.active === marker) this.active = null;
    }, this.closeDelay);
  }

  /**
   * Da chiamare quando la lista dei punti cambia (filtri/categoria/lista
   * laterale). Chiude qualsiasi preview aperta e annulla i timer.
   */
  pointsChanged() {
    this.cancelOpen();
    this.cancelClose();
    if (this.active) {
      try { this.active.closePopup(); } catch { /* noop */ }
      this.active = null;
    }
  }

  /** Cleanup all'unmount. */
  dispose() {
    this.cancelOpen();
    this.cancelClose();
    this.active = null;
  }
}

/**
 * Firma stabile della lista di punti. Cambia quando l'insieme visibile
 * cambia (categoria, filtro, ricerca) e viene usata per innescare la
 * chiusura della preview.
 */
export function computePointsSignature(
  points: ReadonlyArray<{ id: string; category: string }>,
): string {
  return `${points.length}:${points.map((p) => `${p.category}-${p.id}`).join("|")}`;
}