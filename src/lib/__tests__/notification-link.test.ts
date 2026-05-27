import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client used by notification-link.ts. We control the
// `reviews` lookup per-test via `reviewLookup`.
let reviewLookup: { application_id?: string | null; shift_id?: string | null } | null = null;
let reviewLookupShouldThrow = false;
let currentUserRole: "worker" | "restaurant" | "admin" | null = null;

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: currentUserRole ? { id: "user-1" } : null } }),
      },
      from: (table: string) => ({
        select: () => {
          if (table === "user_roles") {
            return {
              eq: async () => ({
                data: currentUserRole ? [{ role: currentUserRole }] : [],
                error: null,
              }),
            };
          }
          return {
            eq: () => ({
              maybeSingle: async () => {
                if (reviewLookupShouldThrow) throw new Error("db down");
                return { data: reviewLookup, error: null };
              },
            }),
          };
        },
      }),
    },
  };
});

import { navigateFromNotificationLink } from "@/lib/notification-link";

// Known typed routes the helper is allowed to navigate to. Any call with a
// `to` outside this set means a 404 in production. Keep this list in sync
// with src/routes/*.tsx.
const VALID_ROUTES = new Set<string>([
  "/messages",
  "/messages/$id",
  "/shifts",
  "/ristoratore/turni/$shiftId",
  "/reviews/$id",
  "/announcements",
  "/announcements/$id",
  "/workers",
  "/workers/$id",
  "/profile",
  "/onboarding",
  "/dashboard",
  "/notifications",
  "/jobs",
  "/ristoratore/collaboratori",
]);

function makeNavigate() {
  const calls: Array<{ to: string; params?: Record<string, unknown> }> = [];
  const fn = vi.fn(async (opts: { to: string; params?: Record<string, unknown> }) => {
    if (!VALID_ROUTES.has(opts.to)) {
      throw new Error(`navigate -> 404: unknown route "${opts.to}"`);
    }
    calls.push(opts);
  });
  return Object.assign(fn, { calls });
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("navigateFromNotificationLink", () => {
  beforeEach(() => {
    reviewLookup = null;
    reviewLookupShouldThrow = false;
    currentUserRole = null;
  });

  it("routes /messages to the inbox", async () => {
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, "/messages");
    expect(nav.calls).toEqual([{ to: "/messages" }]);
  });

  it("routes /messages/<id> to the conversation", async () => {
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, `/messages/${UUID_A}`);
    expect(nav.calls).toEqual([{ to: "/messages/$id", params: { id: UUID_A } }]);
  });

  it("routes /shifts to the shifts page", async () => {
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, "/shifts");
    expect(nav.calls[0]).toEqual({ to: "/shifts" });
  });

  it("routes /ristoratore/turni/<id> to the shift detail for restaurants", async () => {
    currentUserRole = "restaurant";
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, `/ristoratore/turni/${UUID_A}`);
    expect(nav.calls[0]).toEqual({
      to: "/ristoratore/turni/$shiftId",
      params: { shiftId: UUID_A },
    });
  });

  it("never sends a worker to the restaurant-only shift detail", async () => {
    currentUserRole = "worker";
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, `/ristoratore/turni/${UUID_A}`);
    expect(nav.calls[0]).toEqual({ to: "/shifts" });
  });

  it("routes /announcements/<id> to the announcement detail", async () => {
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, `/announcements/${UUID_A}`);
    expect(nav.calls[0]).toEqual({ to: "/announcements/$id", params: { id: UUID_A } });
  });

  it("routes bare /announcements to the list", async () => {
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, "/announcements");
    expect(nav.calls[0]).toEqual({ to: "/announcements" });
  });

  it("routes /workers/<id> and /workers_/<id> to the worker profile", async () => {
    const nav1 = makeNavigate();
    await navigateFromNotificationLink(nav1 as any, `/workers/${UUID_A}`);
    expect(nav1.calls[0]).toEqual({ to: "/workers/$id", params: { id: UUID_A } });

    const nav2 = makeNavigate();
    await navigateFromNotificationLink(nav2 as any, `/workers_/${UUID_A}`);
    expect(nav2.calls[0]).toEqual({ to: "/workers/$id", params: { id: UUID_A } });
  });

  it("routes flat safe destinations (profile, dashboard, etc.)", async () => {
    for (const path of [
      "/profile",
      "/onboarding",
      "/dashboard",
      "/notifications",
      "/jobs",
      "/workers",
      "/ristoratore/collaboratori",
    ]) {
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, path);
      expect(nav.calls[0]?.to).toBe(path);
    }
  });

  describe("/reviews/<id> resolution", () => {
    it("opens the dedicated review popup for workers", async () => {
      currentUserRole = "worker";
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, `/reviews/${UUID_B}`);
      expect(nav.calls[0]).toEqual({ to: "/reviews/$id", params: { id: UUID_B } });
    });

    it("opens the dedicated review popup when role is unknown", async () => {
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, `/reviews/${UUID_B}`);
      expect(nav.calls[0]).toEqual({ to: "/reviews/$id", params: { id: UUID_B } });
    });

    it("resolves to the related chat for restaurants when review has an application_id", async () => {
      currentUserRole = "restaurant";
      reviewLookup = { application_id: UUID_A, shift_id: null };
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, `/reviews/${UUID_B}`);
      expect(nav.calls[0]).toEqual({ to: "/messages/$id", params: { id: UUID_A } });
    });

    it("falls back to the shift detail for restaurants when only shift_id is present", async () => {
      currentUserRole = "restaurant";
      reviewLookup = { application_id: null, shift_id: UUID_A };
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, `/reviews/${UUID_B}`);
      expect(nav.calls[0]).toEqual({
        to: "/ristoratore/turni/$shiftId",
        params: { shiftId: UUID_A },
      });
    });

    it("falls back to /shifts for restaurants when the review row has neither id", async () => {
      currentUserRole = "restaurant";
      reviewLookup = { application_id: null, shift_id: null };
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, `/reviews/${UUID_B}`);
      expect(nav.calls[0]).toEqual({ to: "/shifts" });
    });

    it("falls back to /shifts for restaurants when the review lookup throws", async () => {
      currentUserRole = "restaurant";
      reviewLookupShouldThrow = true;
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, `/reviews/${UUID_B}`);
      expect(nav.calls[0]).toEqual({ to: "/shifts" });
    });
  });

  describe("invalid / unknown links fall back to /messages (never 404)", () => {
    const cases: Array<string | null | undefined> = [
      null,
      undefined,
      "",
      "   ",
      "undefined",
      "null",
      "nan",
      "/messages/undefined",
      "/messages/null",
      "/ristoratore/turni/",
      "/reviews/",
      "/totally/unknown/path",
      "/admin/secret",
      "/foo",
    ];

    for (const link of cases) {
      it(`link=${JSON.stringify(link)} → /messages fallback`, async () => {
        const nav = makeNavigate();
        await navigateFromNotificationLink(nav as any, link);
        expect(nav).toHaveBeenCalledTimes(1);
        expect(nav.calls[0]).toEqual({ to: "/messages" });
      });
    }
  });

  it("preserves trailing slashes by stripping them before matching", async () => {
    const nav = makeNavigate();
    await navigateFromNotificationLink(nav as any, "/messages/");
    // "/messages/" → after strip → "/messages" → inbox is also acceptable.
    // Current behavior: parts=["messages"], routes to inbox.
    expect(nav.calls[0]).toEqual({ to: "/messages" });
  });

  it("never invokes navigate with an unknown `to` (no 404 surface)", async () => {
    // Sanity sweep: run all sample notification links and ensure the
    // navigate spy was always called with a known typed route.
    const samples = [
      "/messages",
      `/messages/${UUID_A}`,
      "/shifts",
      `/ristoratore/turni/${UUID_A}`,
      `/announcements/${UUID_A}`,
      "/announcements",
      `/workers/${UUID_A}`,
      "/profile",
      "/onboarding",
      "/dashboard",
      "/notifications",
      "/jobs",
      "/workers",
      "/ristoratore/collaboratori",
      "/garbage",
      "/reviews/not-a-uuid",
    ];
    for (const link of samples) {
      const nav = makeNavigate();
      await navigateFromNotificationLink(nav as any, link);
      for (const c of nav.calls) {
        expect(VALID_ROUTES.has(c.to)).toBe(true);
      }
    }
  });
});