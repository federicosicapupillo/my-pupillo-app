import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  mergeThreadUpdate,
  previewChanged,
  createDebouncedReload,
  applyIncomingMessage,
  applyProposalResponse,
  clearThreadUnread,
  sortThreads,
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

describe("applyIncomingMessage — immediate unread bump", () => {
  const viewer = "viewer-1";
  it("bumps unread on a new message from someone else", () => {
    const before: InboxThread[] = [baseThread({ unread: 0 })];
    const after = applyIncomingMessage(
      before,
      { application_id: "app-1", sender_id: "other", body: "ciao", created_at: "2025-05-19T12:00:00.000Z" },
      viewer,
      null,
    );
    expect((after[0] as any).unread).toBe(1);
    expect(after[0].lastBody).toBe("ciao");
    expect(after[0].lastAt).toBe("2025-05-19T12:00:00.000Z");
  });
  it("does NOT bump unread for messages sent by the viewer", () => {
    const before: InboxThread[] = [baseThread({ unread: 0 })];
    const after = applyIncomingMessage(
      before,
      { application_id: "app-1", sender_id: viewer, body: "ho risposto" },
      viewer,
      null,
    );
    expect(after).toBe(before);
  });
  it("does NOT bump unread for the conversation that is currently open", () => {
    const before: InboxThread[] = [baseThread({ unread: 0 })];
    const after = applyIncomingMessage(
      before,
      { application_id: "app-1", sender_id: "other", body: "hey" },
      viewer,
      "app-1", // open
    );
    expect((after[0] as any).unread).toBe(0);
    expect(after[0].lastBody).toBe("hey");
  });
  it("does NOT bump unread for messages already marked read at insert time", () => {
    const before: InboxThread[] = [baseThread({ unread: 0 })];
    const after = applyIncomingMessage(
      before,
      { application_id: "app-1", sender_id: "other", body: "x", read_at: "2025-05-19T12:00:00.000Z" },
      viewer,
      null,
    );
    expect((after[0] as any).unread).toBe(0);
  });
  it("ignores messages for unknown application ids", () => {
    const before: InboxThread[] = [baseThread()];
    const after = applyIncomingMessage(
      before,
      { application_id: "app-UNKNOWN", sender_id: "other" },
      viewer,
      null,
    );
    expect(after).toBe(before);
  });
  it("stacks correctly when several messages arrive in a row", () => {
    let threads: InboxThread[] = [baseThread({ unread: 0 })];
    for (let i = 0; i < 3; i++) {
      threads = applyIncomingMessage(
        threads,
        { application_id: "app-1", sender_id: "other", body: `m${i}` },
        viewer,
        null,
      );
    }
    expect((threads[0] as any).unread).toBe(3);
    expect(threads[0].lastBody).toBe("m2");
    expect(threads).toHaveLength(1);
  });
});

describe("applyProposalResponse — immediate badge update", () => {
  it("flips the thread status to accepted on accept", () => {
    const before: InboxThread[] = [baseThread({ status: "pending" })];
    const after = applyProposalResponse(before, {
      application_id: "app-1",
      status: "accepted",
    });
    expect(after[0].status).toBe("accepted");
  });
  it("flips the thread status to rejected on reject", () => {
    const before: InboxThread[] = [baseThread({ status: "pending" })];
    const after = applyProposalResponse(before, {
      application_id: "app-1",
      status: "rejected",
    });
    expect(after[0].status).toBe("rejected");
  });
  it("no-op when the status already matches (no duplicate re-render)", () => {
    const before: InboxThread[] = [baseThread({ status: "accepted" })];
    const after = applyProposalResponse(before, {
      application_id: "app-1",
      status: "accepted",
    });
    expect(after).toBe(before);
  });
  it("ignores unknown response statuses", () => {
    const before: InboxThread[] = [baseThread()];
    const after = applyProposalResponse(before, {
      application_id: "app-1",
      status: "weird",
    });
    expect(after).toBe(before);
  });
  it("does NOT add a thread when the application is not in the inbox yet", () => {
    const before: InboxThread[] = [baseThread()];
    const after = applyProposalResponse(before, {
      application_id: "app-NEW",
      status: "accepted",
    });
    expect(after).toHaveLength(1);
    expect(after.map((t) => t.id)).toEqual(["app-1"]);
  });
});

describe("clearThreadUnread", () => {
  it("zeroes unread for the targeted thread", () => {
    const before: InboxThread[] = [baseThread({ unread: 4 })];
    const after = clearThreadUnread(before, "app-1");
    expect((after[0] as any).unread).toBe(0);
  });
  it("no-op when already zero", () => {
    const before: InboxThread[] = [baseThread({ unread: 0 })];
    const after = clearThreadUnread(before, "app-1");
    expect(after).toBe(before);
  });
});

describe("immediate ordering — newest thread first", () => {
  const t = (id: string, lastAt: string, name = id): InboxThread => ({
    id,
    status: "pending",
    lastBody: "x",
    lastAt,
    unread: 0,
    other: { id: `o-${id}`, name },
  } as any);

  it("sortThreads returns the SAME reference when order is already correct", () => {
    const list = [
      t("a", "2025-05-19T12:00:00.000Z"),
      t("b", "2025-05-19T10:00:00.000Z"),
    ];
    expect(sortThreads(list)).toBe(list);
  });

  it("sortThreads bubbles the newest lastAt to the top", () => {
    const list = [
      t("a", "2025-05-19T10:00:00.000Z"),
      t("b", "2025-05-19T12:00:00.000Z"),
      t("c", "2025-05-19T11:00:00.000Z"),
    ];
    expect(sortThreads(list).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("applyIncomingMessage re-sorts immediately when a new message lands", () => {
    const before: InboxThread[] = [
      t("a", "2025-05-19T12:00:00.000Z"),
      t("b", "2025-05-19T11:00:00.000Z"),
      t("c", "2025-05-19T10:00:00.000Z"),
    ];
    // New message arrives on thread "c" — it must jump to the top BEFORE
    // any application UPDATE for last_message_preview/last_message_at comes in.
    const after = applyIncomingMessage(
      before,
      {
        application_id: "c",
        sender_id: "other",
        body: "nuovo!",
        created_at: "2025-05-19T13:00:00.000Z",
      },
      "viewer-1",
      null,
    );
    expect(after.map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(after[0].lastBody).toBe("nuovo!");
    expect((after[0] as any).unread).toBe(1);
  });

  it("mergeThreadUpdate re-sorts when a late applications UPDATE bumps lastAt", () => {
    const before: InboxThread[] = [
      t("a", "2025-05-19T12:00:00.000Z"),
      t("b", "2025-05-19T11:00:00.000Z"),
    ];
    const after = mergeThreadUpdate(before, {
      id: "b",
      last_message_preview: "preview catch-up",
      last_message_at: "2025-05-19T14:00:00.000Z",
    });
    expect(after.map((x) => x.id)).toEqual(["b", "a"]);
    expect(after[0].lastBody).toBe("preview catch-up");
  });

  it("is idempotent when the late UPDATE matches what the message already set", () => {
    // Sequence: messages INSERT lands first → applyIncomingMessage bumps
    // lastAt; then the redundant applications UPDATE arrives with the same
    // preview/timestamp. The list must not shuffle and no thread is added.
    let threads: InboxThread[] = [
      t("a", "2025-05-19T12:00:00.000Z"),
      t("b", "2025-05-19T11:00:00.000Z"),
    ];
    threads = applyIncomingMessage(
      threads,
      {
        application_id: "b",
        sender_id: "other",
        body: "ciao",
        created_at: "2025-05-19T13:00:00.000Z",
      },
      "viewer-1",
      null,
    );
    const afterMsg = threads;
    expect(afterMsg.map((x) => x.id)).toEqual(["b", "a"]);

    // Now the late applications UPDATE with the same preview/lastAt:
    threads = mergeThreadUpdate(threads, {
      id: "b",
      last_message_preview: "ciao",
      last_message_at: "2025-05-19T13:00:00.000Z",
    });
    expect(threads.map((x) => x.id)).toEqual(["b", "a"]);
    expect(threads).toHaveLength(2);
    // unread must NOT be bumped again by the redundant application UPDATE.
    expect((threads[0] as any).unread).toBe(1);
  });

  it("status-only UPDATE does not change order", () => {
    const before: InboxThread[] = [
      t("a", "2025-05-19T12:00:00.000Z"),
      t("b", "2025-05-19T11:00:00.000Z"),
    ];
    const after = mergeThreadUpdate(before, { id: "b", status: "accepted" });
    expect(after.map((x) => x.id)).toEqual(["a", "b"]);
    expect(after[1].status).toBe("accepted");
  });
});