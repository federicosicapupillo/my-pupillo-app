import { describe, it, expect, beforeEach } from "vitest";
import { SinglePreviewController, computePointsSignature, type PreviewMarker } from "../map-preview";

/**
 * Fake timer: registra i callback e li esegue solo quando si chiama `flush()`.
 * Permette di testare la logica di delay senza dipendere da timer reali.
 */
function makeFakeTimers() {
  type Job = { id: number; cb: () => void; cancelled: boolean };
  const jobs = new Map<number, Job>();
  let nextId = 1;
  const setT = (cb: () => void, _ms: number) => {
    const id = nextId++;
    jobs.set(id, { id, cb, cancelled: false });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  const clearT = (h: ReturnType<typeof setTimeout>) => {
    const id = h as unknown as number;
    const job = jobs.get(id);
    if (job) job.cancelled = true;
    jobs.delete(id);
  };
  const flush = () => {
    // Esegui in ordine di creazione finché non si svuota (i timer possono
    // accodarne altri, ma nel nostro controller non succede).
    const ordered = Array.from(jobs.values()).sort((a, b) => a.id - b.id);
    jobs.clear();
    for (const j of ordered) if (!j.cancelled) j.cb();
  };
  return { setT, clearT, flush, pending: () => jobs.size };
}

function makeMarker(label: string): PreviewMarker & { opens: number; closes: number; label: string; _open: boolean } {
  const m: any = {
    label,
    opens: 0,
    closes: 0,
    _open: false,
    openPopup() { m._open = true; m.opens += 1; },
    closePopup() { m._open = false; m.closes += 1; },
    getPopup() { return { isOpen: () => m._open }; },
  };
  return m;
}

describe("computePointsSignature", () => {
  it("è stabile per liste identiche", () => {
    const a = [{ id: "1", category: "worker" }, { id: "2", category: "restaurant" }];
    const b = [{ id: "1", category: "worker" }, { id: "2", category: "restaurant" }];
    expect(computePointsSignature(a)).toBe(computePointsSignature(b));
  });
  it("cambia se cambia un id o una categoria", () => {
    const base = [{ id: "1", category: "worker" }];
    expect(computePointsSignature(base)).not.toBe(
      computePointsSignature([{ id: "1", category: "restaurant" }]),
    );
    expect(computePointsSignature(base)).not.toBe(
      computePointsSignature([{ id: "2", category: "worker" }]),
    );
  });
  it("cambia quando la cardinalità cambia (filtri/lista laterale)", () => {
    const sigA = computePointsSignature([{ id: "1", category: "worker" }]);
    const sigB = computePointsSignature([
      { id: "1", category: "worker" },
      { id: "2", category: "worker" },
    ]);
    expect(sigA).not.toBe(sigB);
  });
});

describe("SinglePreviewController — invariante 'una sola preview aperta'", () => {
  let timers: ReturnType<typeof makeFakeTimers>;
  let ctrl: SinglePreviewController;

  beforeEach(() => {
    timers = makeFakeTimers();
    ctrl = new SinglePreviewController({
      openDelay: 10,
      closeDelay: 20,
      setTimeout: timers.setT,
      clearTimeout: timers.clearT,
    });
  });

  it("hover su un nuovo marker chiude il precedente prima di aprire", () => {
    const a = makeMarker("A");
    const b = makeMarker("B");

    ctrl.hoverEnter(a);
    timers.flush();
    expect(a._open).toBe(true);
    expect(ctrl.getActive()).toBe(a);

    // Hover su B: il timer di chiusura di A non scatta perché l'attivazione
    // di B chiude esplicitamente il precedente.
    ctrl.hoverEnter(b);
    timers.flush();
    expect(a._open).toBe(false);
    expect(b._open).toBe(true);
    expect(ctrl.getActive()).toBe(b);
  });

  it("pin (click desktop) chiude il marker attivo precedente", () => {
    const a = makeMarker("A");
    const b = makeMarker("B");
    ctrl.pin(a);
    expect(a._open).toBe(true);
    ctrl.pin(b);
    expect(a._open).toBe(false);
    expect(b._open).toBe(true);
    expect(ctrl.getActive()).toBe(b);
  });

  it("tap su touch fa toggle dello stesso marker e single-active fra marker diversi", () => {
    const a = makeMarker("A");
    const b = makeMarker("B");
    ctrl.tap(a);
    expect(a._open).toBe(true);
    ctrl.tap(a); // toggle: chiude
    expect(a._open).toBe(false);
    expect(ctrl.getActive()).toBeNull();

    ctrl.tap(a);
    ctrl.tap(b);
    expect(a._open).toBe(false);
    expect(b._open).toBe(true);
    expect(ctrl.getActive()).toBe(b);
  });

  it("pointsChanged() chiude la preview attiva e annulla i timer (cambio categoria/filtri/lista)", () => {
    const a = makeMarker("A");
    ctrl.pin(a);
    expect(a._open).toBe(true);
    ctrl.pointsChanged();
    expect(a._open).toBe(false);
    expect(ctrl.getActive()).toBeNull();
    expect(timers.pending()).toBe(0);
  });

  it("pointsChanged() annulla un'apertura in attesa (hover non ancora confermato)", () => {
    const a = makeMarker("A");
    ctrl.hoverEnter(a);
    // open timer in coda ma non ancora eseguito
    expect(a._open).toBe(false);
    ctrl.pointsChanged();
    timers.flush(); // se il timer non fosse stato cancellato, aprirebbe ora
    expect(a._open).toBe(false);
    expect(ctrl.getActive()).toBeNull();
  });

  it("rientrare nel popup annulla la chiusura programmata (no flicker)", () => {
    const a = makeMarker("A");
    ctrl.pin(a);
    ctrl.hoverLeave(a); // pianifica chiusura
    ctrl.popupEnter();  // l'utente entra nel popup: annulla
    timers.flush();
    expect(a._open).toBe(true);
    expect(ctrl.getActive()).toBe(a);
  });

  it("hoverEnter sullo stesso marker attivo non genera open/close spurie", () => {
    const a = makeMarker("A");
    ctrl.pin(a);
    const opensBefore = a.opens;
    const closesBefore = a.closes;
    ctrl.hoverEnter(a);
    timers.flush();
    expect(a.opens).toBe(opensBefore);
    expect(a.closes).toBe(closesBefore);
    expect(ctrl.getActive()).toBe(a);
  });

  it("invariante: in ogni momento al massimo un marker risulta aperto", () => {
    const markers = [makeMarker("A"), makeMarker("B"), makeMarker("C"), makeMarker("D")];
    const assertSingle = () => {
      const open = markers.filter((m) => m._open);
      expect(open.length).toBeLessThanOrEqual(1);
    };
    // Sequenza che simula: hover A, hover B (cambio filtro), pin C, tap D,
    // cambio lista laterale, tap D di nuovo.
    ctrl.hoverEnter(markers[0]); timers.flush(); assertSingle();
    ctrl.hoverEnter(markers[1]); timers.flush(); assertSingle();
    ctrl.pointsChanged(); assertSingle();
    ctrl.pin(markers[2]); assertSingle();
    ctrl.tap(markers[3]); assertSingle();
    ctrl.pointsChanged(); assertSingle();
    ctrl.tap(markers[3]); assertSingle();
    ctrl.tap(markers[3]); assertSingle();
    expect(markers.every((m) => !m._open)).toBe(true);
  });
});