import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  mergeThreadUpdate,
  previewChanged,
  createDebouncedReload,
  applyIncomingMessage,
  applyProposalResponse,
  clearThreadUnread,
  type InboxThread,
} from "@/lib/inbox-realtime";

const baseThread = (over: Partial<InboxThread> = {}): InboxThread => ({
  id: "app-1",
  status: "pending",
  lastBody: "ciao",
  lastAt: "2025-05-19T10:00:00.000Z",
  unread: 0,
  ...over,
});

describe("mergeThreadUpdate — no duplicates", () => {
  it("patches an existing thread in place (no insert)", () => {
    const before: InboxThread[] = [baseThread()];
    const after = mergeThreadUpdate(before, {
      id: "app-1",
      status: "accepted",
      last_message_preview: "Proposta accettata.",
      last_message_at: "2025-05-19T10:05:00.000Z",
    });
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe("accepted");
    expect(after[0].lastBody).toBe("Proposta accettata.");
    expect(after[0].lastAt).toBe("2025-05-19T10:05:00.000Z");
  });

  it("does NOT append a new thread when the row is unknown (waits for reload)", () => {
    const before: InboxThread[] = [baseThread()];
    const after = mergeThreadUpdate(before, {
      id: "app-NEW",
      status: "pending",
      last_message_preview: "Nuova proposta",
      last_message_at: "2025-05-19T10:10:00.000Z",
    });
    expect(after).toHaveLength(1);
    expect(after.map((t) => t.id)).toEqual(["app-1"]);
  });

  it("keeps referential equality when the row isn't tracked (no re-render)", () => {
    const before: InboxThread[] = [baseThread()];
    const after = mergeThreadUpdate(before, { id: "unknown" });
    expect(after).toBe(before);
  });

  it("is idempotent: applying the same update twice yields the same shape", () => {
    const before: InboxThread[] = [baseThread()];
    const row = {
      id: "app-1",
      status: "accepted",
      last_message_preview: "Proposta accettata.",
      last_message_at: "2025-05-19T10:05:00.000Z",
    };
    const once = mergeThreadUpdate(before, row);
    const twice = mergeThreadUpdate(once, row);
    expect(twice).toHaveLength(1);
    expect(twice[0]).toEqual(once[0]);
  });

  it("preserves untouched fields on the patched row", () => {
    const before: InboxThread[] = [
      baseThread({ unread: 3, other: { id: "u1", name: "Mario" } } as any),
    ];
    const after = mergeThreadUpdate(before, {
      id: "app-1",
      status: "accepted",
    });
    expect((after[0] as any).unread).toBe(3);
    expect((after[0] as any).other).toEqual({ id: "u1", name: "Mario" });
  });

  it("does not duplicate when several updates for the same row arrive", () => {
    let threads: InboxThread[] = [baseThread()];
    threads = mergeThreadUpdate(threads, { id: "app-1", status: "interested" });
    threads = mergeThreadUpdate(threads, {
      id: "app-1",
      last_message_preview: "Nuovo messaggio",
      last_message_at: "2025-05-19T11:00:00.000Z",
    });
    threads = mergeThreadUpdate(threads, { id: "app-1", status: "accepted" });
    expect(threads).toHaveLength(1);
    expect(threads[0].status).toBe("accepted");
    expect(threads[0].lastBody).toBe("Nuovo messaggio");
  });
});

describe("previewChanged", () => {
  it("returns true when last_message_at changed", () => {
    expect(
      previewChanged(
        { id: "x", last_message_at: "t0", last_message_preview: "a" },
        { id: "x", last_message_at: "t1", last_message_preview: "a" },
      ),
    ).toBe(true);
  });
  it("returns true when preview text changed", () => {
    expect(
      previewChanged(
        { id: "x", last_message_at: "t0", last_message_preview: "a" },
        { id: "x", last_message_at: "t0", last_message_preview: "b" },
      ),
    ).toBe(true);
  });
  it("returns false when only status changed", () => {
    expect(
      previewChanged(
        { id: "x", status: "pending", last_message_at: "t0", last_message_preview: "a" },
        { id: "x", status: "accepted", last_message_at: "t0", last_message_preview: "a" },
      ),
    ).toBe(false);
  });
  it("returns false when old row is missing (INSERT path)", () => {
    expect(previewChanged(null, { id: "x", last_message_at: "t0" })).toBe(false);
  });
});

describe("createDebouncedReload — burst collapse", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("collapses a burst of schedule() calls into one fn() call", () => {
    const fn = vi.fn();
    const r = createDebouncedReload(fn, 120);
    // Simulate the burst that fires when a restaurant sends a new proposal:
    // application INSERT + message INSERT + application UPDATE (preview).
    r.schedule();
    r.schedule();
    r.schedule();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not fire before the delay elapses", () => {
    const fn = vi.fn();
    const r = createDebouncedReload(fn, 120);
    r.schedule();
    vi.advanceTimersByTime(119);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fires once per quiet period, not per event", () => {
    const fn = vi.fn();
    const r = createDebouncedReload(fn, 120);
    for (let i = 0; i < 10; i++) r.schedule();
    vi.advanceTimersByTime(120);
    // Second burst after a quiet window.
    for (let i = 0; i < 5; i++) r.schedule();
    vi.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel() drops a pending call (used on unmount)", () => {
    const fn = vi.fn();
    const r = createDebouncedReload(fn, 120);
    r.schedule();
    r.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it("works end-to-end for the 'restaurant sends proposal' event sequence", () => {
    // Mirrors the realtime subscription wiring: every relevant event calls
    // schedule(); the timer fires exactly once → load() runs exactly once.
    const load = vi.fn();
    const r = createDebouncedReload(load, 120);
    // 1) applications INSERT (new conversation row)
    r.schedule();
    // 2) messages INSERT (proposal body)
    r.schedule();
    // 3) applications UPDATE (last_message_preview + last_message_at)
    r.schedule();
    // 4) another messages event (system message: "proposta inviata")
    r.schedule();
    vi.advanceTimersByTime(120);
    expect(load).toHaveBeenCalledTimes(1);
  });
});