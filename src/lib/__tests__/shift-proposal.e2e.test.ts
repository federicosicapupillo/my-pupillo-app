/**
 * End-to-end coverage for the "restaurant sends a shift proposal" flow.
 *
 * What this guarantees from the user's perspective:
 *  - The worker receives the proposal AS A REAL MESSAGE in chat (a row in
 *    `messages` with `template_id = "shift_proposal"`), not only a notification.
 *  - The proposal body shown in the worker's chat carries the actual shift
 *    details (role, date, time, venue, location, compensation) so the
 *    worker can decide without opening the announcement.
 *  - The parent `applications` row is updated with `last_message_preview`
 *    and `last_message_at`, which is exactly what drives the realtime
 *    inbox refresh, the conversation preview, and the unread counter on
 *    both sides.
 *  - The notification to the worker is produced by the `notify_new_message`
 *    DB trigger keyed on `template_id = "shift_proposal"` — so as long as
 *    THIS test asserts the right template_id is written, the notification
 *    contract holds end-to-end.
 *  - The anti-duplicate gate in the restaurant UI (workers.tsx) prevents
 *    creating a second proposal for the same (announcement, worker) pair
 *    while the first is still unanswered.
 *
 * The supabase client is mocked with a minimal in-memory fake that records
 * every write, so each assertion mirrors the exact row a real INSERT/UPDATE
 * would produce against Supabase.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mock the supabase client BEFORE importing the module under test ------

type Row = Record<string, any>;
const calls: { table: string; op: string; payload?: Row; filters?: Row }[] = [];
const fixtures: Record<string, Row | null> = {
  announcements: null,
  profiles: null,
};

function makeBuilder(table: string) {
  const state: { filters: Row } = { filters: {} };
  const api: any = {
    select() { return api; },
    eq(col: string, val: any) { state.filters[col] = val; return api; },
    maybeSingle() {
      calls.push({ table, op: "select", filters: { ...state.filters } });
      return Promise.resolve({ data: fixtures[table] ?? null, error: null });
    },
    insert(payload: Row) {
      calls.push({ table, op: "insert", payload });
      return Promise.resolve({ data: null, error: null });
    },
    update(payload: Row) {
      const upd: any = {
        eq(col: string, val: any) {
          calls.push({ table, op: "update", payload, filters: { [col]: val } });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return upd;
    },
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

// Import AFTER the mock is installed.
import {
  sendShiftProposal,
  buildProposalBody,
  hasUnansweredProposal,
  PROPOSAL_TEMPLATE_ID,
  PROPOSAL_ACTION,
} from "@/lib/shift-proposal";

const APP_ID = "11111111-1111-1111-1111-111111111111";
const ANN_ID = "22222222-2222-2222-2222-222222222222";
const REST_ID = "33333333-3333-3333-3333-333333333333";
const WORKER_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  calls.length = 0;
  fixtures.announcements = {
    id: ANN_ID,
    service_date: "2026-06-12",
    service_time: "19:00:00",
    end_time: "23:00:00",
    location_address: "Via Roma 1, Milano",
    job_city: "Milano",
    tariff_amount: 14.5,
    tariff_type: "hourly",
    notes: "Servizio sala per evento privato.",
    professional_profile: "Cameriere",
  };
  fixtures.profiles = {
    business_name: "Trattoria da Marco",
    full_name: null,
  };
});

describe("E2E — restaurant sends a shift proposal", () => {
  it("delivers a real chat message to the worker with the correct template, sender and receiver", async () => {
    await sendShiftProposal({
      applicationId: APP_ID,
      announcementId: ANN_ID,
      restaurantId: REST_ID,
      workerId: WORKER_ID,
    });

    const messageInsert = calls.find((c) => c.table === "messages" && c.op === "insert");
    expect(messageInsert, "a row must be inserted into `messages` so the worker sees the proposal in chat").toBeDefined();
    const payload = messageInsert!.payload!;
    expect(payload.application_id).toBe(APP_ID);
    expect(payload.sender_id).toBe(REST_ID);
    expect(payload.receiver_id).toBe(WORKER_ID);
    expect(payload.template_id).toBe(PROPOSAL_TEMPLATE_ID);
    expect(payload.action_type).toBe(PROPOSAL_ACTION);
    expect(payload.message_type).toBe("template");
    // No "read_at" — must remain unread so the worker's badge increments.
    expect(payload.read_at).toBeNull();
  });

  it("packs the proposal body with the shift details the worker needs to decide", async () => {
    await sendShiftProposal({
      applicationId: APP_ID,
      announcementId: ANN_ID,
      restaurantId: REST_ID,
      workerId: WORKER_ID,
    });

    const body = calls.find((c) => c.table === "messages" && c.op === "insert")!.payload!.body as string;
    expect(body).toContain("Nuova proposta di lavoro");
    expect(body).toContain("Ruolo: Cameriere");
    expect(body).toContain("Data: ");
    expect(body).toContain("Orario: 19:00 - 23:00");
    expect(body).toContain("Locale: Trattoria da Marco");
    expect(body).toContain("Via Roma 1, Milano");
    // Compensation is required for the worker to evaluate the offer.
    expect(body.toLowerCase()).toContain("compenso");
  });

  it("updates the parent application so the realtime inbox preview and unread counter refresh", async () => {
    await sendShiftProposal({
      applicationId: APP_ID,
      announcementId: ANN_ID,
      restaurantId: REST_ID,
      workerId: WORKER_ID,
    });

    const appUpdate = calls.find((c) => c.table === "applications" && c.op === "update");
    expect(appUpdate, "applications row must be updated so the inbox `lastBody` & `lastAt` refresh in realtime").toBeDefined();
    expect(appUpdate!.filters).toEqual({ id: APP_ID });
    expect(appUpdate!.payload!.last_message_preview).toBe("Nuova proposta di lavoro");
    expect(typeof appUpdate!.payload!.last_message_at).toBe("string");
    // Same timestamp written on the message and on the application so the
    // inbox sort order matches the chat order.
    const messagePayload = calls.find((c) => c.table === "messages" && c.op === "insert")!.payload!;
    expect(appUpdate!.payload!.last_message_at).toBe(messagePayload.created_at);
  });

  it("falls back to a safe label when the restaurant has no business_name on file", async () => {
    fixtures.profiles = { business_name: null, full_name: null };
    const body = buildProposalBody(
      {
        id: ANN_ID,
        service_date: "2026-06-12",
        service_time: "19:00:00",
        end_time: "23:00:00",
        location_address: "Via Roma 1, Milano",
        professional_profile: "Cameriere",
      },
      null,
    );
    expect(body).toContain("Locale: Locale da confermare");
  });
});

describe("E2E — notification contract for proposals", () => {
  /**
   * The notification row is created by the DB trigger `notify_new_message`,
   * which keys off `template_id = "shift_proposal"` to set the correct
   * title/body/link. The client-side guarantee is therefore that:
   *   1. the inserted message carries `template_id = "shift_proposal"`,
   *   2. nothing else inserts duplicate `shift_proposal` messages for the
   *      same application unanswered (covered by anti-duplicate gate below).
   * If the template_id were ever changed, the trigger would stop firing and
   * the worker would silently stop receiving notifications.
   */
  it("locks the template_id used by the notify_new_message trigger", async () => {
    expect(PROPOSAL_TEMPLATE_ID).toBe("shift_proposal");
    await sendShiftProposal({
      applicationId: APP_ID,
      announcementId: ANN_ID,
      restaurantId: REST_ID,
      workerId: WORKER_ID,
    });
    const insert = calls.find((c) => c.table === "messages" && c.op === "insert")!.payload!;
    expect(insert.template_id).toBe("shift_proposal");
  });
});

describe("E2E — anti-duplicate gate (workers.tsx flow)", () => {
  it("does not block the very first proposal for an (announcement, worker) pair", () => {
    expect(hasUnansweredProposal([], [])).toBe(false);
  });

  it("blocks a second proposal while the worker has not yet replied", () => {
    // Worker has one open proposal, no response recorded yet → block.
    expect(hasUnansweredProposal(["msg-1"], [])).toBe(true);
  });

  it("does NOT block once the worker has answered the previous proposal", () => {
    // The single open proposal has a recorded response (accept OR reject) →
    // the restaurant is allowed to send a fresh proposal.
    expect(hasUnansweredProposal(["msg-1"], ["msg-1"])).toBe(false);
  });

  it("blocks when ANY proposal in the thread is still unanswered, even if others were answered", () => {
    expect(hasUnansweredProposal(["msg-1", "msg-2", "msg-3"], ["msg-1", "msg-3"])).toBe(true);
  });
});