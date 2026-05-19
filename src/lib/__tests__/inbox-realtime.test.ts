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

describe("messages + proposal_responses — notification state without duplicates", () => {
  const viewer = "viewer-1";

  it("messages INSERT followed by the late applications UPDATE bumps unread exactly once", () => {
    let threads: InboxThread[] = [baseThread({ unread: 0 })];
    // 1) realtime: messages INSERT (immediate)
    threads = applyIncomingMessage(
      threads,
      {
        application_id: "app-1",
        sender_id: "other",
        body: "nuovo",
        created_at: "2025-05-19T13:00:00.000Z",
      },
      viewer,
      null,
    );
    // 2) realtime: applications UPDATE with same preview/lastAt (catch-up)
    threads = mergeThreadUpdate(threads, {
      id: "app-1",
      last_message_preview: "nuovo",
      last_message_at: "2025-05-19T13:00:00.000Z",
    });
    expect(threads).toHaveLength(1);
    expect((threads[0] as any).unread).toBe(1);
    expect(threads[0].lastBody).toBe("nuovo");
  });

  it("multiple messages INSERT events do not create duplicate threads", () => {
    let threads: InboxThread[] = [baseThread({ unread: 0 })];
    for (let i = 0; i < 5; i++) {
      threads = applyIncomingMessage(
        threads,
        { application_id: "app-1", sender_id: "other", body: `m${i}` },
        viewer,
        null,
      );
    }
    expect(threads).toHaveLength(1);
    expect(threads.filter((x) => x.id === "app-1")).toHaveLength(1);
    expect((threads[0] as any).unread).toBe(5);
  });

  it("proposal_responses INSERT + applications UPDATE for same status is idempotent", () => {
    let threads: InboxThread[] = [baseThread({ status: "pending" })];
    // proposal_responses INSERT
    threads = applyProposalResponse(threads, {
      application_id: "app-1",
      status: "accepted",
    });
    // catch-up applications UPDATE with the same status
    threads = mergeThreadUpdate(threads, { id: "app-1", status: "accepted" });
    expect(threads).toHaveLength(1);
    expect(threads[0].status).toBe("accepted");
  });

  it("duplicate proposal_responses events do not re-trigger state changes", () => {
    const before: InboxThread[] = [baseThread({ status: "pending" })];
    const once = applyProposalResponse(before, {
      application_id: "app-1",
      status: "accepted",
    });
    // A second identical INSERT event (e.g. retry) must be a no-op.
    const twice = applyProposalResponse(once, {
      application_id: "app-1",
      status: "accepted",
    });
    expect(twice).toBe(once);
    expect(twice[0].status).toBe("accepted");
  });

  it("a proposal_responses event does NOT touch unread", () => {
    const before: InboxThread[] = [baseThread({ unread: 2, status: "pending" })];
    const after = applyProposalResponse(before, {
      application_id: "app-1",
      status: "rejected",
    });
    expect((after[0] as any).unread).toBe(2);
    expect(after[0].status).toBe("rejected");
  });

  it("interleaved messages + proposal_responses keep a single thread with correct unread", () => {
    let threads: InboxThread[] = [baseThread({ unread: 0, status: "pending" })];
    threads = applyIncomingMessage(
      threads,
      { application_id: "app-1", sender_id: "other", body: "ciao" },
      viewer,
      null,
    );
    threads = applyProposalResponse(threads, {
      application_id: "app-1",
      status: "accepted",
    });
    threads = applyIncomingMessage(
      threads,
      { application_id: "app-1", sender_id: "other", body: "a presto" },
      viewer,
      null,
    );
    // catch-up applications UPDATE for the second message
    threads = mergeThreadUpdate(threads, {
      id: "app-1",
      status: "accepted",
      last_message_preview: "a presto",
    });
    expect(threads).toHaveLength(1);
    expect(threads[0].status).toBe("accepted");
    expect((threads[0] as any).unread).toBe(2);
    expect(threads[0].lastBody).toBe("a presto");
  });

  it("ignores messages and proposal_responses events for unknown applications (no duplicates)", () => {
    const before: InboxThread[] = [baseThread()];
    const afterMsg = applyIncomingMessage(
      before,
      { application_id: "app-UNKNOWN", sender_id: "other", body: "x" },
      viewer,
      null,
    );
    const afterResp = applyProposalResponse(afterMsg, {
      application_id: "app-UNKNOWN",
      status: "accepted",
    });
    expect(afterResp).toBe(before);
    expect(afterResp).toHaveLength(1);
  });
});

describe("multi-user realtime — filter by user.id (Federico, Enrico, Admin)", () => {
  // Three viewers share the same realtime stream but each has their own
  // inbox state. Helpers must filter strictly by viewerId / thread membership
  // so events for one user never leak into another's unread badge.
  const FEDERICO = "user-federico"; // worker
  const ENRICO = "user-enrico"; // restaurant
  const ADMIN = "user-admin"; // admin watching both sides

  const seedThread = (id: string): InboxThread => ({
    id,
    status: "pending",
    lastBody: "ciao",
    lastAt: "2025-05-19T10:00:00.000Z",
    unread: 0,
  });

  // Federico ↔ Enrico share app-FE. Admin sees both app-FE and a second
  // conversation app-OTHER that Federico is NOT part of.
  const seedInboxes = () => ({
    federico: [seedThread("app-FE")] as InboxThread[],
    enrico: [seedThread("app-FE")] as InboxThread[],
    admin: [seedThread("app-FE"), seedThread("app-OTHER")] as InboxThread[],
  });

  it("a message sent by Federico bumps unread for Enrico and Admin, NOT for Federico", () => {
    const inbox = seedInboxes();
    const msg = {
      application_id: "app-FE",
      sender_id: FEDERICO,
      body: "ciao Enrico",
      created_at: "2025-05-19T12:00:00.000Z",
    };
    const fed = applyIncomingMessage(inbox.federico, msg, FEDERICO, null);
    const enr = applyIncomingMessage(inbox.enrico, msg, ENRICO, null);
    const adm = applyIncomingMessage(inbox.admin, msg, ADMIN, null);

    expect(fed).toBe(inbox.federico); // sender — no bump, same ref
    expect((fed[0] as any).unread).toBe(0);

    expect((enr[0] as any).unread).toBe(1);
    expect(enr[0].lastBody).toBe("ciao Enrico");

    expect(adm.find((t) => t.id === "app-FE")!.unread).toBe(1);
    // The unrelated thread in admin's inbox must NOT be touched.
    expect(adm.find((t) => t.id === "app-OTHER")!.unread).toBe(0);
  });

  it("a reply from Enrico bumps unread for Federico and Admin, NOT for Enrico", () => {
    const inbox = seedInboxes();
    const msg = {
      application_id: "app-FE",
      sender_id: ENRICO,
      body: "ok",
      created_at: "2025-05-19T12:05:00.000Z",
    };
    const fed = applyIncomingMessage(inbox.federico, msg, FEDERICO, null);
    const enr = applyIncomingMessage(inbox.enrico, msg, ENRICO, null);
    const adm = applyIncomingMessage(inbox.admin, msg, ADMIN, null);

    expect((fed[0] as any).unread).toBe(1);
    expect(enr).toBe(inbox.enrico);
    expect(adm.find((t) => t.id === "app-FE")!.unread).toBe(1);
  });

  it("events for an application a user is not part of are ignored", () => {
    const inbox = seedInboxes();
    // A message lands on app-OTHER (Federico has no such thread).
    const msg = {
      application_id: "app-OTHER",
      sender_id: "someone-else",
      body: "fuori contesto",
    };
    const fed = applyIncomingMessage(inbox.federico, msg, FEDERICO, null);
    const enr = applyIncomingMessage(inbox.enrico, msg, ENRICO, null);
    const adm = applyIncomingMessage(inbox.admin, msg, ADMIN, null);

    // Federico & Enrico have no app-OTHER thread → strict no-op (same ref).
    expect(fed).toBe(inbox.federico);
    expect(enr).toBe(inbox.enrico);
    // Admin sees the bump on the right thread, app-FE stays at 0.
    expect(adm.find((t) => t.id === "app-OTHER")!.unread).toBe(1);
    expect(adm.find((t) => t.id === "app-FE")!.unread).toBe(0);
  });

  it("if Federico has the chat open, his unread stays at 0 while Enrico/Admin still bump", () => {
    const inbox = seedInboxes();
    const msg = {
      application_id: "app-FE",
      sender_id: ENRICO,
      body: "leggi",
    };
    const fed = applyIncomingMessage(inbox.federico, msg, FEDERICO, "app-FE");
    const enr = applyIncomingMessage(inbox.enrico, msg, ENRICO, null);
    const adm = applyIncomingMessage(inbox.admin, msg, ADMIN, null);

    expect((fed[0] as any).unread).toBe(0);
    expect(fed[0].lastBody).toBe("leggi"); // preview still refreshed
    expect(enr).toBe(inbox.enrico); // sender
    expect(adm.find((t) => t.id === "app-FE")!.unread).toBe(1);
  });

  it("a proposal_responses INSERT propagates the same status to every viewer that has the thread", () => {
    const inbox = seedInboxes();
    const resp = { application_id: "app-FE", status: "accepted" as const };
    const fed = applyProposalResponse(inbox.federico, resp);
    const enr = applyProposalResponse(inbox.enrico, resp);
    const adm = applyProposalResponse(inbox.admin, resp);

    expect(fed[0].status).toBe("accepted");
    expect(enr[0].status).toBe("accepted");
    expect(adm.find((t) => t.id === "app-FE")!.status).toBe("accepted");
    // Unrelated thread must not flip status.
    expect(adm.find((t) => t.id === "app-OTHER")!.status).toBe("pending");
  });

  it("a proposal_responses for an application a user does not have is a no-op", () => {
    const inbox = seedInboxes();
    const resp = { application_id: "app-OTHER", status: "rejected" as const };
    const fed = applyProposalResponse(inbox.federico, resp);
    const enr = applyProposalResponse(inbox.enrico, resp);
    expect(fed).toBe(inbox.federico);
    expect(enr).toBe(inbox.enrico);
  });

  it("clearThreadUnread for one viewer does not affect the others' unread", () => {
    let { federico, enrico, admin } = seedInboxes();
    const msg = { application_id: "app-FE", sender_id: ENRICO, body: "x" };
    federico = applyIncomingMessage(federico, msg, FEDERICO, null);
    admin = applyIncomingMessage(admin, msg, ADMIN, null);
    expect((federico[0] as any).unread).toBe(1);
    expect(admin.find((t) => t.id === "app-FE")!.unread).toBe(1);

    // Federico opens the chat → clears HIS unread only.
    federico = clearThreadUnread(federico, "app-FE");
    expect((federico[0] as any).unread).toBe(0);
    expect(admin.find((t) => t.id === "app-FE")!.unread).toBe(1);
    expect((enrico[0] as any).unread).toBe(0);
  });

  it("a full message + proposal_response flow leaves every inbox consistent (no duplicates)", () => {
    let { federico, enrico, admin } = seedInboxes();

    // 1) Enrico sends a proposal message.
    const msg1 = {
      application_id: "app-FE",
      sender_id: ENRICO,
      body: "ti propongo un turno",
      created_at: "2025-05-19T12:00:00.000Z",
    };
    federico = applyIncomingMessage(federico, msg1, FEDERICO, null);
    enrico = applyIncomingMessage(enrico, msg1, ENRICO, null);
    admin = applyIncomingMessage(admin, msg1, ADMIN, null);

    // 2) Late applications UPDATE (preview catch-up) — must NOT re-bump.
    const upd = {
      id: "app-FE",
      last_message_preview: "ti propongo un turno",
      last_message_at: "2025-05-19T12:00:00.000Z",
    };
    federico = mergeThreadUpdate(federico, upd);
    enrico = mergeThreadUpdate(enrico, upd);
    admin = mergeThreadUpdate(admin, upd);

    // 3) Federico accepts → proposal_responses event for everyone.
    const resp = { application_id: "app-FE", status: "accepted" as const };
    federico = applyProposalResponse(federico, resp);
    enrico = applyProposalResponse(enrico, resp);
    admin = applyProposalResponse(admin, resp);

    // No duplicate threads anywhere.
    expect(federico).toHaveLength(1);
    expect(enrico).toHaveLength(1);
    expect(admin).toHaveLength(2);

    // Federico is the sender of the accept event but the RECIPIENT of msg1,
    // so his unread is 1 (only msg1, not re-bumped by the late UPDATE).
    expect((federico[0] as any).unread).toBe(1);
    expect(federico[0].status).toBe("accepted");

    // Enrico sent msg1 → unread 0; status flipped.
    expect((enrico[0] as any).unread).toBe(0);
    expect(enrico[0].status).toBe("accepted");

    // Admin: app-FE unread 1, status accepted; app-OTHER untouched.
    const adminFE = admin.find((t) => t.id === "app-FE")!;
    const adminOther = admin.find((t) => t.id === "app-OTHER")!;
    expect(adminFE.unread).toBe(1);
    expect(adminFE.status).toBe("accepted");
    expect(adminOther.unread).toBe(0);
    expect(adminOther.status).toBe("pending");
  });
});

describe("fallback — load() failures and incomplete payloads keep the inbox stable", () => {
  const viewer = "viewer-1";

  describe("createDebouncedReload — load() throwing must not break future schedules", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("a synchronous throw inside fn does not prevent the next schedule from firing", () => {
      let calls = 0;
      const fn = vi.fn(() => {
        calls++;
        if (calls === 1) throw new Error("network down");
      });
      const r = createDebouncedReload(fn, 120);

      r.schedule();
      // First burst — the timer fires and fn throws. We swallow it like the
      // route does (the inbox already shows the optimistic state).
      expect(() => vi.advanceTimersByTime(120)).toThrow("network down");
      expect(fn).toHaveBeenCalledTimes(1);

      // The debouncer must still be usable: a new schedule fires fn again.
      r.schedule();
      vi.advanceTimersByTime(120);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("a rejected async load() does not leave the debouncer stuck", async () => {
      const fn = vi.fn(async () => {
        throw new Error("supabase 500");
      });
      const r = createDebouncedReload(() => { void fn().catch(() => {}); }, 120);

      r.schedule();
      vi.advanceTimersByTime(120);
      expect(fn).toHaveBeenCalledTimes(1);

      // Subsequent burst still goes through.
      r.schedule();
      r.schedule();
      vi.advanceTimersByTime(120);
      expect(fn).toHaveBeenCalledTimes(2);
      // No pending timer left behind.
      expect(r.pending).toBe(false);
    });
  });

  describe("mergeThreadUpdate — incomplete application payloads", () => {
    it("application UPDATE with only id is a no-op on tracked rows (no field wipe)", () => {
      const before: InboxThread[] = [
        baseThread({ status: "pending", lastBody: "ciao", lastAt: "2025-05-19T10:00:00.000Z" }),
      ];
      const after = mergeThreadUpdate(before, { id: "app-1" });
      expect(after).toHaveLength(1);
      expect(after[0].status).toBe("pending");
      expect(after[0].lastBody).toBe("ciao");
      expect(after[0].lastAt).toBe("2025-05-19T10:00:00.000Z");
    });

    it("null fields in the payload fall back to existing values", () => {
      const before: InboxThread[] = [
        baseThread({ status: "pending", lastBody: "ciao", lastAt: "2025-05-19T10:00:00.000Z" }),
      ];
      const after = mergeThreadUpdate(before, {
        id: "app-1",
        status: null,
        last_message_preview: null,
        last_message_at: null,
      });
      expect(after[0].status).toBe("pending");
      expect(after[0].lastBody).toBe("ciao");
      expect(after[0].lastAt).toBe("2025-05-19T10:00:00.000Z");
    });

    it("a malformed payload missing id is ignored (no crash, no mutation)", () => {
      const before: InboxThread[] = [baseThread()];
      // Cast through unknown — realtime sometimes sends partial rows.
      const after = mergeThreadUpdate(before, {} as unknown as { id: string });
      expect(after).toBe(before);
    });
  });

  describe("applyIncomingMessage — incomplete message payloads", () => {
    it("missing body / created_at falls back to existing values, unread still bumps", () => {
      const before: InboxThread[] = [
        baseThread({ unread: 0, lastBody: "vecchio", lastAt: "2025-05-19T09:00:00.000Z" }),
      ];
      const after = applyIncomingMessage(
        before,
        { application_id: "app-1", sender_id: "other" }, // no body, no created_at
        viewer,
        null,
      );
      expect((after[0] as any).unread).toBe(1);
      expect(after[0].lastBody).toBe("vecchio");
      expect(after[0].lastAt).toBe("2025-05-19T09:00:00.000Z");
    });

    it("missing sender_id is treated as 'not the viewer' and still bumps unread", () => {
      const before: InboxThread[] = [baseThread({ unread: 0 })];
      const after = applyIncomingMessage(
        before,
        { application_id: "app-1", sender_id: undefined as unknown as string, body: "x" },
        viewer,
        null,
      );
      expect((after[0] as any).unread).toBe(1);
    });

    it("missing application_id is ignored without throwing", () => {
      const before: InboxThread[] = [baseThread()];
      const after = applyIncomingMessage(
        before,
        { application_id: undefined as unknown as string, sender_id: "other", body: "x" },
        viewer,
        null,
      );
      expect(after).toBe(before);
    });
  });

  describe("applyProposalResponse — malformed payloads", () => {
    it("missing status is ignored", () => {
      const before: InboxThread[] = [baseThread()];
      const after = applyProposalResponse(before, {
        application_id: "app-1",
        status: undefined as unknown as string,
      });
      expect(after).toBe(before);
    });

    it("missing application_id is ignored", () => {
      const before: InboxThread[] = [baseThread()];
      const after = applyProposalResponse(before, {
        application_id: undefined as unknown as string,
        status: "accepted",
      });
      expect(after).toBe(before);
    });

    it("an empty inbox stays empty for any response (no synthetic insert)", () => {
      const before: InboxThread[] = [];
      const after = applyProposalResponse(before, {
        application_id: "app-1",
        status: "accepted",
      });
      expect(after).toEqual([]);
    });
  });

  describe("end-to-end fallback — repeated load failures + partial events", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("optimistic state survives multiple consecutive load() failures", () => {
      let threads: InboxThread[] = [baseThread({ unread: 0 })];
      const load = vi.fn(() => { throw new Error("offline"); });
      const r = createDebouncedReload(() => {
        try { load(); } catch { /* swallow — keep inbox stable */ }
      }, 120);

      // Message arrives → optimistic bump.
      threads = applyIncomingMessage(
        threads,
        { application_id: "app-1", sender_id: "other", body: "ciao" },
        viewer,
        null,
      );
      r.schedule();
      vi.advanceTimersByTime(120);

      // Partial application UPDATE catches up but load() still fails.
      threads = mergeThreadUpdate(threads, { id: "app-1" });
      r.schedule();
      vi.advanceTimersByTime(120);

      expect(load).toHaveBeenCalledTimes(2);
      // Inbox kept the optimistic state — no crash, no duplicate, unread intact.
      expect(threads).toHaveLength(1);
      expect((threads[0] as any).unread).toBe(1);
      expect(threads[0].lastBody).toBe("ciao");
    });
  });
});